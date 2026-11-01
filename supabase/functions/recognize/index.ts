// 사진 인식: 1400px JPEG(base64) → 초안(확실/추정/가려짐, 박스, 다른 이름, 질문, 추천 질문). 사진은 저장하지 않는다.
import { isOverDailyLimit, json, logEvent, serve } from '../_shared/http.ts'
import { callStructured, VISION_MODEL } from '../_shared/openai.ts'
import { type Persona, PROMPT_VERSION, recognizePrompt, recognizeSchema } from '../_shared/prompts.ts'
import { cleanRecognition } from '../_shared/validate.ts'

const MAX_IMAGE_BASE64 = 4_000_000 // 1400px JPEG는 보통 1MB 안팎, base64로 약 1.4MB
const JPEG_BASE64_PREFIX = '/9j/' // JPEG 시작 바이트 FF D8 FF
const MAX_PLACE_NAME = 50
const DAILY_LIMIT = 20

serve(async (body, supabase) => {
  const { image, placeName, persona } = body
  if (typeof image !== 'string' || !image.startsWith(JPEG_BASE64_PREFIX) || image.length > MAX_IMAGE_BASE64) {
    return json({ error: 'image_rejected' }, 400)
  }
  const name = typeof placeName === 'string' ? placeName.trim() : ''
  if (!name || name.length > MAX_PLACE_NAME) return json({ error: 'bad_request' }, 400)
  const voice: Persona = persona === 'jarvis' ? 'jarvis' : 'mom'
  if (await isOverDailyLimit(supabase, 'receive_draft', DAILY_LIMIT)) return json({ error: 'daily_limit' }, 429)

  const { data, usage, latencyMs } = await callStructured({
    model: VISION_MODEL,
    reasoning: 'low',
    name: 'recognize',
    schema: recognizeSchema,
    content: [
      { type: 'input_text', text: recognizePrompt(name, voice) },
      { type: 'input_image', image_url: `data:image/jpeg;base64,${image}`, detail: 'original' },
    ],
  })
  const draft = cleanRecognition(data)
  await logEvent(supabase, 'receive_draft', {
    sure: draft.sure.length, guess: draft.guess.length, hidden: draft.hidden.length,
    latency_ms: latencyMs, model: VISION_MODEL, prompt_version: PROMPT_VERSION, tokens: usage,
  })
  return json({ draft, model: VISION_MODEL, promptVersion: PROMPT_VERSION, usage, latencyMs })
})
