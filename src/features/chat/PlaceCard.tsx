// 칸 카드 (프로토타입 placeCard). 초안(물건 빼기)과 검색 결과(찾은 물건 강조)에서 같이 쓴다.
// 물건 칩이나 사진을 누르면 그 물건의 박스를 보여 주고, 맞아 / 여기 아니야를 받는다
import { useState } from 'react'
import { XIcon } from 'lucide-react'
import { PhotoBoxes } from '@/features/photo/PhotoBoxes'
import { type Item, type Level, fmtDate, placeLabel } from '@/lib/api'
import { QuickReplies } from './QuickReplies'
import type { CardPlace } from './useChatFlow'

const LEVELS: [Level, string, string][] = [
  ['sure', '확실', 'bg-sure'],
  ['guess', '추정', 'bg-guess'],
  ['hidden', '가려짐', 'bg-hidden'],
  ['told', '말해 준 것', 'bg-told'],
]

type PlaceCardProps = {
  place: CardPlace
  hitId?: string
  boxAsk: (item: string) => string
  onRemove?: (index: number) => void
  onJudge?: (item: Item, ok: boolean) => void
}

export function PlaceCard({ place, hitId, boxAsk, onRemove, onJudge }: PlaceCardProps) {
  const label = placeLabel(place)
  // 순서가 아니라 물건 자체를 잡아 둔다 (초안에서 물건을 빼면 순서가 바뀜). 검색 결과는 찾은 물건부터 보여 준다
  const [selected, setSelected] = useState<Item | null>(() => place.items.find((it) => !!hitId && it.id === hitId) ?? null)
  const [judged, setJudged] = useState<Item[]>([])
  const index = selected ? place.items.indexOf(selected) : -1
  const chosen = index >= 0 ? place.items[index] : null

  function judge(item: Item, ok: boolean) {
    setJudged((list) => [...list, item])
    onJudge!(item, ok)
  }

  return (
    <div className="w-[min(400px,100%)] overflow-hidden rounded-2xl border bg-card">
      {place.photoUrl && (
        <PhotoBoxes
          src={place.photoUrl}
          alt={`${label} 사진`}
          boxes={place.items.map((it) => it.box)}
          selected={index}
          onSelect={(i) => setSelected(place.items[i] ?? null)}
        />
      )}
      <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
        {place.photoUrl && chosen && (
          <div className="flex flex-col gap-2 text-sm">
            {!chosen.box ? <span className="text-muted-foreground">{chosen.name}: 사진에서 위치를 못 찾았어요</span>
              : judged.includes(chosen) ? <span className="text-muted-foreground">{chosen.name}: 알려 줘서 고마워요</span>
              : onJudge && (
                <>
                  <span>{boxAsk(chosen.name)}</span>
                  <QuickReplies
                    options={[{ label: '맞아', run: () => judge(chosen, true) }, { label: '여기 아니야', run: () => judge(chosen, false) }]}
                    onPick={(q) => q.run()}
                  />
                </>
              )}
          </div>
        )}
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
                  const isSelected = it === chosen
                  const text = it.inside ? `${it.inside} 안: ${it.name}` : it.name
                  return (
                    <li
                      key={i}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm [overflow-wrap:anywhere] ${
                        isSelected ? 'bg-accent font-semibold ring-[1.5px] ring-primary ring-inset'
                          : level === 'hidden' ? 'ring-1 ring-hidden ring-inset' : 'bg-muted'}`}
                    >
                      {place.photoUrl ? (
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelected(isSelected ? null : it)}
                          className="-my-1.5 py-1.5 text-left"
                        >
                          {text}
                        </button>
                      ) : text}
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
