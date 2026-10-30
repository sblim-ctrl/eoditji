// 말 검색: 브라우저 받아쓰기(Web Speech, ko-KR). 막힌 환경에선 onBlocked로 키보드 마이크를 안내한다 (프로토타입 voiceFail)
import { useRef, useState } from 'react'

type Recognition = {
  lang: string
  interimResults: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const w = window as unknown as Record<string, (new () => Recognition) | undefined>
const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
const BLOCKED = ['not-allowed', 'service-not-allowed', 'audio-capture']

type Options = {
  onHeard: (text: string) => void // 듣는 동안 계속 불림
  onDone: (text: string) => void // 들은 말이 있으면 끝날 때 한 번
  onBlocked: () => void
}

export function useSpeech({ onHeard, onDone, onBlocked }: Options) {
  const [isListening, setIsListening] = useState(false)
  const rec = useRef<Recognition | null>(null)

  function toggle() {
    if (rec.current) return rec.current.stop()
    if (!SR) return onBlocked()
    let heard = ''
    const r = new SR()
    r.lang = 'ko-KR'
    r.interimResults = true
    r.onresult = (e) => {
      heard = Array.from(e.results, (x) => x[0].transcript).join('')
      onHeard(heard)
    }
    r.onerror = (e) => { if (BLOCKED.includes(e.error)) onBlocked() }
    r.onend = () => {
      rec.current = null
      setIsListening(false)
      if (heard.trim()) onDone(heard.trim())
    }
    try {
      r.start()
      rec.current = r
      setIsListening(true)
    } catch {
      onBlocked()
    }
  }

  return { isListening, toggle }
}
