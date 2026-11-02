// 칸 상세 (D4-3, 개발계획 3절): 공간·칸 이름 바꾸기, 물건·박스 고치기, 다시 찍기. 고칠 때마다 바로 저장한다
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon } from 'lucide-react'
import { type CardEdit, PlaceCard } from '@/features/chat/PlaceCard'
import { type Item, type LabelAction, type Place, addItem, addLabels, deleteItem, errorCode, setPlaceShared, updateItem, updatePlace } from '@/lib/api'
import { track } from '@/lib/events'
import type { PersonaText } from '@/lib/personas'

type PlaceDetailProps = {
  place: Place
  areas: string[]
  text: PersonaText
  onBack: () => void
  onChanged: () => void
  onReshoot: (place: Place) => void
}

const field = 'rounded-lg border bg-background px-2.5 py-2 text-base placeholder:text-muted-foreground'
const chip = 'persona-round min-h-9 rounded-full border px-3 text-[13px] hover:bg-muted'

export function PlaceDetail({ place, areas, text, onBack, onChanged, onReshoot }: PlaceDetailProps) {
  const [items, setItems] = useState(place.items)
  const [area, setArea] = useState(place.area)
  const [name, setName] = useState(place.name)
  const [error, setError] = useState('')
  const needsSync = useRef(false)

  // 화면을 먼저 바꾸고 저장한다. 실패하면 알리고, 다시 불러온 목록으로 화면을 되돌린다
  useEffect(() => {
    if (!needsSync.current) return
    needsSync.current = false
    setItems(place.items)
  }, [place])

  async function run(work: () => Promise<void>) {
    setError('')
    try {
      await work()
    } catch (e) {
      setError(text.trouble[errorCode(e)] ?? text.trouble.default)
      needsSync.current = true
    }
    onChanged()
  }

  function label(item: Item, action: LabelAction, next?: Item) {
    track('label_item', { action, where: 'detail' })
    return addLabels(place, [{ item, action, next }])
  }

  const edit: CardEdit = {
    update: (index, next, action) => {
      const prev = items[index]
      setItems((list) => list.map((it, i) => (i === index ? next : it)))
      if (action === 'rename') track('learn_alias', { from: 'rename' })
      void run(async () => {
        await updateItem(prev.id!, next)
        await label(prev, action, next)
      })
    },
    remove: (index) => {
      const prev = items[index]
      setItems((list) => list.filter((_, i) => i !== index))
      track('label_item', { action: 'remove', where: 'detail' }) // item_labels에는 없는 행동이라 이벤트로만
      void run(() => deleteItem(prev.id!))
    },
    add: (itemName) => void run(async () => {
      const item = await addItem(place, itemName)
      setItems((list) => [...list, item])
      await label(item, 'add')
    }),
  }

  // 칩은 고르는 순간 저장한다 (물건 고치기처럼). 적어 넣는 공간·이름만 저장 버튼으로
  function chooseArea(a: string) {
    setArea(a)
    if (a !== place.area) void run(() => updatePlace(place.id, a, place.name))
  }

  function saveInfo(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) void run(() => updatePlace(place.id, area, name))
  }

  // 만든 사람만 바꿀 수 있다 (canShare). 다시 불러온 목록의 값으로 체크 상태가 바뀐다
  function toggleShare(shared: boolean) {
    track('toggle_place_share', { shared, where: 'detail' })
    void run(() => setPlaceShared(place.id, shared))
  }

  const isInfoSame = area.trim() === place.area && name.trim() === place.name
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeftIcon className="size-4" aria-hidden="true" />목록으로
      </button>
      <form onSubmit={saveInfo} className="flex flex-col gap-1.5">
        <label htmlFor="place-area" className="text-xs font-semibold text-muted-foreground">공간</label>
        <input id="place-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="공간 없음" className={field} />
        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => <button key={a} type="button" className={chip} onClick={() => chooseArea(a)}>{a}</button>)}
          </div>
        )}
        <label htmlFor="place-name" className="mt-1 text-xs font-semibold text-muted-foreground">칸 이름</label>
        <input id="place-name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        <button type="submit" disabled={isInfoSame || !name.trim()} className={`${chip} mt-1 self-start disabled:opacity-40`}>공간·이름 저장</button>
      </form>
      {place.canShare && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={place.shared} onChange={(e) => toggleShare(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          같이 쓰는 사람에게 보이기
        </label>
      )}
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      <PlaceCard place={{ ...place, area, name, items }} where="detail" text={text} edit={edit} />
      <button type="button" onClick={() => onReshoot(place)} className={`${chip} min-h-11 self-start`}>이 칸 다시 찍기</button>
    </div>
  )
}
