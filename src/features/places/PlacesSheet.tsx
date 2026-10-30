// 기억해 둔 곳: 공간별로 묶어 보여 주고 지운다 (개발계획 3절). 모바일은 아래에서, 데스크톱은 오른쪽에서 올라온다
import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { type Place, deletePlace, fmtDate } from '@/lib/api'
import type { PersonaText } from '@/lib/personas'

const NO_AREA = '공간 없음'

// 공간과 그 안의 칸은 최근에 찍은 순서 (places가 이미 그 순서), '공간 없음'은 맨 아래
function byArea(places: Place[]): [string, Place[]][] {
  const groups = new Map<string, Place[]>()
  for (const p of places) groups.set(p.area, [...(groups.get(p.area) ?? []), p])
  const named = [...groups].filter(([area]) => area)
  return groups.has('') ? [...named, [NO_AREA, groups.get('')!]] : named
}

type PlacesSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  places: Place[]
  text: PersonaText
  onChanged: () => void
}

export function PlacesSheet({ open, onOpenChange, places, text, onChanged }: PlacesSheetProps) {
  const isWide = window.matchMedia('(min-width: 768px)').matches
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        className="max-h-[85dvh] gap-2 overflow-y-auto pt-[max(16px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[max(24px,env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] md:max-h-none"
      >
        <SheetTitle className="font-display text-[26px] leading-tight font-bold">{text.sheetTitle}</SheetTitle>
        <SheetDescription className="sr-only">{text.count(places.length)}</SheetDescription>
        {places.length === 0 && <p className="py-6 text-muted-foreground">{text.emptyList}</p>}
        {byArea(places).map(([area, list]) => (
          <section key={area}>
            <h3 className="pt-3 text-sm font-semibold text-muted-foreground">{area}</h3>
            <ul>
              {list.map((p) => <PlaceRow key={p.id} place={p} text={text} onChanged={onChanged} />)}
            </ul>
          </section>
        ))}
      </SheetContent>
    </Sheet>
  )
}

type PlaceRowProps = { place: Place; text: PersonaText; onChanged: () => void }

function PlaceRow({ place, text, onChanged }: PlaceRowProps) {
  const [isArmed, setIsArmed] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!isArmed) return setIsArmed(true)
    setIsDeleting(true)
    setError('')
    try {
      await deletePlace(place)
      onChanged()
    } catch {
      setError(text.trouble.default)
      setIsDeleting(false)
    }
  }

  return (
    <li className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b py-3">
      {place.photoUrl ? <img src={place.photoUrl} alt="" className="size-14 rounded-xl object-cover" /> : <span className="size-14 rounded-xl bg-muted" />}
      <div className="min-w-0">
        <div className="font-semibold [overflow-wrap:anywhere]">{place.name}</div>
        <div className="text-[13px] text-muted-foreground">물건 {place.items.length}개 · {fmtDate(place.capturedAt)}에 찍음</div>
        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={isDeleting}
        className={`persona-round min-h-11 rounded-full border px-3 text-[13px] ${isArmed ? 'border-primary text-primary' : 'text-muted-foreground'}`}
      >
        {isArmed ? text.confirmDelete : '지우기'}
      </button>
    </li>
  )
}
