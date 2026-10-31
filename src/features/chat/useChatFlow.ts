// 대화 흐름 (프로토타입 send/record/askNext/answer/finish/search).
// 사진 → 칸 이름 → (인식을 기다리는 동안) 공간 → 초안 → 가려진 곳 질문 → 저장 → 추천 질문. 흐름 밖의 말은 검색.
// 빠른 답 버튼은 나중에 눌리므로 흐름·칸 목록·대화 상대는 ref로 읽는다 (예전 렌더의 값을 잡지 않게).
import { useEffect, useRef, useState } from 'react'
import { exactMatch, keywordMatch } from '@shared/match.ts'
import { type DraftItem, type Recognition, type SearchResult, splitItems } from '@shared/validate.ts'
import {
  type Item, type Judged, type Level, type Place, addLabels, callFunction, errorCode, getGroupId, loadPlaces, placeLabel, savePlace, uploadPhoto,
} from '@/lib/api'
import { PERSONAS, type Persona } from '@/lib/personas'
import { type Photo, toBase64 } from '@/lib/photo'

const MAX_PLACE_NAME = 50 // recognize 함수와 같은 상한
const MAX_PICK = 4

export type Quick = { label: string; run: () => void }
export type CardPlace = Pick<Place, 'area' | 'name' | 'photoUrl' | 'capturedAt' | 'items'>
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

type Ask = { ask: string; target: string; last?: boolean }
type Outcome = { draft: Recognition } | { error: string }
type Flow = {
  step: Step
  photo: Photo
  name: string
  area: string
  recognition?: Promise<Outcome>
  items: Item[]
  cardId?: number
  labels: Judged[] // 초안의 맞아 / 여기 아니야. 칸 id가 생기는 저장 뒤에 기록
  tries: string[]
  queue: Ask[]
  current?: Ask
}

const fromDraft = (level: Level) => (d: DraftItem): Item => ({ ...d, level, inside: null, source: 'ai' })
const told = (name: string, inside: string | null): Item => ({ name, level: 'told', inside, box: null, aliases: [], source: 'user' })

type Options = { persona: Persona; shoot: () => void; openPlaces: () => void }

export function useChatFlow({ persona, shoot, openPlaces }: Options) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [places, setPlacesState] = useState<Place[]>([])
  const [step, setStep] = useState<Step | null>(null)
  const [busy, setBusy] = useState(false)

  const flowRef = useRef<Flow | null>(null)
  const placesRef = useRef<Place[]>([])
  const groupRef = useRef<Promise<string> | null>(null)
  const personaRef = useRef(persona)
  const busyRef = useRef(false)
  const nextId = useRef(0)
  const voiceWarned = useRef(false)

  useEffect(() => { personaRef.current = persona }, [persona])
  const P = () => PERSONAS[personaRef.current]

  /* ---------- 상태 ---------- */
  const setFlow = (f: Flow | null) => { flowRef.current = f; setStep(f?.step ?? null) }
  const setPlaces = (list: Place[]) => { placesRef.current = list; setPlacesState(list) }
  // 목록을 못 불러와도 대화는 계속한다 (검색은 '기록 없음', 저장은 그때 오류 안내)
  const reloadPlaces = () => loadPlaces().then(setPlaces, () => {})
  const groupId = () => (groupRef.current ??= getGroupId())

  useEffect(() => { reloadPlaces() }, [])

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
  function send(text: string, photo?: Photo) {
    if (busyRef.current) return
    clearQuick()
    me(text || undefined, photo?.thumbUrl)
    if (photo) {
      setFlow({ step: 'name', photo, name: '', area: '', items: [], labels: [], tries: [], queue: [] })
      return text ? named(text) : void bot(P().askName)
    }
    switch (flowRef.current?.step) {
      case 'name': return named(text)
      case 'area': return void areaChosen(text)
      case 'ask': return answer(text)
      case 'manual': return manual(text)
      default: return void search(text)
    }
  }

  function pick(q: Quick) {
    if (busyRef.current) return
    clearQuick()
    q.run()
  }

  /* ---------- 기록: 사진 → 이름 → 공간 → 초안 ---------- */
  function named(text: string) {
    const f = flowRef.current!
    const name = text.slice(0, MAX_PLACE_NAME) // shortcut: 긴 이름은 자름, 이름 고치기 화면이 생기면 거기서 안내
    // 인식을 먼저 시작하고, 기다리는 동안 공간을 묻는다 (개발계획 3절)
    const recognition: Promise<Outcome> = toBase64(f.photo.full)
      .then((image) => callFunction<{ draft: Recognition }>('recognize', { image, placeName: name, persona: personaRef.current }))
      .then((r) => ({ draft: r.draft }), (e) => ({ error: errorCode(e) }))
    setFlow({ ...f, step: 'area', name, recognition })
    const areas = [...new Set(placesRef.current.map((p) => p.area).filter(Boolean))]
    bot(P().askArea, {
      quick: [...areas.map((a) => reply(a, () => void areaChosen(a))), reply('건너뛸게', () => void areaChosen(''))],
    })
  }

  async function areaChosen(text: string) {
    const f = { ...flowRef.current!, area: text.trim() }
    const outcome = await think(P().looking, () => f.recognition!)
    if ('error' in outcome) {
      if (outcome.error === 'image_rejected' || outcome.error === 'session_expired') {
        setFlow(null)
        return void bot(trouble(outcome.error), outcome.error === 'image_rejected' ? { quick: [shootQuick()] } : undefined)
      }
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
    setFlow({ ...f, labels: [...f.labels, { item, ok }] })
  }

  const card = (f: Flow): CardPlace => ({
    area: f.area, name: f.name, photoUrl: f.photo.thumbUrl, capturedAt: new Date().toISOString(), items: f.items,
  })

  function redraw(f: Flow) {
    if (f.cardId) patch(f.cardId, { place: card(f) })
  }

  function removeItem(index: number) {
    const f = flowRef.current
    if (f?.step !== 'ask') return
    const next = { ...f, items: f.items.filter((_, i) => i !== index) }
    setFlow(next)
    redraw(next)
  }

  /* ---------- 가려진 곳 질문 ---------- */
  function askNext() {
    const f = flowRef.current!
    const [q, ...rest] = f.queue
    if (!q) return void finish()
    setFlow({ ...f, queue: rest, current: q })
    bot(q.ask, {
      quick: [q.last ? reply('없어, 저장해', () => void finish()) : reply('몰라, 넘어가', askNext)],
    })
  }

  function answer(text: string) {
    const f = flowRef.current!
    const q = f.current!
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
      return void bot(P().trouble.default, { quick: [reply('다시 저장해', () => void save(f))] })
    }
    bot(P().saved(placeLabel(f)))
    // shortcut: 초안 라벨은 사진을 올리기 전이라 photo_path 없이 남김, 사진별 박스 비교가 필요해지면(D3 평가) 올린 경로를 넣기
    // 라벨은 학습용이라 실패해도 저장 흐름을 막지 않는다
    if (f.labels.length) void addLabels({ id: saved.placeId, groupId: await groupId(), photoPath: null }, f.labels).catch(() => {})
    const uploaded = await upload(f, saved)
    await reloadPlaces()
    if (!uploaded) return
    const later = reply('나중에 할게', () => bot(P().later))
    bot(f.tries.length ? P().tryIt : P().anytime, {
      quick: [...f.tries.map((t) => ({ label: t, run: () => send(t) })), later],
    })
  }

  // 올리기가 실패하면 사진 없는 칸이 남으므로 다시 올리기를 안내한다 (D2 TBD #2)
  async function upload(f: Flow, saved: { placeId: string; oldPhotoPath: string | null }): Promise<boolean> {
    try {
      await think(P().saving, async () => uploadPhoto(await groupId(), saved.placeId, f.photo.thumb, saved.oldPhotoPath))
      return true
    } catch {
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
  async function search(q: string) {
    const list = placesRef.current
    if (!list.length) return void bot(P().noPlaces, { quick: [shootQuick()] })
    const items = list.flatMap((p) => p.items.map((it) => ({ id: it.id!, name: it.name, aliases: it.aliases })))
    const local = exactMatch(q, items)
    if (local.hitId) return showFound(local.hitId, true)

    let result: SearchResult
    try {
      result = (await think(P().searching, () =>
        callFunction<{ result: SearchResult }>('search', { question: q, includeIds: local.ids }))).result
    } catch (e) {
      if (errorCode(e) === 'session_expired') return void bot(trouble('session_expired'))
      // OpenAI 장애 때는 v0 키워드 검색으로 대신 찾고 그렇다고 알린다 (PRD 05 실패 택소노미)
      const id = keywordMatch(q, items)
      if (!id) return notFound()
      bot(P().fallback)
      return showFound(id, true)
    }
    if (result.intent === 'other') return void bot(P().other)
    if (!result.found) return notFound()
    if (result.confidence === 'low' && result.itemIds.length > 1) return choose(result.itemIds)
    showFound(result.itemIds[0], result.confidence === 'high')
  }

  function findItem(id: string) {
    for (const place of placesRef.current) {
      const item = place.items.find((it) => it.id === id)
      if (item) return { place, item }
    }
    return null
  }

  function showFound(id: string, isSure: boolean) {
    const hit = findItem(id)
    if (!hit) return notFound()
    const { place, item } = hit
    const say = isSure ? P().foundAt : P().isThis
    bot(say(item.name, placeLabel(place), item.inside), {
      place,
      hitId: id,
      judge: (it, ok) => void addLabels(place, [{ item: it, ok }]).catch(() => bot(P().trouble.default)),
      quick: [
        reply('찾았어!', () => bot(P().gotIt)),
        reply('거기 없던데?', () => bot(P().wrong, { quick: [shootQuick('그 칸 찍기')] })),
      ],
    })
  }

  // low: 후보 칸 목록을 보여 주고 고르게 한다 (PRD 05 Confidence별 화면)
  function choose(ids: string[]) {
    const options = ids.slice(0, MAX_PICK).flatMap((id) => {
      const hit = findItem(id)
      return hit ? [reply(`${hit.item.name} · ${placeLabel(hit.place)}`, () => showFound(id, true))] : []
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

  function reset() {
    if (busyRef.current) return
    setMessages([])
    setFlow(null)
  }

  return {
    messages, places, step, busy,
    send, pick, removeItem, reset, reloadPlaces, voiceBlocked,
    photoRejected: () => void bot(trouble('image_rejected')),
  }
}
