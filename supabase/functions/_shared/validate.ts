// LLM 출력은 믿지 않고 여기서 모양을 바로잡는다. Edge Function, 평가 스크립트가 같이 쓴다.
export type Box = [number, number, number, number]
export type DraftItem = { name: string; box: Box | null; aliases: string[] }
export type Question = { target: string; ask: string }
export type Recognition = { sure: DraftItem[]; guess: DraftItem[]; hidden: DraftItem[]; questions: Question[]; try: string[] }
export type Confidence = 'high' | 'mid' | 'low'
export type SearchResult = { intent: 'find' | 'other'; itemIds: string[]; confidence: Confidence; found: boolean }

const BOX_MAX = 1000
const MAX_ALIASES = 6
const MAX_QUESTIONS = 3
const MAX_TRY = 3
const CONFIDENCES: Confidence[] = ['high', 'mid', 'low']

export const strs = (v: unknown, n: number): string[] =>
  (Array.isArray(v) ? v : []).filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, n)

// "가위, 건전지" 같은 직접 입력을 물건 이름 목록으로. "없어"·"몰라"로 시작하면 빈 목록
export const splitItems = (t: string): string[] =>
  /^(없|몰라|모르)/.test(t.trim()) ? [] : t.split(/[,，、\n]/).map((s) => s.trim()).filter(Boolean)

// 개발계획 4절: 0~1000으로 자르고, 뒤집힌 축은 바꾸고, 넓이가 0이면 null
export function validateBox(box: unknown): Box | null {
  if (!Array.isArray(box) || box.length !== 4 || !box.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  const c = box.map((v: number) => Math.min(BOX_MAX, Math.max(0, Math.round(v))))
  const [x1, x2] = c[0] <= c[2] ? [c[0], c[2]] : [c[2], c[0]]
  const [y1, y2] = c[1] <= c[3] ? [c[1], c[3]] : [c[3], c[1]]
  return x2 > x1 && y2 > y1 ? [x1, y1, x2, y2] : null
}

type Loose = Record<string, unknown> | null | undefined

function draftItems(v: unknown): DraftItem[] {
  return (Array.isArray(v) ? v : []).flatMap((raw: Loose) => {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
    return name ? [{ name, box: validateBox(raw?.box), aliases: strs(raw?.aliases, MAX_ALIASES) }] : []
  })
}

export function cleanRecognition(raw: unknown): Recognition {
  const r = (raw ?? {}) as Record<string, unknown>
  const questions = (Array.isArray(r.questions) ? r.questions : []).flatMap((q: Loose) =>
    typeof q?.target === 'string' && typeof q?.ask === 'string' && q.ask.trim()
      ? [{ target: q.target.trim(), ask: q.ask.trim() }]
      : [])
  return {
    sure: draftItems(r.sure),
    guess: draftItems(r.guess),
    hidden: draftItems(r.hidden),
    questions: questions.slice(0, MAX_QUESTIONS),
    try: strs(r.try, MAX_TRY),
  }
}

// 후보 밖의 id는 버린다 (스키마 enum이 1차 방어, 여기가 2차). 남는 게 없으면 found=false
export function cleanSearch(raw: unknown, candidateIds: string[]): SearchResult {
  const r = (raw ?? {}) as Record<string, unknown>
  const intent = r.intent === 'other' ? 'other' : 'find'
  const allowed = new Set(candidateIds)
  const itemIds = intent === 'other' ? [] : [...new Set(strs(r.itemIds, Infinity))].filter((id) => allowed.has(id))
  const confidence = CONFIDENCES.includes(r.confidence as Confidence) ? (r.confidence as Confidence) : 'low'
  return { intent, itemIds, confidence, found: itemIds.length > 0 }
}
