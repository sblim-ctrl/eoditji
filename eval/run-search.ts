// 검색 평가 (PRD 03 개선 전후 비교): 찾기 질문 30건을 v0·v1·v2(·v3)로 답하게 해 정답 서랍 일치율·지어낸 답·비용을 잰다.
// 실행: npm run eval:search -- --variant v0|v1|v2|v3 [--repeat 5]   (먼저 eval:recognize --size 1400)
// 기록은 정답표 81행 + 실제 인식 결과의 다른 이름 (D4 TBD #1). 인식 오류와 검색 오류가 섞이지 않게
// v2와 v3은 같은 단계별 검색이고, v3은 v2 실패를 보고 _shared 코드를 고친 뒤 다시 돈 결과에 붙이는 이름이다
import { SEARCH_MODEL } from '../supabase/functions/_shared/openai.ts'
import { exactMatch, keywordMatch } from '../supabase/functions/_shared/match.ts'
import { PROMPT_VERSION, type SearchCandidate, searchPrompt, searchSchema } from '../supabase/functions/_shared/prompts.ts'
import { cleanSearch } from '../supabase/functions/_shared/validate.ts'
import { arg, callFlex, costOf, pct, percentile, readCsv, RESULT_DIR, saveJson } from './common.ts'

const VARIANTS = ['v0', 'v1', 'v2', 'v3']
const MAX_CANDIDATES = 20 // search 함수와 같게
const MAX_PICK = 4 // 화면의 고르기 목록 개수 (useChatFlow)
const variant = arg('--variant') ?? ''
if (!VARIANTS.includes(variant)) throw new Error(`--variant는 ${VARIANTS.join('|')} 중 하나`)
const repeat = variant === 'v0' ? 1 : Number(arg('--repeat') ?? 1) // v0은 매번 같음
const isStaged = variant === 'v2' || variant === 'v3'

/* ---------- 기록과 질문 ---------- */
type Recognized = { photo: string; ai: { aliases: string[] }[]; pairs: { truth: number; ai: number }[] }
const recognized: Recognized[] = JSON.parse(Deno.readTextFileSync(`${RESULT_DIR}/recognize-1400.json`)).results
const byPhoto = Map.groupBy(readCsv('eval/photo_truth.csv'), (r) => r['사진'])
const inventory: SearchCandidate[] = [...byPhoto].flatMap(([photo, rows]) => {
  const rec = recognized.find((r) => r.photo === photo)
  return rows.map((r, i) => {
    const pair = rec?.pairs.find((p) => p.truth === i)
    return {
      id: `${photo}#${i}`, name: r['물건'], area: '', place: r['칸'],
      aliases: pair ? rec!.ai[pair.ai].aliases : [],
      inside: r['상태'] === '용기 안' ? r['비고'] : null,
    }
  })
})
const placeOf = new Map(inventory.map((it) => [it.id, it.place]))

type Question = { n: number; q: string; expected: string[]; answer: string; type: string }
const questions: Question[] = readCsv('eval/questions.csv').map((r) => ({
  n: Number(r['번호']), q: r['질문'], answer: r['정답_물건'], type: r['유형'],
  expected: r['정답_서랍'] === '없음' ? [] : r['정답_서랍'].split('·').map((s) => s.trim()),
}))

/* ---------- 1단계: DB의 search_candidates와 같은 정렬을 같은 pg_trgm으로 (읽기 쿼리만, 저장 안 함) ---------- */
function stage1(list: { n: number; q: string; include: string[] }[]): Map<number, string[]> {
  const items = inventory.map((it, ord) => ({ id: it.id, st: `${it.name} ${it.aliases.join(' ')}`, ord }))
  // 운영은 같은 점수면 최근에 찍은 칸이 먼저. 여기선 정답표 순서
  const sql = `select q.n, c.id from jsonb_to_recordset($j$${JSON.stringify(list)}$j$::jsonb) as q(n int, q text, include text[])
cross join lateral (
  select i.id, row_number() over (order by i.id = any (q.include) desc, extensions.word_similarity(q.q, i.st) desc, i.ord) as rk
  from jsonb_to_recordset($k$${JSON.stringify(items)}$k$::jsonb) as i(id text, st text, ord int)
) c where c.rk <= ${MAX_CANDIDATES} order by q.n, c.rk`
  const file = `${RESULT_DIR}/stage1.sql`
  Deno.writeTextFileSync(file, sql)
  const r = new Deno.Command('supabase', { args: ['db', 'query', '--linked', '-o', 'json', '-f', file], stdout: 'piped', stderr: 'piped' }).outputSync()
  if (!r.success) throw new Error(`1단계 쿼리 실패: ${new TextDecoder().decode(r.stderr)}`)
  const rows: { n: number; id: string }[] = JSON.parse(new TextDecoder().decode(r.stdout)).rows
  const out = new Map<number, string[]>()
  for (const row of rows) out.set(row.n, [...(out.get(row.n) ?? []), row.id])
  return out
}

/* ---------- 답하기 ---------- */
type Answer = { ids: string[]; confidence: string; stage: 0 | 2 | null; candidates: string[]; costUsd: number; latencyMs: number }

async function llm(q: string, candidates: SearchCandidate[]): Promise<Omit<Answer, 'stage'>> {
  const ids = candidates.map((c) => c.id)
  const { data, usage, latencyMs } = await callFlex({
    model: SEARCH_MODEL, reasoning: 'none', name: 'search', schema: searchSchema(ids),
    content: [{ type: 'input_text', text: searchPrompt(q, candidates) }],
  })
  const result = cleanSearch(data, ids)
  return { ids: result.itemIds, confidence: result.confidence, candidates: ids, costUsd: costOf(SEARCH_MODEL, usage), latencyMs }
}

const stage0 = new Map(questions.map((x) => [x.n, exactMatch(x.q, inventory)]))
const candidatesOf = isStaged
  ? stage1(questions.filter((x) => !stage0.get(x.n)!.hitId).map((x) => ({ n: x.n, q: x.q, include: stage0.get(x.n)!.ids })))
  : new Map<number, string[]>()

async function answer(x: Question): Promise<Answer> {
  if (variant === 'v0') {
    const id = keywordMatch(x.q, inventory)
    return { ids: id ? [id] : [], confidence: 'high', stage: null, candidates: [], costUsd: 0, latencyMs: 0 }
  }
  if (variant === 'v1') return { ...(await llm(x.q, inventory)), stage: 2 }
  const hit = stage0.get(x.n)!.hitId
  if (hit) return { ids: [hit], confidence: 'high', stage: 0, candidates: [], costUsd: 0, latencyMs: 0 }
  const ids = candidatesOf.get(x.n) ?? []
  return { ...(await llm(x.q, inventory.filter((it) => ids.includes(it.id)))), stage: 2 }
}

/* ---------- 채점 ---------- */
// 정답 서랍 일치 = 첫 번째 답의 칸이 정답 칸 (여러 개면 화면은 고르기 목록을 보여 줌). '없는 물건'은 아무것도 안 골라야 정답
const isCorrect = (x: Question, ids: string[]) => (x.expected.length ? !!ids[0] && x.expected.includes(placeOf.get(ids[0])!) : ids.length === 0)
// 화면 기준: 확신이 낮고 여러 개면 고르기 목록(최대 4개)이 뜨므로 그 안에 정답 칸이 있으면 맞음 (useChatFlow의 choose)
const shownIds = (a: Answer) => (a.confidence === 'low' && a.ids.length > 1 ? a.ids.slice(0, MAX_PICK) : a.ids.slice(0, 1))
const isShownCorrect = (x: Question, a: Answer) => (x.expected.length ? shownIds(a).some((id) => x.expected.includes(placeOf.get(id)!)) : a.ids.length === 0)
const isAlias = (x: Question) => /다른 (이름|표현)/.test(x.type)
// 1단계 recall: 정답 물건(이름이 정답표에 없으면 정답 칸의 아무 물건)이 후보에 들었나
const hasAnswer = (x: Question, ids: string[]) => ids.some((id) => {
  const it = inventory.find((i) => i.id === id)!
  return x.expected.includes(it.place) && (it.name === x.answer || !inventory.some((i) => i.name === x.answer))
})

const runs: { n: number; answer: Answer; isCorrect: boolean; isShownCorrect: boolean }[][] = []
for (let k = 0; k < repeat; k++) {
  const run = []
  for (const x of questions) {
    const a = await answer(x)
    run.push({ n: x.n, answer: a, isCorrect: isCorrect(x, a.ids), isShownCorrect: isShownCorrect(x, a) })
  }
  runs.push(run)
  console.log(`${k + 1}회: ${pct(run.filter((r) => r.isCorrect).length, run.length)}`)
}

const first = runs[0]
const get = (x: Question) => first.find((r) => r.n === x.n)!
const sub = (keep: (x: Question) => boolean) => {
  const xs = questions.filter(keep)
  return pct(xs.filter((x) => get(x).isCorrect).length, xs.length)
}
const s0 = first.filter((r) => r.answer.stage === 0)
const toLlm = questions.filter((x) => get(x).answer.stage === 2 && x.expected.length)
const all = runs.flat()
const top = (r: { answer: Answer }) => placeOf.get(r.answer.ids[0]) ?? '-'
const summary = {
  variant,
  promptVersion: variant === 'v0' ? '-' : PROMPT_VERSION,
  accuracy: sub(() => true),
  accuracyAnswerable: sub((x) => x.expected.length > 0),
  accuracyShown: pct(first.filter((r) => r.isShownCorrect).length, first.length),
  accuracy5RunsMean: pct(all.filter((r) => r.isCorrect).length, all.length),
  alias: sub(isAlias),
  fabricated: questions.filter((x) => !x.expected.length && get(x).answer.ids.length).length, // 없는 물건에 지어낸 답
  stage0Resolved: isStaged ? pct(s0.length, first.length) : '-',
  stage0Wrong: isStaged ? pct(s0.filter((r) => !r.isCorrect).length, s0.length) : '-',
  stage1Recall: isStaged ? pct(toLlm.filter((x) => hasAnswer(x, get(x).answer.candidates)).length, toLlm.length) : '-',
  costPerSearchUsd: +(all.reduce((n, r) => n + r.answer.costUsd, 0) / all.length).toFixed(6),
  llmLatencyFlexP95Ms: percentile(all.filter((r) => r.answer.stage === 2).map((r) => r.answer.latencyMs), 95),
  stable: repeat > 1 ? pct(questions.filter((x) => new Set(runs.map((run) => top(run.find((r) => r.n === x.n)!))).size === 1).length, questions.length) : '-',
  multiAnswers: first.filter((r) => r.answer.ids.length > 1).length,
}
console.table(summary)
const nameOf = (id: string) => `${inventory.find((i) => i.id === id)!.name} @ ${placeOf.get(id)}`
const failures = questions.filter((x) => !get(x).isCorrect).map((x) => ({
  n: x.n, type: x.type, q: x.q, expected: x.expected, got: get(x).answer.ids.map(nameOf),
  stage: get(x).answer.stage, recall: x.expected.length && isStaged ? hasAnswer(x, get(x).answer.candidates) : null,
}))
console.log(`틀린 질문 ${failures.length}건 (번호:유형):`, failures.map((f) => `${f.n}:${f.type}`).join(', '))
console.log('저장:', saveJson(`search-${variant}.json`, { summary, failures, runs }))
