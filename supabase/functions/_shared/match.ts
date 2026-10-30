// 0단계 검색과 v0 기준선. 브라우저(@shared), Edge Function, 평가 스크립트가 같이 쓰므로 Deno·DOM API를 쓰지 않는다.
export type MatchItem = { id: string; name: string; aliases: string[] }
export type MatchResult = { hitId: string | null; ids: string[] }

// 물건 이름이 아닌 말. 질문 끝의 "어디 있어"류는 띄어쓰기 없이 말해도 떼어 낸다
const ENDING = /\s*(어디\s*(에\s*)?(있어|있지|있더라|뒀어|뒀지|뒀더라|야)?|어딨어|어딨지|어딨더라)\s*$/
const STOP_WORDS = new Set(['어디', '어딨어', '있어', '있지', '뒀어', '뒀더라', '엄마', '그거', '내', '좀', '찾아', '찾아줘', '줘'])
const PARTICLE = /(은|는|이|가|을|를|도|좀)$/

const key = (s: string) => s.toLowerCase().replace(/\s+/g, '')

function words(q: string): string[] {
  return q.toLowerCase().replace(/[?？!.,~…]/g, ' ').trim().replace(ENDING, '')
    .split(/\s+/).filter((w) => w && !STOP_WORDS.has(w))
}

const stripLast = (ws: string[]) => [...ws.slice(0, -1), ws[ws.length - 1].replace(PARTICLE, '')]

// 질문 전체를 이은 키 ("검정 파우치는" → 검정파우치는, 검정파우치)
function wholeKeys(ws: string[]): Set<string> {
  return ws.length ? new Set([ws.join(''), stripLast(ws).join('')]) : new Set()
}

// 비교용 키: 질문 전체 + 낱말마다 그대로와 조사를 뗀 형태
export function questionKeys(q: string): Set<string> {
  const ws = words(q)
  return new Set([...wholeKeys(ws), ...ws, ...ws.map((w) => w.replace(PARTICLE, '')).filter(Boolean)])
}

function matching(items: MatchItem[], keys: Set<string>): string[] {
  return items.filter((it) => [it.name, ...it.aliases].some((t) => keys.has(key(t)))).map((it) => it.id)
}

// 0단계: 이름·다른 이름과 정확히 하나만 일치할 때만 답한다. 여러 개면 1단계 후보로 넘긴다.
// 질문 전체가 일치하는 물건이 있으면 그것만 본다 ("AA 건전지"가 다른 이름 "건전지"인 AAA까지 끌어오지 않게)
export function exactMatch(q: string, items: MatchItem[]): MatchResult {
  const whole = matching(items, wholeKeys(words(q)))
  const ids = whole.length ? whole : matching(items, questionKeys(q))
  return { hitId: ids.length === 1 ? ids[0] : null, ids }
}

// v0 기준선이자 OpenAI 장애 때의 대체 검색: 글자가 겹치는 첫 물건 (동의어는 못 찾음). 프로토타입 keywordSearch
export function keywordMatch(q: string, items: MatchItem[]): string | null {
  const ks = [...questionKeys(q)].filter((w) => w.length >= 2)
  return items.find((it) => {
    const n = key(it.name)
    return n && ks.some((w) => n.includes(w) || w.includes(n))
  })?.id ?? null
}
