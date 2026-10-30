// 대화 화면 (프로토타입 .app): 위 헤더, 가운데 대화, 아래 입력창. 720px 한 줄 기둥, 모바일 우선
import { useEffect, useRef, useState } from 'react'
import { ArchiveIcon, CameraIcon, LogOutIcon, SearchIcon, SquarePenIcon } from 'lucide-react'
import { getPersona, setPersona as savePersona } from '@/lib/api'
import { PERSONAS, type Persona, PRIVACY_NOTE, SHOOT_TIP } from '@/lib/personas'
import { supabase } from '@/lib/supabase'
import { PlacesSheet } from '@/features/places/PlacesSheet'
import { Avatar } from './Avatar'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { useChatFlow } from './useChatFlow'

const EXAMPLE_QUESTIONS = ['이어팁 어디 있어?', '겨울 이불 어디 뒀더라?']

// iOS Safari는 interactive-widget을 몰라 키보드가 입력창을 가리므로 보이는 높이에 맞춘다
function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const fit = () => {
      if (vv.scale !== 1) return // 확대 중에는 건드리지 않음
      document.documentElement.style.setProperty('--app-h', `${vv.height}px`)
      window.scrollTo(0, 0)
    }
    fit()
    vv.addEventListener('resize', fit)
    return () => vv.removeEventListener('resize', fit)
  }, [])
}

export function ChatPage({ userId }: { userId: string }) {
  const [persona, setPersona] = useState<Persona>('mom')
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLElement>(null)
  const P = PERSONAS[persona]
  const flow = useChatFlow({ persona, shoot: () => cameraRef.current?.click(), openPlaces: () => setIsSheetOpen(true) })

  useVisualViewportHeight()
  useEffect(() => { getPersona().then(setPersona, () => {}) }, [])
  useEffect(() => { document.documentElement.dataset.persona = persona }, [persona])

  useEffect(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }))
  }, [flow.messages])

  // 상대는 첫 화면에서만 고른다 (대화 중 말투가 섞이지 않게). 바꾸려면 새 대화
  function choosePersona(next: Persona) {
    setPersona(next)
    savePersona(userId, next).catch(() => {}) // 저장에 실패해도 이번 화면에서는 고른 상대로 계속
  }

  function placeholder(isListening: boolean, hasPhoto: boolean) {
    if (isListening) return P.hold.listening
    if (hasPhoto || flow.step === 'name') return P.hold.name
    return flow.step ? P.hold[flow.step] : P.hold.idle
  }

  const isWelcome = flow.messages.length === 0
  const hint = flow.step ? null : flow.places.length ? SHOOT_TIP : `${PRIVACY_NOTE} ${SHOOT_TIP}`
  const iconBtn = 'grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground'
  const chip = 'persona-round inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm hover:border-transparent hover:bg-accent'

  return (
    <div className="app-shell grid grid-rows-[auto_1fr_auto]">
      <header className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar persona={persona} size={40} />
          <div>
            <strong className="who-name block font-display text-[22px] leading-tight font-bold">{P.name}</strong>
            <small className="block text-[13px] leading-snug text-muted-foreground">{P.count(flow.places.length)}</small>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" className={iconBtn} aria-label="기억해 둔 곳 보기" onClick={() => setIsSheetOpen(true)}><ArchiveIcon className="size-5" /></button>
          <button type="button" className={iconBtn} aria-label="새 대화" onClick={flow.reset}><SquarePenIcon className="size-5" /></button>
          <button type="button" className={iconBtn} aria-label="로그아웃" onClick={() => supabase.auth.signOut()}><LogOutIcon className="size-5" /></button>
        </div>
      </header>

      <main ref={scrollRef} className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[720px]">
          {isWelcome ? (
            <section className="flex flex-col items-center gap-5 py-6 text-center">
              <fieldset className="persona-round inline-flex gap-0.5 rounded-full border bg-card p-[3px]">
                <legend className="sr-only">대화 상대 고르기</legend>
                {(['mom', 'jarvis'] as const).map((key) => (
                  <label key={key} className="relative">
                    <input type="radio" name="persona" value={key} checked={persona === key} onChange={() => choosePersona(key)} className="peer absolute inset-0 m-0 cursor-pointer opacity-0" />
                    <span className="persona-round block rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
                      {key === 'mom' ? '엄마' : 'AI 비서'}
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="halo relative mt-3 grid place-items-center"><Avatar persona={persona} size={96} isSpinning /></div>
              <div>
                <small className="hello-hi block font-display text-[22px] leading-tight text-muted-foreground">{P.hi}</small>
                <h1 className="hello-title mt-0.5 mb-2 font-display text-4xl leading-tight font-bold text-balance">{P.title}</h1>
                <p className="mx-auto max-w-[28em] text-[15px] text-pretty text-muted-foreground">{P.intro}</p>
              </div>
              <div className="flex max-w-[520px] flex-wrap justify-center gap-2">
                <button type="button" className={chip} onClick={() => cameraRef.current?.click()}><CameraIcon className="size-4 text-primary" />서랍 사진 찍기</button>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button key={q} type="button" className={chip} onClick={() => flow.send(q)}><SearchIcon className="size-4 text-primary" />{q}</button>
                ))}
                <button type="button" className={chip} onClick={() => setIsSheetOpen(true)}><ArchiveIcon className="size-4 text-primary" />기억해 둔 곳</button>
              </div>
            </section>
          ) : (
            <MessageList messages={flow.messages} persona={persona} onPick={flow.pick} onRemove={flow.removeItem} />
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[720px] pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Composer
          label={P.inputLabel}
          placeholder={placeholder}
          hint={hint}
          isBusy={flow.busy}
          cameraRef={cameraRef}
          onSend={flow.send}
          onPhotoRejected={flow.photoRejected}
          onVoiceBlocked={flow.voiceBlocked}
        />
      </footer>

      <PlacesSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} places={flow.places} text={P} onChanged={flow.reloadPlaces} />
    </div>
  )
}
