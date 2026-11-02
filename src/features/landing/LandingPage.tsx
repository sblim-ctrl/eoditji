import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Button } from '@/components/ui/button'

// 랜딩은 로그인 화면처럼 다크 모드·대화 상대 테마 토큰과 상관없이 밝은 색으로 고정 (클래스의 #색도 아래 값과 같음)
const INK = '#2A211E'
const MUTED = '#7D6B64'
const ROSE = '#D6435C'
const ROSE_SOFT = '#FCE3E8'
const AMBER = '#F6C453'
const PEACH = '#FFE0CE'
const CREAM = '#FFFBF8'
const PAPER = '#F8EEE8'
const SERIF = "font-['Gowun_Batang',serif] font-bold"

type ArtProps = { className: string }

const STEPS = [
  {
    tab: '찍기',
    title: '서랍 한 칸을\n사진 한 장으로',
    body: '정리하는 김에 칸을 찍어 두세요. 사진 속 물건 목록은 AI가 대신 적어 둬요.',
    Art: SnapArt,
  },
  {
    tab: '확인하기',
    title: 'AI가 본 물건을\n함께 확인해요',
    body: '물건을 누르면 사진에 위치가 표시돼요. 틀린 건 바로 고치고, 가려져 안 보이는 곳은 몇 가지만 물어볼게요.',
    Art: CheckArt,
  },
  {
    tab: '찾기',
    title: '다르게 불러도\n찾아 드려요',
    body: '“줄자 어디 뒀지?”처럼 말이나 글로 물어보세요. 그 칸 사진과 찍은 날짜를 보여 드려요.',
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
    <div ref={scrollerRef} className="h-full overflow-y-auto bg-[#FFFBF8] break-keep text-[#2A211E]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <span className="text-xl font-bold">어디있지?</span>
        <Button variant="ghost" onClick={onStart} className="rounded-xl text-[#2A211E] hover:bg-[#F8EEE8] hover:text-[#2A211E]">
          로그인
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pt-10 pb-14 text-center md:pt-16 md:pb-20">
          <h1 className={`${SERIF} text-4xl leading-tight md:text-6xl`}>넣어 둔 곳,<br />사진 한 장으로 기억해요</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[#7D6B64]">
            가끔 쓰는 물건이 어디 있는지 기억나지 않을 때, 찍어 둔 칸 사진으로 바로 찾아 드려요.
          </p>
          <Button onClick={onStart} className="mt-8 h-12 rounded-xl bg-[#BF3A51] px-8 text-base text-white hover:bg-[#A63249]">
            시작하기
          </Button>
        </section>

        {/* 높이를 늘린 구간에서 카드를 화면에 고정하고, 스크롤한 만큼 단계를 넘김. 폰은 작은 화면에 들어가게 여백을 줄임 */}
        <section ref={trackRef} aria-labelledby="how-title" className="mx-auto h-[250vh] max-w-6xl px-4 md:px-8">
          <h2 id="how-title" className="sr-only">이렇게 써요</h2>
          <div className="sticky top-0 flex h-dvh items-center">
            <div className="w-full rounded-2xl bg-[#D6435C] px-4 py-6 md:px-20 md:py-16">
              <div className="relative mx-auto max-w-4xl">
                <Polaroid color={AMBER} className="top-16 -left-10 -rotate-12" />
                <Polaroid color={PEACH} className="top-8 -right-10 rotate-12" />

                <div className="overflow-hidden rounded-lg bg-white shadow-2xl shadow-black/25">
                  <div className="flex gap-1.5 bg-[#F8EEE8] px-3 py-2" aria-hidden="true">
                    <i className="size-2 rounded-full bg-[#E3D2C8]" />
                    <i className="size-2 rounded-full bg-[#E3D2C8]" />
                    <i className="size-2 rounded-full bg-[#E3D2C8]" />
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
                          className={`relative px-3 pb-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#D6435C]/40 md:px-6 md:text-base ${i === step ? 'font-semibold' : 'text-[#7D6B64]'}`}
                        >
                          {s.tab}
                          <span className="absolute inset-x-0 bottom-0 h-px bg-[#E3D2C8]" />
                          {i === step && (
                            <span
                              style={{ transform: `scaleX(${progress - step})` }}
                              className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#D6435C]"
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
                        <p className="mx-auto mt-3 min-h-18 max-w-xs text-[#7D6B64] md:min-h-0">{body}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl justify-between px-4 pb-10 text-sm text-[#7D6B64] md:px-8">
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

// 카드 가장자리에 걸친 즉석 사진 장식. 폰 화면에서는 숨김
function Polaroid({ color, className }: { color: string; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute z-10 hidden size-20 rounded-sm border-2 border-[#2A211E] bg-white p-2 pb-5 shadow-[6px_6px_0_rgba(42,33,30,0.18)] md:block ${className}`}
    >
      <div className="size-full border-2 border-[#2A211E]" style={{ backgroundColor: color }} />
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
      <rect x="80" y="108" width="34" height="8" rx="4" fill={ROSE_SOFT} transform="rotate(-14 97 112)" />
      <rect x="18" y="122" width="132" height="32" rx="4" fill={CREAM} />
      <line x1="76" y1="138" x2="92" y2="138" />
      <rect x="34" y="160" width="100" height="16" rx="4" />
      <g transform="rotate(10 184 92)">
        <rect x="152" y="34" width="64" height="116" rx="12" fill="#fff" />
        <rect x="160" y="46" width="48" height="80" rx="4" fill={ROSE_SOFT} stroke="none" />
        <path d="M166 60v-8h8M202 60v-8h-8M166 112v8h8M202 112v8h-8" stroke={ROSE} />
        <rect x="172" y="78" width="24" height="16" rx="2" stroke={ROSE} />
        <line x1="180" y1="86" x2="188" y2="86" stroke={ROSE} />
        <circle cx="184" cy="138" r="6" fill={ROSE} />
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
      <circle cx="126" cy="106" r="7" fill={ROSE_SOFT} />
      <circle cx="142" cy="106" r="7" fill={ROSE_SOFT} />
      <rect x="166" y="66" width="18" height="44" rx="3" fill="#fff" />
      <rect x="171" y="60" width="8" height="6" rx="1" fill={INK} />
      <rect x="48" y="62" width="56" height="56" rx="4" stroke={ROSE} strokeDasharray="5 5" />
      <rect x="158" y="52" width="34" height="66" rx="4" stroke={ROSE} strokeDasharray="5 5" />
      <text x="120" y="164" textAnchor="middle" fontSize="14" fill={MUTED} stroke="none">테이프 · 가위 · 건전지</text>
      <circle cx="210" cy="28" r="16" fill={ROSE} />
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
      <rect x="106" y="124" width="100" height="24" rx="4" fill={ROSE} />
      <line x1="148" y1="136" x2="164" y2="136" stroke="#fff" />
      <rect x="106" y="154" width="100" height="22" rx="4" />
      <line x1="148" y1="165" x2="164" y2="165" />
      <path d="M58 80C58 116 70 136 94 136" stroke={ROSE} strokeDasharray="5 5" />
      <path d="M86 129l8 7-8 7" stroke={ROSE} />
      <path d="M224 122l10-6M226 136h12M224 150l10 6" />
    </svg>
  )
}
