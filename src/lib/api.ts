// 화면에서 부르는 Supabase 호출 모음. 모두 사용자 세션으로 부르므로 RLS가 그대로 걸린다.
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { Persona } from '@shared/prompts.ts'
import type { Box } from '@shared/validate.ts'
import { supabase } from '@/lib/supabase'

const BUCKET = 'photos'
const SIGNED_URL_SECONDS = 60 * 60

export type Level = 'sure' | 'guess' | 'hidden' | 'told'
export type Item = {
  id?: string // 저장 전 초안에는 없음
  name: string
  level: Level
  inside: string | null
  box: Box | null
  aliases: string[]
  source: 'ai' | 'user'
  boxSource?: 'ai' | 'user' | null // 박스를 사람이 고쳤으면 user. 없으면 source를 따름
}
export type Place = {
  id: string
  groupId: string
  area: string
  name: string
  photoPath: string | null
  photoUrl: string | null
  capturedAt: string
  items: Item[]
}

// 화면에 보여 줄 오류 코드 (personas.ts trouble의 키)
export class ApiError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}
export const errorCode = (e: unknown): string => (e instanceof ApiError ? e.code : 'default')

export async function callFunction<T>(name: 'recognize' | 'search', body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return data as T
  const code = error instanceof FunctionsHttpError
    ? await (error.context as Response).json().then((b) => b?.error, () => null)
    : null
  throw new ApiError(code ?? 'default')
}

// "책상 · 왼쪽 첫째 서랍". 공간이 없으면 칸 이름만
export const placeLabel = (p: { area: string; name: string }): string => (p.area ? `${p.area} · ${p.name}` : p.name)

// "10월 31일"
export const fmtDate = (at: string): string => new Date(at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })

export async function getGroupId(): Promise<string> {
  const { data, error } = await supabase.from('groups').select('id').limit(1).single()
  if (error) throw error
  return data.id
}

export async function getPersona(): Promise<Persona> {
  const { data } = await supabase.from('profiles').select('persona').single()
  return data?.persona === 'jarvis' ? 'jarvis' : 'mom'
}

export async function setPersona(userId: string, persona: Persona): Promise<void> {
  const { error } = await supabase.from('profiles').update({ persona }).eq('id', userId)
  if (error) throw error
}

// 최근에 찍은 칸부터. 사진은 짧게 만료되는 서명 URL로만 보여 준다 (PRD 05)
export async function loadPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, group_id, area, name, photo_path, captured_at, items(id, name, level, inside, box, box_source, aliases, source)')
    .order('captured_at', { ascending: false })
  if (error) throw error
  const paths = data.flatMap((p) => (p.photo_path ? [p.photo_path as string] : []))
  const signed = paths.length ? (await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)).data ?? [] : []
  const urls = new Map(signed.map((s) => [s.path, s.signedUrl]))
  return data.map((p) => ({
    id: p.id,
    groupId: p.group_id,
    area: p.area,
    name: p.name,
    photoPath: p.photo_path,
    photoUrl: (p.photo_path && urls.get(p.photo_path)) || null,
    capturedAt: p.captured_at,
    items: (p.items as (Item & { box_source: Item['boxSource'] })[]).map(({ box_source, ...it }) => ({ ...it, boxSource: box_source })),
  }))
}

const boxSourceOf = (it: Item) => (it.box ? it.boxSource ?? it.source : null)

// 칸과 물건을 한 트랜잭션에 넣는다 (0005_save_place.sql). 같은 공간·같은 이름이면 새 기록으로 바뀐다
export async function savePlace(groupId: string, area: string, name: string, items: Item[]) {
  const { data, error } = await supabase.rpc('save_place', {
    group_id: groupId,
    area,
    name,
    items: items.map((it) => ({ ...it, box_source: boxSourceOf(it) })),
  })
  if (error) throw error
  const row = (data as { place_id: string; old_photo_path: string | null }[])[0]
  return { placeId: row.place_id, oldPhotoPath: row.old_photo_path }
}

// 저장 순서 (D2 TBD #2): save_place 뒤에 썸네일 올리기 → photo_path 갱신 → 예전 사진 지우기
export async function uploadPhoto(groupId: string, placeId: string, thumb: Blob, oldPhotoPath: string | null): Promise<void> {
  const path = `${groupId}/${placeId}/${Date.now()}.jpg`
  const uploaded = await supabase.storage.from(BUCKET).upload(path, thumb, { contentType: 'image/jpeg' })
  if (uploaded.error) throw uploaded.error
  const updated = await supabase.from('places').update({ photo_path: path }).eq('id', placeId)
  if (updated.error) throw updated.error
  // 실패해도 칸은 멀쩡하고 쓰지 않는 파일만 남으므로 저장 흐름을 막지 않는다
  if (oldPhotoPath) await supabase.storage.from(BUCKET).remove([oldPhotoPath])
}

// 쓰면서 배우기: 물건의 다른 이름을 바꾼다. search_text는 생성 열이라 같이 바뀐다
export async function setAliases(itemId: string, aliases: string[]): Promise<void> {
  const { error } = await supabase.from('items').update({ aliases }).eq('id', itemId)
  if (error) throw error
}

// 사진을 먼저 지운다. 칸이 없어지면 그 사진을 지울 권한도 없어진다 (Storage 삭제 정책이 can_see_place로 판정)
export async function deletePlace(place: Pick<Place, 'id' | 'photoPath'>): Promise<void> {
  if (place.photoPath) {
    const removed = await supabase.storage.from(BUCKET).remove([place.photoPath])
    if (removed.error) throw removed.error
  }
  const { error } = await supabase.from('places').delete().eq('id', place.id)
  if (error) throw error
}

// 칸 상세에서 바로 고친다 (D4-3). 공간을 옮길 곳에 같은 이름 칸이 있으면 unique에 걸려 place_exists
export async function updatePlace(id: string, area: string, name: string): Promise<void> {
  const { error } = await supabase.from('places').update({ area: area.trim(), name: name.trim() }).eq('id', id)
  if (error) throw error.code === '23505' ? new ApiError('place_exists') : error
}

export async function updateItem(id: string, next: Item): Promise<void> {
  const { error } = await supabase.from('items')
    .update({ name: next.name, box: next.box, box_source: boxSourceOf(next), aliases: next.aliases }).eq('id', id)
  if (error) throw error
}

export async function addItem(place: Pick<Place, 'id' | 'groupId'>, name: string): Promise<Item> {
  const { data, error } = await supabase.from('items')
    .insert({ place_id: place.id, group_id: place.groupId, name, level: 'told', source: 'user' })
    .select('id, name, level, inside, box, aliases, source').single()
  if (error) throw error
  return data as Item
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// 라벨 (PRD 05 AI가 본 위치와 라벨). 행동마다 한 줄, 지우지 않는다.
// item은 고치기 전(AI가 낸 것), next는 고친 뒤. add는 사람이 처음 적은 물건이라 user_ 쪽만 채운다
export type LabelAction = 'confirm' | 'reject' | 'move' | 'draw' | 'rename' | 'add'
export type Label = { item: Item; action: LabelAction; next?: Item }
export async function addLabels(place: Pick<Place, 'id' | 'groupId' | 'photoPath'>, list: Label[]): Promise<void> {
  const { error } = await supabase.from('item_labels').insert(list.map(({ item, action, next }) => ({
    place_id: place.id,
    group_id: place.groupId,
    item_id: item.id ?? null,
    photo_path: place.photoPath,
    action,
    ai_name: action === 'add' ? null : item.name,
    ai_box: action === 'add' ? null : item.box,
    user_name: action === 'add' ? item.name : action === 'rename' ? next?.name : null,
    user_box: action === 'add' ? item.box : action === 'move' || action === 'draw' ? next?.box : null,
  })))
  if (error) throw error
}
