// Edge Function 공통: CORS, 로그인 확인, 오류를 화면용 코드로 바꾸기
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { OpenAIError } from './openai.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // 쿠키 없이 Bearer 토큰으로만 인증하므로 출처를 막을 이유가 없음
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// 플랫폼 verify_jwt는 새 API 키와 맞지 않아 꺼 두고(config.toml) 여기서 사용자를 확인한다.
// 돌려주는 클라이언트는 사용자 JWT로 DB를 조회하므로 RLS가 그대로 걸린다.
async function userClient(req: Request): Promise<SupabaseClient | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const publishable = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_ANON_KEY')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(authorization.slice('Bearer '.length))
  return error || !data.user ? null : supabase
}

// 일일 한도 (PRD 04 가드레일). 오늘 이 이벤트를 남긴 AI 호출 수를 센다 (0006_daily_limit.sql)
// shortcut: 성공한 호출만 이벤트가 남아 실패한 호출은 세지 않음, 실패가 많아 비용이 새면 호출 전에 기록하기
export async function isOverDailyLimit(supabase: SupabaseClient, eventName: string, max: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('ai_calls_today', { event_name: eventName })
  if (error) throw error
  return (data as number) >= max
}

// 서버 이벤트 (PRD 05 데이터 로깅). 기록에 실패해도 사용자 응답은 그대로 보낸다
export async function logEvent(supabase: SupabaseClient, name: string, props: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('events').insert({ name, props })
  if (error) console.error('event', name, error.message)
}

type Handler = (body: Record<string, unknown>, supabase: SupabaseClient) => Promise<Response>

export function serve(handler: Handler) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)

    const supabase = await userClient(req)
    if (!supabase) return json({ error: 'session_expired' }, 401)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad_request' }, 400)

    try {
      return await handler(body, supabase)
    } catch (e) {
      console.error(e)
      if (e instanceof DOMException && e.name === 'TimeoutError') return json({ error: 'ai_timeout' }, 504)
      if (e instanceof OpenAIError) return json({ error: e.status === 429 ? 'rate_limited' : 'ai_unavailable' }, 502)
      return json({ error: 'internal' }, 500)
    }
  })
}
