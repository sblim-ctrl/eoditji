// 검색 1·2단계: 0단계(브라우저)에서 못 찾은 질문만 온다. pg_trgm 후보 → 작은 LLM이 후보 안에서만 고름.
import { isOverDailyLimit, json, logEvent, serve } from '../_shared/http.ts'
import { callStructured, SEARCH_MODEL, type Usage } from '../_shared/openai.ts'
import { PROMPT_VERSION, type SearchCandidate, searchPrompt, searchSchema } from '../_shared/prompts.ts'
import { cleanSearch, type SearchResult, strs } from '../_shared/validate.ts'

const MAX_QUESTION = 200
const MAX_CANDIDATES = 20
const DAILY_LIMIT = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (body, supabase) => {
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question || question.length > MAX_QUESTION) return json({ error: 'bad_request' }, 400)
  // 0단계에서 여러 개 걸린 물건은 후보에 반드시 넣는다
  const includeIds = strs(body.includeIds, MAX_CANDIDATES).filter((id) => UUID.test(id))

  // 사용자 JWT로 조회하므로 남의 그룹이나 공유를 끈 칸은 후보에 나오지 않는다
  const { data, error } = await supabase.rpc('search_candidates', { q: question, include_ids: includeIds, max_count: MAX_CANDIDATES })
  if (error) throw error
  const candidates = data as SearchCandidate[]
  const meta = { candidateCount: candidates.length, promptVersion: PROMPT_VERSION }
  const seen = (result: SearchResult, model: string | null, usage: Usage | null, latencyMs: number) =>
    logEvent(supabase, 'view_search_result', {
      found: result.found, confidence: result.confidence, resolved_by: model ? 'llm' : 'no_candidates',
      candidate_count: candidates.length, latency_ms: latencyMs, model, prompt_version: PROMPT_VERSION, tokens: usage,
    })
  if (candidates.length === 0) {
    const result = cleanSearch(null, [])
    await seen(result, null, null, 0)
    return json({ result, model: null, usage: null, latencyMs: 0, ...meta })
  }
  if (await isOverDailyLimit(supabase, 'view_search_result', DAILY_LIMIT)) return json({ error: 'daily_limit' }, 429)

  const ids = candidates.map((c) => c.id)
  const { data: raw, usage, latencyMs } = await callStructured({
    model: SEARCH_MODEL,
    reasoning: 'none',
    name: 'search',
    schema: searchSchema(ids),
    content: [{ type: 'input_text', text: searchPrompt(question, candidates) }],
  })
  const result = cleanSearch(raw, ids)
  await seen(result, SEARCH_MODEL, usage, latencyMs)
  return json({ result, model: SEARCH_MODEL, usage, latencyMs, ...meta })
})
