// 입력창: 글, 사진(카메라로 찍기 / 앨범에서 고르기), 말하기
import { type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject, useRef, useState } from 'react'
import { ArrowUpIcon, CameraIcon, ImageIcon, MicIcon, XIcon } from 'lucide-react'
import { type Photo, readPhoto } from '@/lib/photo'
import { useSpeech } from './useSpeech'

const MAX_TEXTAREA_PX = 140

type ComposerProps = {
  label: string
  placeholder: (isListening: boolean, hasPhoto: boolean) => string
  hint: string | null
  isBusy: boolean
  cameraRef: RefObject<HTMLInputElement | null>
  onSend: (text: string, photo?: Photo) => void
  onPhotoRejected: () => void
  onVoiceBlocked: () => void
}

export function Composer({ label, placeholder, hint, isBusy, cameraRef, onSend, onPhotoRejected, onVoiceBlocked }: ComposerProps) {
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const baseRef = useRef('')

  const speech = useSpeech({
    onHeard: (heard) => setText((baseRef.current ? `${baseRef.current} ` : '') + heard),
    onDone: () => formRef.current?.requestSubmit(),
    onBlocked: () => { inputRef.current?.focus(); onVoiceBlocked() },
  })

  function autosize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`
  }

  async function attach(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setPhoto(await readPhoto(file))
      inputRef.current?.focus()
    } catch {
      onPhotoRejected()
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (isBusy || (!t && !photo)) return
    setText('')
    setPhoto(null)
    requestAnimationFrame(autosize)
    onSend(t, photo ?? undefined)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const tool = 'persona-round inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm hover:bg-muted'
  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-1.5 rounded-[22px] border bg-card py-2 pr-2 pl-3.5 shadow-[0_8px_28px_-14px_var(--shadow)] focus-within:border-muted-foreground">
      {photo && (
        <div className="relative mt-1 w-[72px]">
          <img src={photo.thumbUrl} alt="첨부한 사진" className="block size-[72px] rounded-xl object-cover" />
          <button type="button" aria-label="사진 빼기" onClick={() => setPhoto(null)} className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background">
            <XIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      <label htmlFor="composer-input" className="sr-only">{label}</label>
      <textarea
        id="composer-input"
        ref={inputRef}
        rows={1}
        value={text}
        placeholder={placeholder(speech.isListening, !!photo)}
        onChange={(e) => { setText(e.target.value); autosize() }}
        onKeyDown={onKeyDown}
        className="min-h-[30px] resize-none border-0 bg-transparent py-1 text-base leading-normal outline-none placeholder:text-muted-foreground"
      />
      {hint && !photo && !text && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-1.5">
        <label className={`${tool} cursor-pointer`}>
          <CameraIcon className="size-[18px]" aria-hidden="true" />찍기
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={attach} />
        </label>
        <label className={`${tool} cursor-pointer`}>
          <ImageIcon className="size-[18px]" aria-hidden="true" />앨범
          <input type="file" accept="image/*" className="sr-only" onChange={attach} />
        </label>
        <button
          type="button"
          aria-label={speech.isListening ? '듣기 멈추기' : '말로 하기'}
          aria-pressed={speech.isListening}
          onClick={() => { baseRef.current = text.trim(); speech.toggle() }}
          className={`${tool} ${speech.isListening ? 'listening border-primary bg-primary text-primary-foreground hover:bg-primary' : ''}`}
        >
          <MicIcon className="size-[18px]" aria-hidden="true" />
        </button>
        <button
          type="submit"
          aria-label="보내기"
          disabled={isBusy || (!text.trim() && !photo)}
          className="ml-auto grid size-11 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-35"
        >
          <ArrowUpIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}
