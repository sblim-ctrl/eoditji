import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { PERSONAS, type Persona } from '@/lib/personas'

// 랜딩은 로그인 화면처럼 다크 모드·대화 상대 테마 토큰과 상관없이 밝은 중립색으로 고정 (클래스의 #색도 아래 값과 같음)
// 엄마 테마의 장미색을 쓰면 AI 비서가 덜 보여서, 두 상대의 색은 맨 아래 미리보기에만 쓴다
const INK = '#1C1917'
const MUTED = '#78716C'
const SOFT = '#E7E5E4'
const AMBER = '#F6C453'
const STONE = '#D6D3D1'
const CREAM = '#FAFAF9'
const PAPER = '#F5F5F4'
const SERIF = "font-['Gowun_Batang',serif] font-bold"

type ArtProps = { className: string }

const STEPS = [
  {
    tab: '찍기',
    title: '서랍 한 칸을\n사진 한 장으로',
    body: '정리하는 김에 칸을 찍어 두세요.\n사진 속 물건 목록은 AI가 대신 적어 둬요.',
    Art: SnapArt,
  },
  {
    tab: '확인하기',
    title: 'AI가 본 물건을\n함께 확인해요',
    body: '물건을 누르면 사진에 위치가 표시돼요.\n틀린 건 바로 고치고,\n가려져 안 보이는 곳은 몇 가지만 물어볼게요.',
    Art: CheckArt,
  },
  {
    tab: '찾기',
    title: '다르게 불러도\n찾아 드려요',
    body: '“줄자 어디 뒀지?”처럼 말이나 글로 물어보세요.\n그 칸 사진과 찍은 날짜를 보여 드려요.',
    Art: FindArt,
  },
]

export function LandingPage({ onStart }: { onStart: () => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLElement>(null)
  const { progress, scrollToStep } = useScrollSteps(scrollerRef, trackRef)
  const step = Math.min(Math.floor(progress), STEPS.length - 1)
  const { title, body, Art } = STEPS[step]

  // WAI-ARIA 탭 패턴: 좌우 화살표로 옮기고 포커스도 따라감
  function moveByArrow(e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    const next = (step + delta + STEPS.length) % STEPS.length
    scrollToStep(next)
    document.getElementById(`step-tab-${next}`)?.focus({ preventScroll: true })
  }

  return (
    // body가 overflow: hidden이라 이 화면이 직접 스크롤함
    <div ref={scrollerRef} className="h-full overflow-y-auto bg-[#FAFAF9] break-keep text-[#1C1917]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <span className="text-xl font-bold">어디있지?</span>
        <Button variant="ghost" onClick={onStart} className="rounded-xl text-[#1C1917] hover:bg-[#F5F5F4] hover:text-[#1C1917]">
          로그인
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-10 pb-14 text-center md:pt-16 md:pb-20">
          <h1 className={`${SERIF} text-4xl leading-tight md:text-6xl`}>넣어 둔 곳,<br />사진 한 장으로 기억해요</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[#78716C] md:max-w-none md:whitespace-pre-line">
            {'가끔 쓰는 물건이 어디 있는지 기억나지 않을 때,\n찍어 둔 칸 사진으로 바로 찾아 드려요.'}
          </p>
          <Button onClick={onStart} className="mt-8 h-12 rounded-xl bg-[#1C1917] px-8 text-base text-white hover:bg-[#44403C]">
            시작하기
          </Button>
        </section>

        {/* 높이를 늘린 구간에서 카드를 화면에 고정하고, 스크롤한 만큼 단계를 넘김. 폰은 작은 화면에 들어가게 여백을 줄임 */}
        <section ref={trackRef} aria-labelledby="how-title" className="mx-auto h-[250vh] max-w-6xl px-4 md:px-8">
          <h2 id="how-title" className="sr-only">이렇게 써요</h2>
          <div className="sticky top-0 flex h-dvh items-center">
            <div className="w-full rounded-2xl bg-[#E7E5E4] px-4 py-6 md:px-20 md:py-16">
              <div className="relative mx-auto max-w-4xl">
                <Polaroid color={AMBER} className="top-16 -left-10 -rotate-12" />
                <Polaroid color={STONE} className="top-8 -right-10 rotate-12" />

                <div className="overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/25">
                  <div className="flex gap-1.5 bg-[#F5F5F4] px-3 py-2" aria-hidden="true">
                    <i className="size-2 rounded-full bg-[#D6D3D1]" />
                    <i className="size-2 rounded-full bg-[#D6D3D1]" />
                    <i className="size-2 rounded-full bg-[#D6D3D1]" />
                  </div>

                  <div className="px-5 py-6 md:px-12 md:py-14">
                    <div role="tablist" aria-label="이렇게 써요" onKeyDown={moveByArrow} className="flex justify-center gap-2 md:gap-6">
                      {STEPS.map((s, i) => (
                        <button
                          key={s.tab}
                          id={`step-tab-${i}`}
                          type="button"
                          role="tab"
                          aria-selected={i === step}
                          aria-controls="step-panel"
                          tabIndex={i === step ? 0 : -1}
                          onClick={() => scrollToStep(i)}
                          className={`relative px-3 pb-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#1C1917]/30 md:px-6 md:text-base ${i === step ? 'font-semibold' : 'text-[#78716C]'}`}
                        >
                          {s.tab}
                          <span className="absolute inset-x-0 bottom-0 h-px bg-[#D6D3D1]" />
                          {i === step && (
                            <span
                              style={{ transform: `scaleX(${progress - step})` }}
                              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#1C1917]"
                            />
                          )}
                        </button>
                      ))}
                    </div>

                    <div
                      key={step}
                      id="step-panel"
                      role="tabpanel"
                      aria-labelledby={`step-tab-${step}`}
                      className="mt-6 grid animate-in items-center gap-4 duration-500 fade-in slide-in-from-bottom-2 md:mt-14 md:min-h-64 md:grid-cols-2 md:gap-10"
                    >
                      <Art className="mx-auto w-44 md:w-full md:max-w-72" />
                      <div className="text-center">
                        <h3 className={`${SERIF} text-2xl leading-snug whitespace-pre-line md:text-3xl`}>{title}</h3>
                        {/* 폰에서 설명 줄 수가 달라도 고정된 카드가 들썩이지 않게 3줄 높이를 잡아 둠 */}
                        <p className="mx-auto mt-3 min-h-18 max-w-xs text-[#78716C] md:min-h-0 md:max-w-none md:whitespace-pre-line">{body}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="persona-title" className="mx-auto max-w-5xl px-4 py-16 text-center md:px-8 md:py-24">
          <h2 id="persona-title" className={`${SERIF} text-3xl leading-tight md:text-5xl`}>대화 상대도 골라요</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#78716C] md:max-w-none md:whitespace-pre-line">
            {'같은 기록을 두고, 편한 말투로 물어보세요.\n대화 첫 화면에서 엄마와 AI 비서 중에 고를 수 있어요.'}
          </p>
          <div className="mt-10 grid gap-4 text-left md:mt-14 md:grid-cols-2 md:gap-6">
            <PersonaPreview persona="mom" />
            <PersonaPreview persona="jarvis" />
          </div>
          <Button onClick={onStart} className="mt-12 h-12 rounded-xl bg-[#1C1917] px-8 text-base text-white hover:bg-[#44403C]">
            시작하기
          </Button>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl justify-between px-4 pb-10 text-sm text-[#78716C] md:px-8">
        <span>© 2026 어디있지</span>
        <a href="/privacy.html" className="underline-offset-4 hover:underline">개인정보처리방침</a>
      </footer>
    </div>
  )
}

// 스크롤 진행도(0~STEPS.length). 고정 구간을 지나는 동안만 바뀜
function useScrollSteps(scrollerRef: RefObject<HTMLDivElement | null>, trackRef: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const scroller = scrollerRef.current
    const track = trackRef.current
    if (!scroller || !track) return
    const update = () => {
      const { start, distance } = trackRange(scroller, track)
      setProgress(Math.min(Math.max((scroller.scrollTop - start) / distance, 0), 1) * STEPS.length)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      scroller.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [scrollerRef, trackRef])

  // 탭을 누르면 그 단계 구간의 가운데로 스크롤
  function scrollToStep(i: number) {
    const scroller = scrollerRef.current
    const track = trackRef.current
    if (!scroller || !track) return
    const { start, distance } = trackRange(scroller, track)
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.scrollTo({ top: start + (distance * (i + 0.5)) / STEPS.length, behavior: isReduced ? 'auto' : 'smooth' })
  }

  return { progress, scrollToStep }
}

// 고정 구간이 스크롤 안에서 시작하는 위치와, 세 단계를 넘기는 데 쓰는 스크롤 길이
function trackRange(scroller: HTMLElement, track: HTMLElement) {
  const start = track.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  return { start, distance: track.offsetHeight - scroller.clientHeight }
}

// 대화 상대 미리보기. 색과 글꼴은 index.css의 두 테마 값과 같음 (랜딩은 테마 토큰을 받지 않음)
const LOOKS = {
  mom: {
    label: '엄마', desc: '다정한 반말로 챙겨 줘요',
    card: 'rounded-2xl border-[#F0E2D9] bg-[#FFFBF8] text-[#2A211E]', chip: 'rounded-full bg-[#D6435C] text-white', muted: 'text-[#7D6B64]',
    hi: 'text-[#7D6B64]', title: "font-['Gaegu',sans-serif] text-3xl font-bold md:text-4xl",
    me: 'rounded-2xl rounded-tr-sm bg-[#3A3150] text-white', bot: 'rounded-2xl rounded-tl-sm bg-[#FFEFE5]', grid: undefined,
  },
  jarvis: {
    label: 'AI 비서', desc: '정중한 말투로 짧게 보고해요',
    card: 'rounded-lg border-[#183041] bg-[#070D14] text-[#DCF2FF]', chip: 'rounded-md bg-[#38D4FF] text-[#03131B]', muted: 'text-[#7C9DB0]',
    hi: "font-['IBM_Plex_Mono',monospace] text-xs tracking-[.2em] text-[#38D4FF]", title: 'text-2xl font-semibold md:text-3xl',
    me: 'rounded-lg rounded-tr-sm bg-[#0E3A50] text-[#E6F8FF]', bot: 'rounded-lg rounded-tl-sm bg-[#0B1B27] ring-1 ring-[#183041] ring-inset',
    grid: 'linear-gradient(rgba(56,212,255,.05) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, rgba(56,212,255,.05) 1px, transparent 1px) 0 0 / 28px 28px',
  },
} as const

function PersonaPreview({ persona }: { persona: Persona }) {
  const look = LOOKS[persona]
  const P = PERSONAS[persona]
  return (
    <article className={`border p-5 md:p-7 ${look.card}`} style={look.grid ? { background: `${look.grid}, #070D14` } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`px-3 py-1 text-sm font-semibold ${look.chip}`}>{look.label}</h3>
        <span className={`text-sm ${look.muted}`}>{look.desc}</span>
      </div>
      <p className={`mt-6 ${look.hi}`}>{P.hi}</p>
      <p className={`mt-1 leading-tight ${look.title}`}>{P.title}</p>
      <div className="mt-6 flex flex-col gap-2 text-[15px]" aria-label={`${look.label} 대화 예시`}>
        <p className={`self-end px-4 py-2.5 ${look.me}`}>줄자 어디 뒀지?</p>
        <p className={`max-w-[85%] self-start px-4 py-2.5 ${look.bot}`}>{P.foundAt('줄자', '책상 둘째 서랍', null)}</p>
      </div>
    </article>
  )
}

// 카드 가장자리에 걸친 즉석 사진 장식. 폰 화면에서는 숨김
function Polaroid({ color, className }: { color: string; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute z-10 hidden size-20 rounded-sm border-2 border-[#1C1917] bg-white p-2 pb-5 shadow-[6px_6px_0_rgba(28,25,23,0.18)] md:block ${className}`}
    >
      <div className="size-full border-2 border-[#1C1917]" style={{ backgroundColor: color }} />
    </div>
  )
}

// 일러스트 공통 선: 진한 갈색 선 + 색 한두 개만 채움
const LINE = { fill: 'none', stroke: INK, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

// 1. 찍기: 열린 서랍 앞에서 휴대폰으로 찰칵
function SnapArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 200" aria-hidden="true" className={className} {...LINE}>
      <ellipse cx="110" cy="190" rx="92" ry="6" fill={PAPER} stroke="none" />
      <rect x="24" y="64" width="120" height="120" rx="8" fill="#fff" />
      <rect x="34" y="74" width="100" height="26" rx="4" />
      <line x1="76" y1="87" x2="92" y2="87" />
      <circle cx="58" cy="116" r="10" fill={AMBER} />
      <circle cx="58" cy="116" r="3.5" />
      <rect x="80" y="108" width="34" height="8" rx="4" fill={SOFT} transform="rotate(-14 97 112)" />
      <rect x="18" y="122" width="132" height="32" rx="4" fill={CREAM} />
      <line x1="76" y1="138" x2="92" y2="138" />
      <rect x="34" y="160" width="100" height="16" rx="4" />
      <g transform="rotate(10 184 92)">
        <rect x="152" y="34" width="64" height="116" rx="12" fill="#fff" />
        <rect x="160" y="46" width="48" height="80" rx="4" fill={SOFT} stroke="none" />
        <path d="M166 60v-8h8M202 60v-8h-8M166 112v8h8M202 112v8h-8" stroke={INK} />
        <rect x="172" y="78" width="24" height="16" rx="2" stroke={INK} />
        <line x1="180" y1="86" x2="188" y2="86" stroke={INK} />
        <circle cx="184" cy="138" r="6" fill={INK} />
      </g>
      <path d="M152 22l-8-9M166 16l1-12M144 34l-12-2" />
    </svg>
  )
}

// 2. 확인하기: AI가 사진 속 물건마다 박스를 쳐 둠
function CheckArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 200" aria-hidden="true" className={className} {...LINE}>
      <ellipse cx="120" cy="190" rx="92" ry="6" fill={PAPER} stroke="none" />
      <rect x="24" y="22" width="192" height="156" rx="6" fill="#fff" />
      <rect x="36" y="34" width="168" height="106" rx="3" fill={CREAM} />
      <circle cx="76" cy="90" r="20" fill={AMBER} />
      <circle cx="76" cy="90" r="8" fill={CREAM} />
      <path d="M128 100L146 58M140 100L118 58" />
      <circle cx="126" cy="106" r="7" fill={SOFT} />
      <circle cx="142" cy="106" r="7" fill={SOFT} />
      <rect x="166" y="66" width="18" height="44" rx="3" fill="#fff" />
      <rect x="171" y="60" width="8" height="6" rx="1" fill={INK} />
      <rect x="48" y="62" width="56" height="56" rx="4" stroke={INK} strokeDasharray="5 5" />
      <rect x="158" y="52" width="34" height="66" rx="4" stroke={INK} strokeDasharray="5 5" />
      <text x="120" y="164" textAnchor="middle" fontSize="14" fill={MUTED} stroke="none">테이프 · 가위 · 건전지</text>
      <circle cx="210" cy="28" r="16" fill={INK} />
      <path d="M202 28l6 6 10-11" stroke="#fff" strokeWidth="3" />
    </svg>
  )
}

// 3. 찾기: 다르게 불러도 그 칸을 짚어 줌
function FindArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 200" aria-hidden="true" className={className} {...LINE}>
      <ellipse cx="156" cy="190" rx="76" ry="6" fill={PAPER} stroke="none" />
      <path d="M36 16H146A20 20 0 0 1 146 56H56L38 70 42 56H36A20 20 0 0 1 36 16Z" fill="#fff" />
      <text x="91" y="41" textAnchor="middle" fontSize="14" fill={INK} stroke="none">줄자 어디 뒀지?</text>
      <rect x="96" y="84" width="120" height="100" rx="8" fill="#fff" />
      <rect x="106" y="94" width="100" height="24" rx="4" />
      <line x1="148" y1="106" x2="164" y2="106" />
      <rect x="106" y="124" width="100" height="24" rx="4" fill={INK} />
      <line x1="148" y1="136" x2="164" y2="136" stroke="#fff" />
      <rect x="106" y="154" width="100" height="22" rx="4" />
      <line x1="148" y1="165" x2="164" y2="165" />
      <path d="M58 80C58 116 70 136 94 136" stroke={INK} strokeDasharray="5 5" />
      <path d="M86 129l8 7-8 7" stroke={INK} />
      <path d="M224 122l10-6M226 136h12M224 150l10 6" />
    </svg>
  )
}
