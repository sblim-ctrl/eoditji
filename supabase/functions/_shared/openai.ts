// OpenAI Responses API 호출은 여기 한 곳. 대화 상태를 남기지 않고(store: false) 구조화 출력(strict)만 쓴다.
const API_URL = 'https://api.openai.com/v1/responses'
const TIMEOUT_MS = 60_000 // 인식이 10~20초 걸림 (D1 실측). 넘으면 끊고 직접 입력으로 넘김
const FLEX_TIMEOUT_MS = 600_000 // Flex는 대기열 때문에 훨씬 느릴 수 있다

export const VISION_MODEL = Deno.env.get('OPENAI_VISION_MODEL') ?? 'gpt-6.1-terra'
export const SEARCH_MODEL = Deno.env.get('OPENAI_SEARCH_MODEL') ?? 'gpt-6-luna'

export type Usage = { input: number; output: number; reasoning: number }
export type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'original' | 'high' | 'low' | 'auto' }

export class OpenAIError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Call = {
  model: string
  content: InputContent[]
  name: string
  schema: object
  reasoning: 'none' | 'low' | 'medium'
  flex?: boolean // 평가 스크립트 전용: 표준가의 50%, 대신 느림. 함수는 쓰지 않는다
}

export async function callStructured({ model, content, name, schema, reasoning, flex }: Call): Promise<{ data: unknown; usage: Usage; latencyMs: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new OpenAIError(500, 'OPENAI_API_KEY가 설정되지 않았습니다')

  const started = performance.now()
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(flex ? FLEX_TIMEOUT_MS : TIMEOUT_MS),
    body: JSON.stringify({
      model,
      store: false,
      ...(flex && { service_tier: 'flex' }),
      reasoning: { effort: reasoning },
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    }),
  })
  const latencyMs = Math.round(performance.now() - started)
  const body = await res.json()
  if (!res.ok) throw new OpenAIError(res.status, body.error?.message ?? 'unknown error')

  // 거절(refusal)이면 output_text가 없다
  const text = body.output?.flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === 'output_text')?.text
  if (typeof text !== 'string') throw new OpenAIError(502, '모델이 답을 내지 않았습니다')

  return {
    data: JSON.parse(text),
    usage: {
      input: body.usage?.input_tokens ?? 0,
      output: body.usage?.output_tokens ?? 0,
      reasoning: body.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    },
    latencyMs,
  }
}
