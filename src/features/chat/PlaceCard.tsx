// 칸 카드 (프로토타입 placeCard). 초안(물건 빼기)과 검색 결과(찾은 물건 강조)에서 같이 쓴다
import { XIcon } from 'lucide-react'
import { type Level, fmtDate, placeLabel } from '@/lib/api'
import type { CardPlace } from './useChatFlow'

const LEVELS: [Level, string, string][] = [
  ['sure', '확실', 'bg-sure'],
  ['guess', '추정', 'bg-guess'],
  ['hidden', '가려짐', 'bg-hidden'],
  ['told', '말해 준 것', 'bg-told'],
]

type PlaceCardProps = { place: CardPlace; hitId?: string; onRemove?: (index: number) => void }

export function PlaceCard({ place, hitId, onRemove }: PlaceCardProps) {
  const label = placeLabel(place)
  return (
    <div className="w-[min(400px,100%)] overflow-hidden rounded-2xl border bg-card">
      {place.photoUrl && <img src={place.photoUrl} alt={`${label} 사진`} className="block aspect-[4/3] w-full bg-muted object-cover" />}
      <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <b className="font-semibold">{label}</b>
          <span className="text-[13px] text-muted-foreground">{fmtDate(place.capturedAt)}에 찍음 · 물건 {place.items.length}개</span>
        </div>
        {LEVELS.map(([level, name, dot]) => {
          const list = place.items.map((it, i) => [it, i] as const).filter(([it]) => it.level === level)
          if (!list.length) return null
          return (
            <div key={level} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className={`size-2 rounded-full ${dot}`} />{name}
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {list.map(([it, i]) => {
                  const isHit = !!hitId && it.id === hitId
                  return (
                    <li
                      key={i}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm [overflow-wrap:anywhere] ${
                        isHit ? 'bg-accent font-semibold ring-[1.5px] ring-primary ring-inset'
                          : level === 'hidden' ? 'ring-1 ring-hidden ring-inset' : 'bg-muted'}`}
                    >
                      {it.inside ? `${it.inside} 안: ${it.name}` : it.name}
                      {onRemove && (
                        <button
                          type="button"
                          aria-label={`${it.name} 빼기`}
                          onClick={() => onRemove(i)}
                          className="-my-1 -mr-1.5 ml-0.5 grid size-7 place-items-center text-muted-foreground"
                        >
                          <XIcon className="size-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
