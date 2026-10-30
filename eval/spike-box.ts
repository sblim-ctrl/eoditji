// D1 인식 스파이크: 사진 3장 × terra·luna로 이미지 토큰·단가를 재고, 박스를 사진 위에 그려 표시 방식을 정한다.
// 실행: npm run spike   (eval/photos/의 사진을 1400px JPEG로 줄여 OpenAI에 보냄. 결과는 eval/results/)
// 프롬프트·스키마는 D2에 supabase/functions/_shared/prompts.ts v1로 옮겼다. 이 파일은 D1 기록용으로 그대로 둔다.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const PROMPT_VERSION = 'spike-0'
const MAX_SIDE = 1400
const PHOTO_DIR = 'eval/photos'
const WORK_DIR = join(PHOTO_DIR, '.work') // 줄인 사진도 실제 집 사진이라 photos/ 아래(커밋 안 함)에 둠
const RESULT_DIR = 'eval/results'

// 100만 토큰당 달러 (PRD 05, 2026-10-30 확인)
const MODELS = {
  'gpt-6.1-terra': { input: 1, output: 5 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
} as const
type ModelName = keyof typeof MODELS

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('.env에 OPENAI_API_KEY가 필요합니다')

// 프로토타입 recognizePrompt(엄마 말투) + 박스·aliases
function recognizePrompt(placeName: string): string {
  return `집 수납공간을 위에서 찍은 사진이야. 이 칸의 이름은 ${JSON.stringify(placeName)}이야.
사진 속 물건을 빠짐없이 적어 줘. 이어캡·건전지·케이블처럼 작은 물건도 놓치지 마.
- sure: 확실히 보이는 물건
- guess: 일부만 보여서 추정한 물건
- hidden: 파우치·상자·봉투처럼 안이 가려진 용기. 색이나 모양으로 구별되게 (예: "검정 파우치")
- 물건마다 box: 사진에서 그 물건을 감싸는 사각형 [x1, y1, x2, y2]. 사진 왼쪽 위가 (0, 0), 오른쪽 아래가 (1000, 1000)인 정수 좌표. 위치를 모르면 null.
- 물건마다 aliases: 사람들이 그 물건을 다르게 부르는 이름 3~6개 (별명·동의어·줄임말·용도. 예: 이어캡 → 이어팁, 에어팟 고무)
- questions: hidden 용기마다 안에 뭐가 있는지 묻는 질문, 최대 3개. 엄마가 자녀에게 묻는 다정한 반말 (예: "검정 파우치 안엔 뭐 들었어?"). target은 그 용기 이름.
- try: 이 칸의 물건을 찾는 질문 3개. 자녀가 묻는 짧은 반말로, 일부러 목록과 다른 이름(별명·동의어·용도)을 써 (예: 이어캡 → "이어팁 어디 있어?").
물건 이름은 집에서 흔히 부르는 짧은 한국어로 적어.`
}

const itemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'box', 'aliases'],
  properties: {
    name: { type: 'string' },
    box: { type: ['array', 'null'], items: { type: 'integer' } },
    aliases: { type: 'array', items: { type: 'string' } },
  },
}
const recognizeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sure', 'guess', 'hidden', 'questions', 'try'],
  properties: {
    sure: { type: 'array', items: itemSchema },
    guess: { type: 'array', items: itemSchema },
    hidden: { type: 'array', items: itemSchema },
    questions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['target', 'ask'],
        properties: { target: { type: 'string' }, ask: { type: 'string' } },
      },
    },
    try: { type: 'array', items: { type: 'string' } },
  },
}

type Item = { name: string; box: number[] | null; aliases: string[] }
type Recognition = { sure: Item[]; guess: Item[]; hidden: Item[]; questions: { target: string; ask: string }[]; try: string[] }

// 개발계획 4절 좌표 검증: 0~1000으로 자르고, 뒤집힌 축은 바꾸고, 넓이 0이면 null
function validateBox(box: number[] | null): number[] | null {
  if (!box || box.length !== 4) return null
  const c = box.map((v) => Math.min(1000, Math.max(0, Math.round(v))))
  const [x1, x2] = c[0] <= c[2] ? [c[0], c[2]] : [c[2], c[0]]
  const [y1, y2] = c[1] <= c[3] ? [c[1], c[3]] : [c[3], c[1]]
  return x2 > x1 && y2 > y1 ? [x1, y1, x2, y2] : null
}

function shrink(photo: string): string {
  const out = join(WORK_DIR, `${basename(photo, extname(photo))}-${MAX_SIDE}.jpg`)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(MAX_SIDE), photo, '--out', out], { stdio: 'ignore' })
  return out
}

async function recognize(model: ModelName, jpeg: string, placeName: string) {
  const started = performance.now()
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: recognizePrompt(placeName) },
          { type: 'input_image', image_url: `data:image/jpeg;base64,${readFileSync(jpeg).toString('base64')}`, detail: 'original' },
        ],
      }],
      text: { format: { type: 'json_schema', name: 'recognize', strict: true, schema: recognizeSchema } },
    }),
  })
  const latencyMs = Math.round(performance.now() - started)
  const body = await res.json()
  if (!res.ok) throw new Error(`${model} ${res.status}: ${body.error?.message ?? 'unknown error'}`)

  const text: string = body.output.flatMap((o: { content?: { type: string; text: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === 'output_text').text
  const raw: Recognition = JSON.parse(text)
  const fix = (items: Item[]) => items.map((it) => ({ ...it, box: validateBox(it.box) }))
  const result: Recognition = { ...raw, sure: fix(raw.sure), guess: fix(raw.guess), hidden: fix(raw.hidden) }

  const usage = {
    input: body.usage.input_tokens as number,
    output: body.usage.output_tokens as number,
    reasoning: (body.usage.output_tokens_details?.reasoning_tokens ?? 0) as number,
  }
  const price = MODELS[model]
  const costUsd = (usage.input * price.input + usage.output * price.output) / 1e6
  const items = [...result.sure, ...result.guess, ...result.hidden]
  return {
    model, latencyMs, usage, costUsd,
    counts: { sure: result.sure.length, guess: result.guess.length, hidden: result.hidden.length, withBox: items.filter((i) => i.box).length },
    result,
  }
}

type Run = Awaited<ReturnType<typeof recognize>> & { photo: string; jpeg: string }

const COLORS = { sure: '#16a34a', guess: '#d97706', hidden: '#7c3aed' }
function overlayHtml(runs: Run[]): string {
  const cards = runs.map((r) => {
    const boxes = (['sure', 'guess', 'hidden'] as const).flatMap((level) => r.result[level].filter((it) => it.box).map((it, i) => {
      const [x1, y1, x2, y2] = it.box!
      return `<div class="box" style="left:${x1 / 10}%;top:${y1 / 10}%;width:${(x2 - x1) / 10}%;height:${(y2 - y1) / 10}%;border-color:${COLORS[level]}"><span style="background:${COLORS[level]}">${level[0]}${i + 1} ${it.name}</span></div>`
    })).join('')
    return `<section><h2>${basename(r.photo)} · ${r.model}</h2>
<p>${r.latencyMs}ms · 입력 ${r.usage.input} / 출력 ${r.usage.output} (추론 ${r.usage.reasoning}) 토큰 · $${r.costUsd.toFixed(5)} · 확실 ${r.counts.sure} / 추정 ${r.counts.guess} / 가려짐 ${r.counts.hidden} · 박스 ${r.counts.withBox}개</p>
<div class="photo"><img src="../photos/.work/${basename(r.jpeg)}">${boxes}</div></section>`
  }).join('\n')
  return `<!doctype html><meta charset="utf-8"><title>박스 스파이크</title>
<style>body{font-family:sans-serif;margin:16px}section{margin-bottom:32px}.photo{position:relative;display:inline-block;max-width:100%}
.photo img{display:block;max-width:100%}.box{position:absolute;border:2px solid}.box span{position:absolute;top:-1.4em;left:-2px;color:#fff;font-size:12px;padding:0 3px;white-space:nowrap}</style>
<p>초록 = 확실(s), 주황 = 추정(g), 보라 = 가려짐(h). 판정 기준: 박스가 그 물건을 대체로 덮으면 적중 (개발계획 4절)</p>
${cards}`
}

async function main() {
  mkdirSync(WORK_DIR, { recursive: true })
  mkdirSync(RESULT_DIR, { recursive: true })
  const photos = readdirSync(PHOTO_DIR).filter((f) => /\.(jpe?g|png|heic)$/i.test(f)).map((f) => join(PHOTO_DIR, f))
  if (photos.length === 0) throw new Error(`${PHOTO_DIR}에 사진이 없습니다`)

  const runs: Run[] = []
  for (const photo of photos) {
    const jpeg = shrink(photo)
    for (const model of Object.keys(MODELS) as ModelName[]) {
      const run = await recognize(model, jpeg, basename(photo, extname(photo)))
      runs.push({ ...run, photo, jpeg })
      console.log(`${basename(photo)}  ${model.padEnd(14)} ${String(run.latencyMs).padStart(6)}ms  in ${run.usage.input}  out ${run.usage.output} (reasoning ${run.usage.reasoning})  $${run.costUsd.toFixed(5)}  items ${run.counts.sure}/${run.counts.guess}/${run.counts.hidden}  boxes ${run.counts.withBox}`)
    }
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
  const summary = Object.fromEntries((Object.keys(MODELS) as ModelName[]).map((m) => {
    const rs = runs.filter((r) => r.model === m)
    const avg = (f: (r: Run) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length
    return [m, { avgInputTokens: Math.round(avg((r) => r.usage.input)), avgCostUsd: avg((r) => r.costUsd), avgLatencyMs: Math.round(avg((r) => r.latencyMs)) }]
  }))
  writeFileSync(join(RESULT_DIR, `spike-box-${stamp}.json`), JSON.stringify({
    promptVersion: PROMPT_VERSION, maxSide: MAX_SIDE, reasoning: 'low', detail: 'original',
    prompt: recognizePrompt('<칸 이름>'), summary,
    runs: runs.map(({ jpeg: _jpeg, ...r }) => ({ ...r, photo: basename(r.photo) })),
  }, null, 2))
  writeFileSync(join(RESULT_DIR, `spike-box-${stamp}.html`), overlayHtml(runs))
  console.log('\n평균', JSON.stringify(summary))
  console.log(`결과: ${RESULT_DIR}/spike-box-${stamp}.json, .html`)
}

await main()
