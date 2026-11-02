// 그룹 (P1, D4-6): 보고 있는 그룹 바꾸기, 멤버, 초대 링크 만들기·복사, 새 그룹 만들기
import { type FormEvent, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import type { Group } from '@/lib/api'

type GroupSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: Group[]
  current: Group | null
  people: Map<string, string>
  userId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onInvite: () => Promise<string>
}

const MAX_GROUP_NAME = 30 // create_group과 같은 상한
const field = 'rounded-lg border bg-background px-2.5 py-2 text-base placeholder:text-muted-foreground'
const chip = 'persona-round min-h-11 rounded-full border px-4 text-sm hover:bg-muted disabled:opacity-40'
const label = 'text-xs font-semibold text-muted-foreground'

export function GroupSheet({ open, onOpenChange, groups, current, people, userId, onSelect, onCreate, onInvite }: GroupSheetProps) {
  const isWide = window.matchMedia('(min-width: 768px)').matches
  const [link, setLink] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  async function run(work: () => Promise<void>) {
    setError('')
    setIsBusy(true)
    try {
      await work()
    } catch {
      setError('잠깐 문제가 생겼어요. 다시 해 주세요.')
    } finally {
      setIsBusy(false)
    }
  }

  function choose(id: string) {
    setLink('')
    onSelect(id)
  }

  // 휴대폰은 공유 창(카카오톡 등), 안 되면 복사
  async function share() {
    if (navigator.share) {
      try { return await navigator.share({ title: '어디있지? 초대', text: `'${current?.name}' 기록을 같이 써요`, url: link }) } catch { /* 닫았거나 막힘 → 복사로 */ }
    }
    await navigator.clipboard.writeText(link)
    setIsCopied(true)
  }

  function create(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    void run(async () => { await onCreate(name); setNewName(''); setLink('') })
  }

  const names = [...people].map(([id, name]) => (id === userId ? '나' : name))
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) { setLink(''); setIsCopied(false) } onOpenChange(next) }}>
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        className="max-h-[85dvh] gap-4 overflow-y-auto pt-[max(16px,env(safe-area-inset-top))] pr-[max(16px,env(safe-area-inset-right))] pb-[max(24px,env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] md:max-h-none"
      >
        <div>
          <SheetTitle className="sheet-title font-display text-[26px] leading-tight font-bold">그룹</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">기록을 같이 쓰는 사람들이에요. 칸마다 나만 보기로 바꿀 수 있어요.</SheetDescription>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${label} mb-1.5`}>보고 있는 그룹</legend>
          {groups.map((g) => (
            <label key={g.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 has-[:checked]:border-primary">
              <input type="radio" name="group" checked={g.id === current?.id} onChange={() => choose(g.id)} className="accent-[var(--primary)]" />
              <span className="flex-1">{g.name}</span>
              <span className="text-[13px] text-muted-foreground">{g.memberCount}명</span>
            </label>
          ))}
        </fieldset>

        {names.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <h3 className={label}>멤버</h3>
            <p className="text-sm">{names.join(', ')}</p>
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className={label}>'{current?.name}'에 초대하기</h3>
          {link ? (
            <>
              <input readOnly value={link} aria-label="초대 링크" onFocus={(e) => e.currentTarget.select()} className={field} />
              <div className="flex items-center gap-2">
                <button type="button" className={chip} onClick={() => void run(share)}>{isCopied ? '복사했어요' : '링크 보내기'}</button>
                <span className="text-[13px] text-muted-foreground">7일 동안 쓸 수 있어요</span>
              </div>
            </>
          ) : (
            <button type="button" disabled={isBusy || !current} className={`${chip} self-start`} onClick={() => void run(async () => setLink(await onInvite()))}>
              초대 링크 만들기
            </button>
          )}
        </section>

        <form onSubmit={create} className="flex flex-col gap-1.5">
          <label htmlFor="new-group" className={label}>새 그룹 만들기</label>
          <div className="flex gap-2">
            <input id="new-group" value={newName} maxLength={MAX_GROUP_NAME} onChange={(e) => setNewName(e.target.value)} placeholder="예: 본가, 작업실" className={`${field} min-w-0 flex-1`} />
            <button type="submit" disabled={isBusy || !newName.trim()} className={chip}>만들기</button>
          </div>
        </form>

        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
      </SheetContent>
    </Sheet>
  )
}
