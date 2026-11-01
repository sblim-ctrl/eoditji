// 체크포인트 ①: 계정 A·B를 만들어 B가 A의 칸·물건·사진에 손댈 수 없는지 확인한다.
// 실행: npm run rls-check  (원격 DB에 임시 계정을 만들고 끝나면 지움)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !publishableKey || !secretKey) {
  throw new Error('.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 필요합니다')
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, secretKey, noSession)

type Account = { id: string; client: SupabaseClient; groupId: string }

const results: { name: string; ok: boolean; detail?: string }[] = []
function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  (${detail})` : ''}`)
}

async function makeAccount(label: string): Promise<Account> {
  const email = `rls-${label}-${Date.now()}@example.com`
  const password = crypto.randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error

  const client = createClient(url!, publishableKey!, noSession)
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error

  const groups = await client.from('groups').select('id, name')
  const members = await client.from('group_members').select('role').eq('user_id', data.user.id)
  const profile = await client.from('profiles').select('id').eq('id', data.user.id)
  check(`${label}: 가입하면 "내 집" 그룹 하나가 생김`,
    groups.data?.length === 1 && groups.data[0].name === '내 집', groups.error?.message)
  check(`${label}: owner 멤버십과 profiles 행이 생김`,
    members.data?.[0]?.role === 'owner' && profile.data?.length === 1,
    members.error?.message ?? profile.error?.message)

  return { id: data.user.id, client, groupId: groups.data?.[0]?.id ?? '' }
}

async function main() {
  const a = await makeAccount('A')
  const b = await makeAccount('B')
  const photoPaths: string[] = []

  try {
    check('A와 B의 "내 집"은 서로 다른 그룹', a.groupId !== '' && a.groupId !== b.groupId)

    // A가 칸·물건·사진을 만든다 (권한 부여가 빠졌으면 여기서 실패)
    const place = await a.client.from('places')
      .insert({ group_id: a.groupId, area: '책상', name: '왼쪽 첫째 서랍', created_by: a.id })
      .select('id').single()
    check('A: 자기 그룹에 칸 추가', !place.error, place.error?.message)
    const placeId: string = place.data?.id ?? crypto.randomUUID()

    const item = await a.client.from('items')
      .insert({ place_id: placeId, group_id: a.groupId, name: '여권', level: 'sure', source: 'ai', aliases: ['패스포트'] })
      .select('id').single()
    check('A: 자기 칸에 물건 추가', !item.error, item.error?.message)

    // D4-2 쓰면서 배우기: 화면이 items.aliases를 직접 바꾼다
    const learn = await a.client.from('items').update({ aliases: ['패스포트', '해외 갈 때 필요한 거'] }).eq('id', item.data?.id).select('search_text')
    check('A: 자기 물건의 다른 이름 바꾸기 (search_text도 바뀜)',
      learn.data?.length === 1 && String(learn.data[0].search_text).includes('해외'), learn.error?.message)

    const photoPath = `${a.groupId}/${placeId}/${Date.now()}.jpg`
    const upload = await a.client.storage.from('photos').upload(photoPath, new Uint8Array([0xff, 0xd8, 0xff]), { contentType: 'image/jpeg' })
    check('A: 자기 그룹 폴더에 사진 올리기', !upload.error, upload.error?.message)
    if (!upload.error) photoPaths.push(photoPath)

    const aRead = await a.client.storage.from('photos').download(photoPath)
    check('A: 자기 사진 읽기', !aRead.error, aRead.error?.message)

    // save_place: 저장 → 썸네일 올리기 → photo_path 갱신 → 같은 이름으로 다시 저장 (D2 TBD #2 순서)
    const firstItems = [
      { name: '건전지', level: 'sure', source: 'ai', box: [10, 20, 300, 400], box_source: 'ai', aliases: ['배터리'] },
      { name: ' ', level: 'guess', source: 'ai' },
    ]
    const saved = await a.client.rpc('save_place', { group_id: a.groupId, area: ' 거실 ', name: '티비장 서랍 ', items: firstItems }).single<{ place_id: string; old_photo_path: string | null }>()
    const savedId = saved.data?.place_id ?? crypto.randomUUID()
    const savedRow = await a.client.from('places').select('area, name, items(name, box, aliases)').eq('id', savedId).single()
    check('A: save_place로 칸과 물건 저장 (공백 정리, 빈 이름 건너뜀, 박스·aliases 보존)',
      !saved.error && savedRow.data?.area === '거실' && savedRow.data?.name === '티비장 서랍'
        && savedRow.data?.items.length === 1 && savedRow.data.items[0].box?.[2] === 300
        && savedRow.data.items[0].aliases?.[0] === '배터리',
      saved.error?.message ?? savedRow.error?.message)

    const thumbPath = `${a.groupId}/${savedId}/${Date.now()}.jpg`
    const thumb = await a.client.storage.from('photos').upload(thumbPath, new Uint8Array([0xff, 0xd8, 0xff]), { contentType: 'image/jpeg' })
    if (!thumb.error) photoPaths.push(thumbPath)
    const setPhoto = await a.client.from('places').update({ photo_path: thumbPath }).eq('id', savedId).select('id')
    check('A: 썸네일 올리고 photo_path 갱신', !thumb.error && setPhoto.data?.length === 1, thumb.error?.message ?? setPhoto.error?.message)

    const resaved = await a.client.rpc('save_place', { group_id: a.groupId, area: '거실', name: '티비장 서랍', items: [{ name: '리모컨', level: 'told', source: 'user' }] }).single<{ place_id: string; old_photo_path: string | null }>()
    const resavedRow = await a.client.from('places').select('photo_path, items(name)').eq('id', savedId).single()
    check('A: 같은 공간·이름으로 다시 저장 → 같은 칸, 물건 교체, photo_path 비우고 예전 경로 돌려줌',
      resaved.data?.place_id === savedId && resaved.data?.old_photo_path === thumbPath
        && resavedRow.data?.photo_path === null && resavedRow.data?.items.map((i) => i.name).join() === '리모컨',
      resaved.error?.message ?? resavedRow.error?.message)

    // B는 A의 것에 손댈 수 없어야 한다
    const bPlaces = await b.client.from('places').select('id').eq('id', placeId)
    check('B: A의 칸 읽기 → 0행', bPlaces.data?.length === 0, bPlaces.error?.message)

    const bItems = await b.client.from('items').select('id').eq('place_id', placeId)
    check('B: A의 물건 읽기 → 0행', bItems.data?.length === 0, bItems.error?.message)

    const bInsertPlace = await b.client.from('places')
      .insert({ group_id: a.groupId, name: '몰래 넣은 칸', created_by: b.id })
    check('B: A의 그룹에 칸 추가 → 거절', !!bInsertPlace.error)

    const bInsertItem = await b.client.from('items')
      .insert({ place_id: placeId, group_id: a.groupId, name: '몰래 넣은 물건', level: 'told', source: 'user' })
    check('B: A의 칸에 물건 추가 → 거절', !!bInsertItem.error)

    const bUpdate = await b.client.from('places').update({ name: '바뀐 이름' }).eq('id', placeId).select('id')
    const bDelete = await b.client.from('items').delete().eq('place_id', placeId).select('id')
    const bLearn = await b.client.from('items').update({ aliases: ['바뀐 이름'] }).eq('place_id', placeId).select('id')
    check('B: A의 물건 다른 이름 바꾸기 → 0행', bLearn.data?.length === 0, bLearn.error?.message)
    const after = await admin.from('places').select('name, items(id)').eq('id', placeId).single()
    check('B: A의 칸 수정·물건 삭제 → 0행, A의 데이터 그대로',
      bUpdate.data?.length === 0 && bDelete.data?.length === 0
        && after.data?.name === '왼쪽 첫째 서랍' && after.data?.items.length === 1,
      bUpdate.error?.message ?? bDelete.error?.message ?? after.error?.message)

    const bDownload = await b.client.storage.from('photos').download(photoPath)
    check('B: A의 사진 읽기 → 거절', !!bDownload.error)

    const bSigned = await b.client.storage.from('photos').createSignedUrl(photoPath, 60)
    check('B: A의 사진 서명 URL 만들기 → 거절', !!bSigned.error)

    const bUploadPath = `${a.groupId}/${crypto.randomUUID()}/${Date.now()}.jpg`
    const bUpload = await b.client.storage.from('photos').upload(bUploadPath, new Uint8Array([0xff]), { contentType: 'image/jpeg' })
    check('B: A의 그룹 폴더에 사진 올리기 → 거절', !!bUpload.error)
    if (!bUpload.error) photoPaths.push(bUploadPath)

    const bSave = await b.client.rpc('save_place', { group_id: a.groupId, area: '', name: '몰래 넣은 칸', items: [] })
    check('B: A의 그룹으로 save_place → 거절', !!bSave.error)

    const bSaveSame = await b.client.rpc('save_place', { group_id: a.groupId, area: '거실', name: '티비장 서랍', items: [] })
    const aItemsAfter = await admin.from('items').select('id').eq('place_id', savedId)
    check('B: A의 칸과 같은 이름으로 save_place → 거절, A의 물건 그대로',
      !!bSaveSame.error && aItemsAfter.data?.length === 1, aItemsAfter.error?.message)

    // RLS에 막힌 삭제는 에러 없이 0건이므로 파일이 남았는지로 확인
    await b.client.storage.from('photos').remove([thumbPath])
    const stillThere = await admin.storage.from('photos').exists(thumbPath)
    check('B: A의 사진 지우기 → 파일 그대로', stillThere.data === true, stillThere.error?.message)

    const aRemove = await a.client.storage.from('photos').remove([thumbPath])
    const gone = await admin.storage.from('photos').exists(thumbPath)
    check('A: 다시 저장한 뒤 예전 썸네일 지우기', !aRemove.error && gone.data === false, aRemove.error?.message)

    const bGroups = await b.client.from('groups').select('id').eq('id', a.groupId)
    check('B: A의 그룹 읽기 → 0행', bGroups.data?.length === 0, bGroups.error?.message)
  } finally {
    // 칸이 남아 있는 상태에서 계정 삭제 (0003에서 고친 버그의 회귀 확인)
    const deleteA = await admin.auth.admin.deleteUser(a.id)
    check('A: 기록한 칸이 있어도 계정 삭제 가능', !deleteA.error, deleteA.error?.message)

    // 임시 데이터 정리 (그룹을 지우면 칸·물건도 함께 지워짐)
    const cleanup = [
      photoPaths.length ? (await admin.storage.from('photos').remove(photoPaths)).error : null,
      (await admin.auth.admin.deleteUser(b.id)).error,
      (await admin.from('groups').delete().in('id', [a.groupId, b.groupId])).error,
    ].filter((e) => e !== null)
    for (const e of cleanup) console.error(`정리 실패: ${e.message}`)
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} 통과`)
  if (failed) process.exit(1)
}

await main()
