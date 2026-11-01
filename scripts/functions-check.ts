// D2-3: 배포된 recognize·search 함수를 임시 계정으로 호출해 응답 형식, 인증, 잘못된 입력, RLS를 확인한다.
// D4-1: 서버 이벤트(receive_draft, view_search_result)와 일일 한도 429도 확인한다.
// 실행: npm run functions-check  (OpenAI 호출 3회, 약 $0.01. 끝나면 임시 계정과 그 이벤트를 지움)
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !publishableKey || !secretKey) {
  throw new Error('.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다')
}
const PHOTO = 'eval/photos/.work/IMG_0510-1400.jpg' // D1 스파이크가 만든 1400px JPEG (커밋 안 함)

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secretKey, noSession)

const results: boolean[] = []
function check(name: string, ok: boolean, detail?: unknown) {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  (${JSON.stringify(detail)})` : ''}`)
}

async function call(fn: 'recognize' | 'search', body: unknown, token?: string) {
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { apikey: publishableKey!, 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function makeAccount(label: string) {
  const email = `fn-${label}-${Date.now()}@example.com`
  const password = crypto.randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  const client = createClient(url!, publishableKey!, noSession)
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  const group = await client.from('groups').select('id').single()
  if (group.error) throw group.error
  return { id: data.user.id, client, token: signIn.data.session.access_token, groupId: group.data.id as string }
}

async function main() {
  const a = await makeAccount('a')
  const b = await makeAccount('b')
  try {
    check('토큰 없이 search → 401', (await call('search', { question: '가위' })).status === 401)
    check('토큰 없이 recognize → 401', (await call('recognize', { image: '/9j/', placeName: '서랍' })).status === 401)
    check('빈 질문 → 400', (await call('search', { question: '  ' }, a.token)).status === 400)
    const notImage = await call('recognize', { image: 'aGVsbG8=', placeName: '서랍' }, a.token)
    check('이미지가 아닌 입력 → 400 image_rejected', notImage.status === 400 && notImage.body?.error === 'image_rejected', notImage)

    const empty = await call('search', { question: '가위 어디 있어?' }, a.token)
    check('기록이 없으면 LLM 없이 found=false', empty.status === 200 && empty.body.result.found === false && empty.body.model === null, empty)

    const place = await a.client.from('places').insert({ group_id: a.groupId, area: '책상', name: '왼쪽 첫째 서랍' }).select('id').single()
    if (place.error) throw place.error
    const items = await a.client.from('items').insert([
      { place_id: place.data.id, group_id: a.groupId, name: '이어캡', level: 'sure', source: 'ai', aliases: ['이어팁', '에어팟 고무'] },
      { place_id: place.data.id, group_id: a.groupId, name: '가위', level: 'sure', source: 'ai', aliases: ['자르는 거'] },
      { place_id: place.data.id, group_id: a.groupId, name: '검정 파우치', level: 'hidden', source: 'ai', aliases: ['검은 주머니'] },
    ]).select('id, name')
    if (items.error) throw items.error
    const capId = items.data.find((i) => i.name === '이어캡')!.id

    const synonym = await call('search', { question: '이어폰 끝에 끼우는 고무 어디 있어?' }, a.token)
    check('다른 이름으로 물어도 이어캡을 찾음 (2단계 LLM)', synonym.status === 200 && synonym.body.result.itemIds.includes(capId), synonym.body)
    check('응답에 모델·프롬프트 버전·토큰이 있음', !!synonym.body?.model && synonym.body?.promptVersion === 'v1' && synonym.body?.usage?.input > 0, synonym.body)

    const logged = await admin.from('events').select('props').eq('user_id', a.id).eq('name', 'view_search_result')
    check('검색하면 서버가 view_search_result를 남김 (모델·토큰 포함)',
      !!logged.data?.some((e) => e.props.model && e.props.resolved_by === 'llm' && e.props.tokens?.input > 0), logged.error ?? logged.data)

    const missing = await call('search', { question: '손톱깎이 어디 있어?' }, a.token)
    check('없는 물건 → found=false', missing.status === 200 && missing.body.result.found === false, missing.body)

    const other = await call('search', { question: '이어캡 어디 있어?' }, b.token)
    check('B에게는 A의 물건이 후보로 나오지 않음 (RLS)', other.status === 200 && other.body.candidateCount === 0, other.body)

    // 한도는 오늘 남긴 AI 호출 이벤트 수로 센다. 가짜 이벤트를 채워 OpenAI를 부르지 않고 확인한다
    const fill = (userId: string, name: string, n: number) =>
      admin.from('events').insert(Array.from({ length: n }, () => ({ user_id: userId, name, props: { model: 'check' } })))
    if ((await fill(b.id, 'receive_draft', 20)).error) throw new Error('이벤트 채우기 실패')
    const overRec = await call('recognize', { image: '/9j/AAAA', placeName: '서랍' }, b.token)
    check('인식 20회를 넘기면 429 daily_limit', overRec.status === 429 && overRec.body?.error === 'daily_limit', overRec)
    if ((await fill(a.id, 'view_search_result', 100)).error) throw new Error('이벤트 채우기 실패')
    const overSearch = await call('search', { question: '이어폰 끝에 끼우는 고무 어디 있어?' }, a.token)
    check('검색 100회를 넘기면 429 daily_limit', overSearch.status === 429 && overSearch.body?.error === 'daily_limit', overSearch)

    if (existsSync(PHOTO)) {
      const image = readFileSync(PHOTO).toString('base64')
      const rec = await call('recognize', { image, placeName: '책상 서랍', persona: 'mom' }, a.token)
      const count = rec.body?.draft ? rec.body.draft.sure.length + rec.body.draft.guess.length + rec.body.draft.hidden.length : 0
      check('실제 사진 인식 → 초안에 물건이 있음 (B가 한도에 걸려도 A는 됨)', rec.status === 200 && count > 0, rec.status === 200 ? { count } : rec)
      if (rec.status === 200) console.log(`      물건 ${count}개, ${rec.body.latencyMs}ms, 입력 ${rec.body.usage.input} / 출력 ${rec.body.usage.output} 토큰`)
    } else {
      console.log(`SKIP  실제 사진 인식 (${PHOTO} 없음. npm run spike를 먼저 돌리면 생김)`)
    }
  } finally {
    const cleanup = [
      (await admin.from('events').delete().in('user_id', [a.id, b.id])).error,
      (await admin.auth.admin.deleteUser(a.id)).error,
      (await admin.auth.admin.deleteUser(b.id)).error,
      (await admin.from('groups').delete().in('id', [a.groupId, b.groupId])).error,
    ].filter((e) => e !== null)
    for (const e of cleanup) console.error(`정리 실패: ${e.message}`)
  }

  const failed = results.filter((ok) => !ok).length
  console.log(`\n${results.length - failed}/${results.length} 통과`)
  if (failed) process.exit(1)
}

await main()
