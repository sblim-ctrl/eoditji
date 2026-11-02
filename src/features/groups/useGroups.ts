// P1 그룹 (D4-6): 내 그룹 목록, 지금 보는 그룹, 멤버 이름, 초대 링크로 들어온 참여.
// 지금 보는 그룹과 로그인 전에 받은 초대 코드는 이 브라우저에만 둔다 (없어도 "내 집"으로 시작)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Group, createGroup, createInvite, errorCode, groupPeople, joinGroup, listGroups } from '@/lib/api'
import { track } from '@/lib/events'

const CURRENT_KEY = 'eoditji.group'
const JOIN_KEY = 'eoditji.join'
const JOIN_PARAM = 'join'

const read = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const write = (key: string, value: string | null) => {
  try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key) } catch { /* 저장 못 해도 이번 화면은 그대로 */ }
}

// 초대 링크(?join=코드)로 열면 로그인 전에 코드를 챙겨 둔다. 구글 로그인은 주소의 쿼리를 잃는다
export function rememberJoinCode(): void {
  const url = new URL(window.location.href)
  const code = url.searchParams.get(JOIN_PARAM)
  if (!code) return
  write(JOIN_KEY, code)
  url.searchParams.delete(JOIN_PARAM)
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

export type JoinOutcome = { group: string } | { error: string }

export function useGroups(userId: string) {
  const [groups, setGroups] = useState<Group[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [people, setPeople] = useState<{ groupId: string; names: Map<string, string> } | null>(null)
  const [joined, setJoined] = useState<JoinOutcome | null>(null)

  const refresh = useCallback(async (prefer?: string) => {
    const list = await listGroups()
    setGroups(list)
    const want = prefer ?? read(CURRENT_KEY)
    const id = list.find((g) => g.id === want)?.id ?? list[0]?.id ?? null
    setCurrentId(id)
    write(CURRENT_KEY, id)
    return list
  }, [])

  useEffect(() => {
    const code = read(JOIN_KEY)
    if (!code) return void refresh().catch(() => {})
    write(JOIN_KEY, null)
    joinGroup(code).then(
      async (gid) => {
        track('join_group')
        const list = await refresh(gid)
        setJoined({ group: list.find((g) => g.id === gid)?.name ?? '' })
      },
      (e) => { setJoined({ error: errorCode(e) }); void refresh().catch(() => {}) },
    )
  }, [refresh, userId])

  useEffect(() => {
    if (!currentId) return
    groupPeople(currentId).then((names) => setPeople({ groupId: currentId, names }), () => setPeople({ groupId: currentId, names: new Map() }))
  }, [currentId])

  function select(id: string) {
    setCurrentId(id)
    write(CURRENT_KEY, id)
  }

  async function create(name: string) {
    const gid = await createGroup(name)
    track('create_group')
    await refresh(gid)
  }

  async function invite(): Promise<string> {
    const code = await createInvite(currentId!)
    track('create_invite')
    return `${window.location.origin}/?${JOIN_PARAM}=${code}`
  }

  const current = groups.find((g) => g.id === currentId) ?? null
  // 멤버 이름이 지금 그룹 것으로 바뀐 뒤에 넘긴다 (예전 그룹 이름이 섞이지 않게). 같은 객체를 유지해야 칸을 한 번만 다시 불러옴
  const view = useMemo(
    () => (people && people.groupId === currentId ? { id: people.groupId, userId, people: people.names } : null),
    [people, currentId, userId],
  )
  return { groups, current, people: view?.people ?? new Map<string, string>(), joined, select, create, invite, view }
}
