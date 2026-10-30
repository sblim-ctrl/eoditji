// 프롬프트는 이 파일 한 곳에만 둔다. 내용을 바꾸면 PROMPT_VERSION을 올린다 (모든 로그에 남김).
// v1: D1 스파이크(eval/spike-box.ts) 프롬프트 + 대화 상대별 말투
export const PROMPT_VERSION = 'v1'

export type Persona = 'mom' | 'jarvis'

// 대화 상대별 말투 조각. 화면 문구는 src/lib/personas.ts
const VOICE: Record<Persona, { user: string; ask: string; askEx: string }> = {
  mom: { user: '자녀', ask: '엄마가 자녀에게 묻는 다정한 반말', askEx: '검정 파우치 안엔 뭐 들었어?' },
  jarvis: { user: '사용자', ask: 'AI 비서가 묻는 정중한 합쇼체', askEx: '검정 파우치 안에는 무엇이 들어 있습니까?' },
}

export function recognizePrompt(placeName: string, persona: Persona): string {
  const v = VOICE[persona]
  return `집 수납공간을 위에서 찍은 사진이야. 이 칸의 이름은 ${JSON.stringify(placeName)}이야.
사진 속 물건을 빠짐없이 적어 줘. 이어캡·건전지·케이블처럼 작은 물건도 놓치지 마.
- sure: 확실히 보이는 물건
- guess: 일부만 보여서 추정한 물건
- hidden: 파우치·상자·봉투처럼 안이 가려진 용기. 색이나 모양으로 구별되게 (예: "검정 파우치")
- 물건마다 box: 사진에서 그 물건을 감싸는 사각형 [x1, y1, x2, y2]. 사진 왼쪽 위가 (0, 0), 오른쪽 아래가 (1000, 1000)인 정수 좌표. 위치를 모르면 null.
- 물건마다 aliases: 사람들이 그 물건을 다르게 부르는 이름 3~6개 (별명·동의어·줄임말·용도. 예: 이어캡 → 이어팁, 에어팟 고무)
- questions: hidden 용기마다 안에 뭐가 있는지 묻는 질문, 최대 3개. ${v.ask} (예: "${v.askEx}"). target은 그 용기 이름.
- try: 이 칸의 물건을 찾는 질문 3개. ${v.user}가 묻는 짧은 반말로, 일부러 목록과 다른 이름(별명·동의어·용도)을 써 (예: 이어캡 → "이어팁 어디 있어?").
물건 이름은 집에서 흔히 부르는 짧은 한국어로 적어.`
}

const draftItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'box', 'aliases'],
  properties: {
    name: { type: 'string' },
    box: { type: ['array', 'null'], items: { type: 'integer' } },
    aliases: { type: 'array', items: { type: 'string' } },
  },
}

export const recognizeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sure', 'guess', 'hidden', 'questions', 'try'],
  properties: {
    sure: { type: 'array', items: draftItemSchema },
    guess: { type: 'array', items: draftItemSchema },
    hidden: { type: 'array', items: draftItemSchema },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'ask'],
        properties: { target: { type: 'string' }, ask: { type: 'string' } },
      },
    },
    try: { type: 'array', items: { type: 'string' } },
  },
}

// 검색 2단계에 넣는 후보 한 줄 (1단계 pg_trgm 결과)
export type SearchCandidate = { id: string; name: string; aliases: string[]; area: string; place: string; inside: string | null }

export function searchPrompt(question: string, candidates: SearchCandidate[]): string {
  const list = candidates.map((c) => ({ id: c.id, 이름: c.name, 다른이름: c.aliases, 공간: c.area, 칸: c.place, 담긴곳: c.inside }))
  return `집 수납공간 기록에서 물건을 찾고 있어. 아래는 후보 물건 목록이야.
${JSON.stringify(list)}

사용자가 한 말: ${JSON.stringify(question)}

- 다른 이름·줄임말·브랜드·용도로 물어도 같은 물건이면 골라 (예: 이어팁 = 이어캡 = 에어팟 고무).
- 후보에 없는 물건은 지어내지 마. 맞는 물건이 없으면 itemIds는 빈 배열.
- confidence: 이름이 같으면 high, 다른 이름·용도로 이어서 골랐으면 mid, 여러 개가 그럴듯하거나 확신이 없으면 low.
- 물건을 찾는 말이 아니면 intent는 other, itemIds는 빈 배열.`
}

// itemIds를 이번 후보 id의 enum으로 묶어 없는 물건은 형식 단계에서 나올 수 없게 한다 (PRD 05). 후보가 0개면 호출하지 않는다.
export function searchSchema(candidateIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['intent', 'itemIds', 'confidence'],
    properties: {
      intent: { type: 'string', enum: ['find', 'other'] },
      itemIds: { type: 'array', items: { type: 'string', enum: candidateIds } },
      confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
    },
  }
}
