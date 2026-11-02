// 대화 흐름 (프로토타입 send/record/askNext/answer/finish/search).
// 사진 → 칸 이름 → (인식을 기다리는 동안) 공간 → 초안 → 가려진 곳 질문 → 저장 → 추천 질문. 흐름 밖의 말은 검색.
// 빠른 답 버튼은 나중에 눌리므로 흐름·칸 목록·대화 상대는 ref로 읽는다 (예전 렌더의 값을 잡지 않게).
import { useEffect, useRef, useState } from 'react'
import { aliasFrom, exactMatch, keywordMatch, withoutMatchedAliases } from '@shared/match.ts'
import { type DraftItem, type Recognition, type SearchResult, splitItems } from '@shared/validate.ts'
import {
  type Item, type Label, type Level, type Place, addLabels, callFunction, errorCode, loadPlaces, placeLabel, savePlace, setAliases, setPlaceShared, uploadPhoto,
} from '@/lib/api'
import { track } from '@/lib/events'
import { PERSONAS, type Persona } from '@/lib/personas'
import { type Photo, toBase64 } from '@/lib/photo'

const MAX_PLACE_NAME = 50 // recognize 함수와 같은 상한
const MAX_PICK = 4

export type Quick = { label: string; run: () => void }
export type CardPlace = Pick<Place, 'area' | 'name' | 'photoUrl' | 'capturedAt' | 'items' | 'by'>
export type Msg = {
  id: number
  from: 'bot' | 'me'
  text?: string
  photoUrl?: string
  place?: CardPlace
  hitId?: string
  editable?: boolean
  judge?: (item: Item, ok: boolean) => void
  quick?: Quick[]
  typing?: boolean
}
export type Step = 'name' | 'area' | 'ask' | 'manual'
export type InputMode = 'text' | 'voice' | 'chip' | 'try'
type ResolvedBy = 'match' | 'llm' | 'fallback'

type Ask = { ask: string; target: string; last?: boolean }
type Outcome = { draft: Recognition } | { error: string }
type Flow = {
  step: Step
  photo: Photo
  startedAt: number // 기록 시간(save_place duration_ms) 시작
  name: string
  area: string
  areaInput: 'chip' | 'typed' | 'skip'
  recognition?: Promise<Outcome>
  items: Item[]
  cardId?: number
  labels: Label[] // 초안의 맞아 / 여기 아니야와 고친 것. 칸 id가 생기는 저장 뒤에 기록
  tries: string[]
  queue: Ask[]
  current?: Ask
}

const fromDraft = (level: Level) => (d: DraftItem): Item => ({ ...d, level, inside: null, source: 'ai' })
const told = (name: string, inside: string | null): Item => ({ name, level: 'told', inside, box: null, aliases: [], source: 'user' })

// 지금 보고 있는 그룹 (useGroups). people은 멤버 id → 이름
export type GroupView = { id: string; userId: string; people: Map<string, string> }
type Options = { persona: Persona; group: GroupView | null; shoot: () => void; openPlaces: () => void }

export function useChatFlow({ persona, group, shoot, openPlaces }: Options) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [places, setPlacesState] = useState<Place[]>([])
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false)

  const flowRef = useRef<Flow | null>(null)
  const placesRef = useRef<Place[]>([])
  const groupRef = useRef(group)
  const personaRef = useRef(persona)
  const busyRef = useRef(false)
  const nextId = useRef(0)
  const voiceWarned = useRef(false)
  const reshootRef = useRef<Pick<Place, 'area' | 'name'> | null>(null) // 칸 상세의 다시 찍기

  useEffect(() => { personaRef.current = persona }, [persona])
  const P = () => PERSONAS[personaRef.current]

  /* ---------- 상태 ---------- */
  const setFlow = (f: Flow | null) => { flowRef.current = f; setStep(f?.step ?? null) }
  const setPlaces = (list: Place[]) => { placesRef.current = list; setPlacesState(list) }
  // 목록을 못 불러와도 대화는 계속한다 (검색은 '기록 없음', 저장은 그때 오류 안내)
  const reloadPlaces = async () => {
    const g = groupRef.current
    if (!g) return
    const isShared = g.people.size > 1
    // 혼자 쓰는 그룹이면 누가 찍었는지와 공유 스위치를 보이지 않는다
    const withWho = (p: Place): Place => ({
      ...p,
      by: isShared && p.capturedBy ? (p.capturedBy === g.userId ? '나' : g.people.get(p.capturedBy) ?? '멤버') : null,
      canShare: isShared && p.createdBy === g.userId,
    })
    await loadPlaces(g.id).then((list) => setPlaces(list.map(withWho)), () => {})
  }
  const groupId = async () => {
    if (!groupRef.current) throw new Error('그룹을 아직 못 불러옴')
    return groupRef.current.id
  }

  // 그룹을 바꾸거나 멤버가 바뀌면 그 그룹의 칸으로 다시 불러온다
  useEffect(() => { groupRef.current = group; void reloadPlaces() }, [group])

  /* ---------- 메시지 ---------- */
  function push(m: Omit<Msg, 'id'>): number {
    const id = ++nextId.current
    setMessages((ms) => [...ms, { ...m, id }])
    return id
  }
  const bot = (text: string, extra?: Partial<Msg>) => push({ from: 'bot', text, ...extra })
  const me = (text?: string, photoUrl?: string) => push({ from: 'me', text, photoUrl })
  const patch = (id: number, p: Partial<Msg>) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)))
  const clearQuick = () => setMessages((ms) => ms.map((m) => (m.quick ? { ...m, quick: undefined } : m)))
  const trouble = (code: string) => P().trouble[code] ?? P().trouble.default
  const reply = (label: string, then: () => void): Quick => ({ label, run: () => { me(label); then() } })
  const shootQuick = (label = '사진 찍기'): Quick => ({ label, run: shoot })

  async function think<T>(caption: string, call: () => Promise<T>): Promise<T> {
    const id = push({ from: 'bot', text: caption, typing: true })
    busyRef.current = true
    setBusy(true)
    try {
      return await call()
    } finally {
      busyRef.current = false
      setBusy(false)
      setMessages((ms) => ms.filter((m) => m.id !== id))
    }
  }

  /* ---------- 입력 ---------- */
  function send(text: string, photo?: Photo, mode: InputMode = 'text') {
    if (busyRef.current) return
    clearQuick()
    me(text || undefined, photo?.thumbUrl)
    if (photo) {
      // 다시 찍기여도 바로 덮어쓰지 않고 버튼으로 고르게 한다 (카메라를 닫고 나중에 다른 칸을 찍었을 수 있음)
      const again = reshootRef.current
      reshootRef.current = null
      setFlow({ step: 'name', photo, startedAt: Date.now(), name: '', area: '', areaInput: 'skip', items: [], labels: [], tries: [], queue: [] })
      if (text) return named(text)
      return void bot(P().askName, again ? { quick: [reply(placeLabel(again), () => named(again.name, again.area))] } : undefined)
    }
    switch (flowRef.current?.step) {
      case 'name': return named(text)
      case 'area': return void areaChosen(text, 'typed')
      case 'ask': return answer(text)
      case 'manual': return manual(text)
      default: return void search(text, mode)
    }
  }

  function pick(q: Quick) {
    if (busyRef.current) return
    clearQuick()
    q.run()
  }

  /* ---------- 기록: 사진 → 이름 → 공간 → 초안 ---------- */
  function named(text: string, area?: string) {
    const f = flowRef.current!
    const name = text.slice(0, MAX_PLACE_NAME) // shortcut: 긴 이름은 자름, 이름 고치기 화면이 생기면 거기서 안내
    // 인식을 먼저 시작하고, 기다리는 동안 공간을 묻는다 (개발계획 3절)
    const recognition: Promise<Outcome> = toBase64(f.photo.full)
      .then((image) => callFunction<{ draft: Recognition }>('recognize', { image, placeName: name, persona: personaRef.current }))
      .then((r) => ({ draft: r.draft }), (e) => ({ error: errorCode(e) }))
    setFlow({ ...f, step: 'area', name, recognition })
    if (area !== undefined) return void areaChosen(area, 'chip')
    const areas = [...new Set(placesRef.current.map((p) => p.area).filter(Boolean))]
    bot(P().askArea, {
      quick: [...areas.map((a) => reply(a, () => void areaChosen(a, 'chip'))), reply('건너뛸게', () => void areaChosen('', 'skip'))],
    })
  }

  async function areaChosen(text: string, areaInput: Flow['areaInput']) {
    const f = { ...flowRef.current!, area: text.trim(), areaInput }
    const outcome = await think(P().looking, () => f.recognition!)
    if ('error' in outcome) {
      track('receive_failure', { stage: 'recognize', code: outcome.error })
      if (outcome.error === 'image_rejected' || outcome.error === 'session_expired') {
        setFlow(null)
        return void bot(trouble(outcome.error), outcome.error === 'image_rejected' ? { quick: [shootQuick()] } : undefined)
      }
      if (outcome.error === 'daily_limit') bot(trouble(outcome.error))
      return startManual(f, P().cantRead)
    }
    const d = outcome.draft
    const items = [...d.sure.map(fromDraft('sure')), ...d.guess.map(fromDraft('guess')), ...d.hidden.map(fromDraft('hidden'))]
    if (!items.length) return startManual(f, P().seeNothing)
    const next = { ...f, step: 'ask' as const, items, tries: d.try, queue: [...d.questions, { ask: P().lastAsk, target: '', last: true }] }
    const cardId = bot(P().draft, { place: card(next), editable: true, judge: (item, ok) => judgeDraft(cardId, item, ok) })
    setFlow({ ...next, cardId })
    askNext()
  }

  function judgeDraft(cardId: number, item: Item, ok: boolean) {
    const f = flowRef.current
    if (f?.cardId !== cardId) return
    const action = ok ? 'confirm' : 'reject'
    track('label_item', { action, where: 'draft' })
    setFlow({ ...f, labels: [...f.labels, { item, action }] })
  }

  const card = (f: Flow): CardPlace => ({
    area: f.area, name: f.name, photoUrl: f.photo.thumbUrl, capturedAt: new Date().toISOString(), items: f.items,
  })

  function redraw(f: Flow) {
    if (f.cardId) patch(f.cardId, { place: card(f) })
  }

  // 초안 고치기는 저장 전(가려진 곳 질문 중)에만. 라벨은 모았다가 저장 뒤에 기록
  function editDraft(change: (f: Flow) => Flow) {
    const f = flowRef.current
    if (f?.step !== 'ask') return
    const next = change(f)
    setFlow(next)
    redraw(next)
  }

  function removeItem(index: number) {
    track('label_item', { action: 'remove', where: 'draft' }) // item_labels에는 없는 행동이라 이벤트로만 (오검출 비율)
    editDraft((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))
  }

  function updateItem(index: number, next: Item, action: 'move' | 'draw' | 'rename') {
    track('label_item', { action, where: 'draft' })
    if (action === 'rename') track('learn_alias', { from: 'rename' })
    editDraft((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? next : it)),
      labels: [...f.labels, { item: f.items[index], action, next }],
    }))
  }

  function addItem(name: string) {
    const item = told(name, null)
    track('label_item', { action: 'add', where: 'draft' })
    editDraft((f) => ({ ...f, items: [...f.items, item], labels: [...f.labels, { item, action: 'add' }] }))
  }

  /* ---------- 가려진 곳 질문 ---------- */
  function askNext() {
    const f = flowRef.current!
    const [q, ...rest] = f.queue
    if (!q) return void finish()
    setFlow({ ...f, queue: rest, current: q })
    bot(q.ask, {
      quick: [q.last ? reply('없어, 이대로 기억해줘.', () => { track('skip_question'); void finish() }) : reply('잘 모르겠어, 다음으로 넘어가줘.', () => { track('skip_question'); askNext() })],
    })
  }

  function answer(text: string) {
    const f = flowRef.current!
    const q = f.current!
    track('answer_question')
    const next = { ...f, items: [...f.items, ...splitItems(text).map((n) => told(n, q.target || null))] }
    setFlow(next)
    redraw(next)
    if (q.last) return void finish()
    askNext()
  }

  function startManual(f: Flow, line: string) {
    setFlow({ ...f, step: 'manual', items: [], tries: [], queue: [] })
    bot(line)
  }

  function manual(text: string) {
    const items = splitItems(text).map((n) => told(n, null))
    if (!items.length) return void bot(P().needOne)
    const next = { ...flowRef.current!, items }
    setFlow({ ...next, cardId: bot(P().written, { place: card(next) }) })
    void finish()
  }

  /* ---------- 저장 ---------- */
  async function finish() {
    const f = flowRef.current!
    setFlow(null)
    if (f.cardId) patch(f.cardId, { editable: false, judge: undefined })
    await save(f)
  }

  async function save(f: Flow) {
    let saved: Awaited<ReturnType<typeof savePlace>>
    try {
      saved = await think(P().saving, async () => savePlace(await groupId(), f.area, f.name, f.items))
    } catch {
      track('receive_failure', { stage: 'save', code: 'default' })
      return void bot(P().trouble.default, { quick: [reply('다시 저장해', () => void save(f))] })
    }
    track('save_place', {
      duration_ms: Date.now() - f.startedAt, item_count: f.items.length,
      told_count: f.items.filter((it) => it.level === 'told').length, area_input: f.areaInput,
    })
    bot(P().saved(placeLabel(f)))
    // shortcut: 초안 라벨은 사진을 올리기 전이라 photo_path 없이 남김, 사진별 박스 비교가 필요해지면(D3 평가) 올린 경로를 넣기
    // 라벨은 학습용이라 실패해도 저장 흐름을 막지 않는다
    if (f.labels.length) void addLabels({ id: saved.placeId, groupId: await groupId(), photoPath: null }, f.labels).catch(() => {})
    const uploaded = await upload(f, saved)
    await reloadPlaces()
    // 같이 쓰는 그룹이면 공유된다고 알리고 바로 끌 수 있게 (P1 공유 스위치, 저장할 때)
    if (placesRef.current.find((p) => p.id === saved.placeId)?.canShare) {
      bot(P().shared, { quick: [reply('나만 보기', () => void hide(saved.placeId))] })
    }
    if (!uploaded) return
    const later = reply('나중에 할게', () => bot(P().later))
    bot(f.tries.length ? P().tryIt : P().anytime, {
      quick: [...f.tries.map((t, i) => ({ label: t, run: () => { track('click_try_question', { rank: i + 1 }); send(t, undefined, 'try') } })), later],
    })
  }

  async function hide(placeId: string) {
    try {
      await setPlaceShared(placeId, false)
      track('toggle_place_share', { shared: false, where: 'save' })
      bot(P().hidden)
      await reloadPlaces()
    } catch {
      bot(trouble('default'))
    }
  }

  // 올리기가 실패하면 사진 없는 칸이 남으므로 다시 올리기를 안내한다 (D2 TBD #2)
  async function upload(f: Flow, saved: { placeId: string; oldPhotoPath: string | null }): Promise<boolean> {
    try {
      await think(P().saving, async () => uploadPhoto(await groupId(), saved.placeId, f.photo.thumb, saved.oldPhotoPath))
      return true
    } catch {
      track('receive_failure', { stage: 'upload', code: 'default' })
      bot(P().photoFail, {
        quick: [
          reply('사진 다시 올리기', async () => {
            if (await upload(f, saved)) { bot(P().photoDone); await reloadPlaces() }
          }),
          reply('나중에 할게', () => bot(P().later)),
        ],
      })
      return false
    }
  }

  /* ---------- 검색: 0단계(match.ts) → search 함수 → Confidence별 화면 ---------- */
  async function search(q: string, mode: InputMode) {
    track('submit_search', { input_mode: mode })
    const list = placesRef.current
    if (!list.length) {
      track('view_search_result', { found: false, resolved_by: 'no_places' })
      return void bot(P().noPlaces, { quick: [shootQuick()] })
    }
    const items = list.flatMap((p) => p.items.map((it) => ({ id: it.id!, name: it.name, aliases: it.aliases })))
    const local = exactMatch(q, items)
    if (local.hitId) {
      track('view_search_result', { found: true, confidence: 'high', resolved_by: 'match' })
      return showFound(local.hitId, true, 'match', q)
    }

    let result: SearchResult
    try {
      result = (await think(P().searching, () =>
        callFunction<{ result: SearchResult }>('search', { question: q, includeIds: local.ids, groupId: groupRef.current?.id }))).result
    } catch (e) {
      const code = errorCode(e)
      track('receive_failure', { stage: 'search', code })
      if (code === 'session_expired') return void bot(trouble(code))
      // OpenAI 장애나 일일 한도 때는 v0 키워드 검색으로 대신 찾고 그렇다고 알린다 (PRD 05 실패 택소노미)
      if (code === 'daily_limit') bot(trouble(code))
      const id = keywordMatch(q, items)
      track('view_search_result', { found: !!id, resolved_by: 'fallback' })
      if (!id) return notFound()
      if (code !== 'daily_limit') bot(P().fallback)
      return showFound(id, true, 'fallback', q)
    }
    if (result.intent === 'other') return void bot(P().other)
    if (!result.found) return notFound()
    if (result.confidence === 'low' && result.itemIds.length > 1) return choose(result.itemIds, q)
    showFound(result.itemIds[0], result.confidence === 'high', 'llm', q)
  }

  function findItem(id: string) {
    for (const place of placesRef.current) {
      const item = place.items.find((it) => it.id === id)
      if (item) return { place, item }
    }
    return null
  }

  function showFound(id: string, isSure: boolean, resolvedBy: ResolvedBy, q: string) {
    const hit = findItem(id)
    if (!hit) return notFound()
    const { place, item } = hit
    const say = isSure ? P().foundAt : P().isThis
    bot(say(item.name, placeLabel(place), item.inside), {
      place,
      hitId: id,
      judge: (it, ok) => {
        const action = ok ? 'confirm' : 'reject'
        track('label_item', { action, where: 'search' })
        addLabels(place, [{ item: it, action }]).catch(() => {
          track('receive_failure', { stage: 'label', code: 'default' })
          bot(P().trouble.default)
        })
      },
      quick: [
        reply('찾았어!', () => {
          track('click_search_feedback', { result: 'found', resolved_by: resolvedBy })
          if (resolvedBy === 'llm') learn(item, q)
          bot(P().gotIt)
        }),
        reply('거기 없던데?', () => {
          track('click_search_feedback', { result: 'wrong', resolved_by: resolvedBy })
          if (resolvedBy === 'match') unlearn(item, q)
          bot(P().wrong, { quick: [shootQuick('그 칸 찍기')] })
        }),
      ],
    })
  }

  // 쓰면서 배우기 (개발계획 5절): LLM으로 찾은 질문은 다른 이름으로 더해 다음엔 0단계에서 답한다. 실패해도 대화는 그대로
  function learn(item: Item, q: string) {
    const alias = aliasFrom(q)
    if (!alias || item.aliases.includes(alias)) return
    setAliases(item.id!, [...item.aliases, alias]).then(() => {
      track('learn_alias', { from: 'found_feedback' })
      return reloadPlaces()
    }, () => track('receive_failure', { stage: 'learn_alias', code: 'default' }))
  }

  // 0단계 오답: 일치에 쓰인 다른 이름을 지워 같은 오답을 되풀이하지 않는다
  function unlearn(item: Item, q: string) {
    const aliases = withoutMatchedAliases(q, item.aliases)
    if (aliases.length === item.aliases.length) return
    setAliases(item.id!, aliases).then(reloadPlaces, () => track('receive_failure', { stage: 'unlearn_alias', code: 'default' }))
  }

  // low: 후보 칸 목록을 보여 주고 고르게 한다 (PRD 05 Confidence별 화면)
  function choose(ids: string[], q: string) {
    const options = ids.slice(0, MAX_PICK).flatMap((id) => {
      const hit = findItem(id)
      return hit ? [reply(`${hit.item.name} · ${placeLabel(hit.place)}`, () => showFound(id, true, 'llm', q))] : []
    })
    bot(P().pick, { quick: options })
  }

  function notFound() {
    bot(P().notFound, { quick: [shootQuick('그 칸 찍기'), { label: '기억해 둔 곳 보기', run: openPlaces }] })
  }

  /* ---------- 그 밖 ---------- */
  function voiceBlocked() {
    if (voiceWarned.current) return
    voiceWarned.current = true
    bot(P().noVoice)
  }

  function reshoot(place: Place) {
    reshootRef.current = { area: place.area, name: place.name }
    shoot()
  }

  function reset() {
    if (busyRef.current) return
    setMessages([])
    setFlow(null)
  }

  return {
    messages, places, step, busy,
    send, pick, reset, reloadPlaces, voiceBlocked, reshoot,
    // shortcut: 카메라를 그냥 닫으면 다음 사진도 바로 보내짐(칸 이름은 그때도 고를 수 있음), 헷갈린다는 말이 나오면 취소를 감지
    isReshooting: () => reshootRef.current !== null,
    edit: { update: updateItem, remove: removeItem, add: addItem },
    photoRejected: () => void bot(trouble('image_rejected')),
    notice: (text: string) => void bot(text),
  }
}
