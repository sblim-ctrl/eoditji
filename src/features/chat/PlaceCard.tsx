// 칸 카드 (프로토타입 placeCard). 초안, 검색 결과(찾은 물건 강조), 칸 상세에서 같이 쓴다.
// 물건 칩이나 사진을 누르면 그 물건의 박스를 보여 주고, 맞아 / 여기 아니야를 받는다.
// edit를 주면 고칠 수 있다 (D4-3): 사진에서 박스 그리기·옮기기, 이름 고치기, 박스 지우기, 빼기, 추가
import { type FormEvent, useState } from 'react'
import { XIcon } from 'lucide-react'
import type { Box } from '@shared/validate.ts'
import { PhotoBoxes } from '@/features/photo/PhotoBoxes'
import { type Item, type Level, fmtDate, placeLabel } from '@/lib/api'
import { track } from '@/lib/events'
import type { PersonaText } from '@/lib/personas'
import { QuickReplies } from './QuickReplies'
import type { CardPlace } from './useChatFlow'

const LEVELS: [Level, string, string][] = [
  ['sure', '확실', 'bg-sure'],
  ['guess', '추정', 'bg-guess'],
  ['hidden', '가려짐', 'bg-hidden'],
  ['told', '말해 준 것', 'bg-told'],
]

export type CardEdit = {
  update: (index: number, next: Item, action: 'move' | 'draw' | 'rename') => void
  remove: (index: number) => void
  add: (name: string) => void
}

type PlaceCardProps = {
  place: CardPlace
  hitId?: string
  where: 'draft' | 'search' | 'detail'
  text: Pick<PersonaText, 'boxAsk' | 'boxThanks' | 'boxUnknown'>
  edit?: CardEdit
  onJudge?: (item: Item, ok: boolean) => void
}

const smallBtn = 'persona-round min-h-9 rounded-full border px-3 text-[13px] hover:bg-muted'

export function PlaceCard({ place, hitId, where, text, edit, onJudge }: PlaceCardProps) {
  const label = placeLabel(place)
  // 순서가 아니라 물건 자체를 잡아 둔다 (초안에서 물건을 빼면 순서가 바뀜). 검색 결과는 찾은 물건부터 보여 준다
  const [selected, setSelected] = useState<Item | null>(() => place.items.find((it) => !!hitId && it.id === hitId) ?? null)
  const [judged, setJudged] = useState<Item[]>([])
  const [nameDraft, setNameDraft] = useState<string | null>(null) // 이름 고치는 중이면 입력값
  const [newName, setNewName] = useState('')
  const index = selected ? place.items.indexOf(selected) : -1
  const chosen = index >= 0 ? place.items[index] : null

  function select(item: Item | null) {
    if (item) track('select_item', { where, has_box: !!item.box })
    setSelected(item)
    setNameDraft(null)
  }

  function judge(item: Item, ok: boolean) {
    setJudged((list) => [...list, item])
    onJudge!(item, ok)
  }

  // 고친 물건을 그대로 잡아 둬야 선택이 풀리지 않는다
  function change(next: Item, action: 'move' | 'draw' | 'rename') {
    edit!.update(index, next, action)
    setSelected(next)
  }

  const drawBox = (box: Box) => change({ ...chosen!, box, boxSource: 'user' }, chosen!.box ? 'move' : 'draw')

  // 예전 이름은 다른 이름으로 남겨 그 이름으로도 찾게 한다 (개발계획 5절 이름 고치기)
  function rename(e: FormEvent) {
    e.preventDefault()
    const name = nameDraft?.trim() ?? ''
    setNameDraft(null)
    if (!chosen || !name || name === chosen.name) return
    const aliases = chosen.aliases.includes(chosen.name) ? chosen.aliases : [...chosen.aliases, chosen.name]
    change({ ...chosen, name, aliases }, 'rename')
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    edit!.add(name)
    setNewName('')
  }

  return (
    <div className="w-[min(400px,100%)] overflow-hidden rounded-2xl border bg-card">
      {place.photoUrl && (
        <PhotoBoxes
          src={place.photoUrl}
          alt={`${label} 사진`}
          boxes={place.items.map((it) => it.box)}
          selected={index}
          onSelect={(i) => select(place.items[i] ?? null)}
          onDraw={edit && drawBox}
        />
      )}
      <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
        {place.photoUrl && chosen && (
          <div className="flex flex-col gap-2 text-sm">
            {!chosen.box ? <span className="text-muted-foreground">{text.boxUnknown(chosen.name)}</span>
              : judged.includes(chosen) ? <span className="text-muted-foreground">{text.boxThanks(chosen.name)}</span>
              : onJudge && (
                <>
                  <span>{text.boxAsk(chosen.name)}</span>
                  <QuickReplies
                    options={[{ label: '맞아', run: () => judge(chosen, true) }, { label: '여기 아니야', run: () => judge(chosen, false) }]}
                    onPick={(q) => q.run()}
                  />
                </>
              )}
          </div>
        )}
        {edit && chosen && (
          nameDraft !== null ? (
            <form onSubmit={rename} className="flex gap-1.5">
              <label htmlFor="rename-item" className="sr-only">{chosen.name} 새 이름</label>
              <input
                id="rename-item"
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-base"
              />
              <button type="submit" className={smallBtn}>바꾸기</button>
              <button type="button" className={smallBtn} onClick={() => setNameDraft(null)}>그만</button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={smallBtn} onClick={() => setNameDraft(chosen.name)}>이름 고치기</button>
              {chosen.box && (
                <button type="button" className={smallBtn} onClick={() => change({ ...chosen, box: null, boxSource: null }, 'move')}>박스 지우기</button>
              )}
              {place.photoUrl && <span className="text-xs text-muted-foreground">사진에서 끌어서 박스를 그리거나 옮겨요</span>}
            </div>
          )
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
                  const chipText = it.inside ? `${it.inside} 안: ${it.name}` : it.name
                  return (
                    <li
                      key={i}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm [overflow-wrap:anywhere] ${
                        isSelected ? 'bg-accent font-semibold ring-[1.5px] ring-primary ring-inset'
                          : level === 'hidden' ? 'ring-1 ring-hidden ring-inset' : 'bg-muted'}`}
                    >
                      {place.photoUrl || edit ? (
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => select(isSelected ? null : it)}
                          className="-my-1.5 py-1.5 text-left"
                        >
                          {chipText}
                        </button>
                      ) : chipText}
                      {edit && (
                        <button
                          type="button"
                          aria-label={`${it.name} 빼기`}
                          onClick={() => edit.remove(i)}
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
        {edit && (
          <form onSubmit={add} className="flex gap-1.5">
            <label htmlFor={`add-item-${where}`} className="sr-only">물건 추가</label>
            <input
              id={`add-item-${where}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="빠진 물건 적기"
              className="min-w-0 flex-1 rounded-lg border bg-background px-2.5 py-1.5 text-base placeholder:text-muted-foreground"
            />
            <button type="submit" className={smallBtn}>추가</button>
          </form>
        )}
      </div>
    </div>
  )
}
