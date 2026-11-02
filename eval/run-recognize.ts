// 인식 평가 (PRD 03): 사진 10장을 한 크기로 줄여 함수와 같은 프롬프트로 인식 → 정답표와 짝지어 인식률·비용을 잰다.
// 실행: npm run eval:recognize -- --size 768|1024|1400   (Flex 처리, 결과는 eval/results/recognize-<size>.json)
// luna 비교: OPENAI_VISION_MODEL=gpt-6-luna npm run eval:recognize -- --size 1400
// 지연은 Flex 대기열이 섞여 운영보다 느리다. p95 지연은 운영 이벤트(receive_draft.latency_ms)로 본다.
import { VISION_MODEL } from '../supabase/functions/_shared/openai.ts'
import { recognizePrompt, recognizeSchema } from '../supabase/functions/_shared/prompts.ts'
import { cleanRecognition } from '../supabase/functions/_shared/validate.ts'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { arg, callFlex, costOf, pct, percentile, readCsv, saveJson } from './common.ts'

const SIZES = [768, 1024, 1400]
const WORK_DIR = 'eval/photos/.work' // 줄인 사진도 실제 집 사진이라 photos/ 아래(커밋 안 함)에 둠
const JUDGE_MODEL = 'gpt-6.1-terra'

const size = Number(arg('--size') ?? 1400)
if (!SIZES.includes(size)) throw new Error(`--size는 ${SIZES.join('|')} 중 하나`)

type Truth = { name: string; isSmall: boolean; state: string }
type AiItem = { name: string; level: 'sure' | 'guess' | 'hidden'; box: number[] | null; aliases: string[] }

const truth = new Map<string, { place: string; items: Truth[] }>()
for (const r of readCsv('eval/photo_truth.csv')) {
  const photo = truth.get(r['사진']) ?? { place: r['칸'], items: [] }
  photo.items.push({ name: r['물건'], isSmall: r['작은_물건'] === 'O', state: r['상태'] })
  truth.set(r['사진'], photo)
}

function shrink(photo: string): string {
  Deno.mkdirSync(WORK_DIR, { recursive: true })
  const out = `${WORK_DIR}/${photo}-${size}.jpg`
  const r = new Deno.Command('sips', { args: ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', '-Z', String(size), `eval/photos/${photo}.png`, '--out', out], stdout: 'null', stderr: 'piped' }).outputSync()
  if (!r.success) throw new Error(`sips 실패: ${photo} ${new TextDecoder().decode(r.stderr)}`)
  return encodeBase64(Deno.readFileSync(out))
}

// 이름이 조금 달라도 같은 실물이면 짝짓는다 (사람이 눈으로 맞추던 일을 같은 기준으로 반복하려고 LLM에 맡김)
const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['pairs'],
  properties: {
    pairs: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['truth', 'ai'], properties: { truth: { type: 'integer' }, ai: { type: 'integer' } } },
    },
  },
}

async function judge(place: string, items: Truth[], ai: AiItem[]) {
  const text = `서랍 "${place}" 사진의 실제 물건 정답표와 AI가 사진에서 찾은 물건 목록이야.
정답표: ${JSON.stringify(items.map((t, i) => ({ i, 이름: t.name })))}
AI 목록: ${JSON.stringify(ai.map((a, i) => ({ i, 이름: a.name })))}

같은 실물을 가리키는 것끼리 짝지어 줘 (truth = 정답표 i, ai = AI 목록 i).
- 이름이 달라도 같은 물건이면 짝 (예: "회색 벨벳 파우치" = "회색 파우치", "VOVA 보조배터리" = "보조배터리").
- 종류가 다르면 짝짓지 마 (예: 볼펜 ≠ 연필). 애매하면 짝짓지 마.
- 정답 하나에 AI 하나, AI 하나에 정답 하나만.`
  const { data, usage } = await callFlex({ model: JUDGE_MODEL, reasoning: 'low', name: 'judge', schema: judgeSchema, content: [{ type: 'input_text', text }] })
  const seenTruth = new Set<number>(), seenAi = new Set<number>()
  const pairs = (data as { pairs: { truth: number; ai: number }[] }).pairs.filter((p) => {
    const isValid = items[p.truth] && ai[p.ai] && !seenTruth.has(p.truth) && !seenAi.has(p.ai)
    if (isValid) { seenTruth.add(p.truth); seenAi.add(p.ai) }
    return isValid
  })
  return { pairs, usage }
}

const results = []
for (const [photo, { place, items }] of truth) {
  const image = shrink(photo)
  const { data, usage, latencyMs } = await callFlex({
    model: VISION_MODEL,
    reasoning: 'low',
    name: 'recognize',
    schema: recognizeSchema,
    content: [
      { type: 'input_text', text: recognizePrompt(place, 'mom') },
      { type: 'input_image', image_url: `data:image/jpeg;base64,${image}`, detail: 'original' },
    ],
  })
  const draft = cleanRecognition(data)
  const ai: AiItem[] = (['sure', 'guess', 'hidden'] as const).flatMap((level) => draft[level].map((d) => ({ name: d.name, level, box: d.box, aliases: d.aliases })))
  const matched = await judge(place, items, ai)
  results.push({ photo, place, truth: items, ai, pairs: matched.pairs, usage, latencyMs, judgeUsage: matched.usage })
  console.log(`${photo}: AI ${ai.length}개, 짝 ${matched.pairs.length}/${items.length}, ${latencyMs}ms`)
}

// 보이는 물건 = '용기 안'이 아닌 것 (보임 + 일부 가려짐)
const rows = results.flatMap((r) => r.truth.map((t, i) => ({ ...t, isFound: r.pairs.some((p) => p.truth === i) })))
const count = (keep: (t: (typeof rows)[number]) => boolean) => {
  const xs = rows.filter(keep)
  return pct(xs.filter((t) => t.isFound).length, xs.length)
}
const aiTotal = results.reduce((n, r) => n + r.ai.length, 0)
const paired = results.reduce((n, r) => n + r.pairs.length, 0)
const costs = results.map((r) => costOf(VISION_MODEL, r.usage))
const summary = {
  size,
  model: VISION_MODEL,
  visible: count((t) => t.state !== '용기 안'),
  shown: count((t) => t.state === '보임'),
  partlyHidden: count((t) => t.state === '일부 가려짐'),
  small: count((t) => t.isSmall && t.state !== '용기 안'),
  extra: pct(aiTotal - paired, aiTotal), // 정답표에 없는 AI 물건 (오검출이거나 정답표가 빠뜨린 것)
  costPerCallUsd: +(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(5),
  inputTokensAvg: Math.round(results.reduce((n, r) => n + r.usage.input, 0) / results.length),
  latencyFlexP50Ms: percentile(results.map((r) => r.latencyMs), 50),
  latencyFlexP95Ms: percentile(results.map((r) => r.latencyMs), 95),
}
console.table(summary)
// 기본(terra)이 아닌 모델은 파일 이름에 붙여 기준 결과(검색 평가가 읽음)를 덮지 않는다
const suffix = VISION_MODEL === 'gpt-6.1-terra' ? '' : `-${VISION_MODEL}`
console.log('저장:', saveJson(`recognize-${size}${suffix}.json`, { summary, results }))
