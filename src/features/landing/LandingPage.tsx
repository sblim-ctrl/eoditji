import { Fragment, useEffect, useRef, type RefObject } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PERSONAS, type Persona } from '@/lib/personas'

// 랜딩은 로그인 화면처럼 다크 모드·대화 상대 테마 토큰과 상관없이 밝은 중립색으로 고정 (클래스의 #색도 아래 값과 같음)
// 엄마 테마의 장미색을 쓰면 AI 비서가 덜 보여서, 두 상대의 색은 맨 아래 미리보기에만 쓴다
const INK = '#1C1917'
const MUTED = '#78716C'
const SOFT = '#E7E5E4'
const AMBER = '#F6C453'
const CREAM = '#FAFAF9'
const PAPER = '#F5F5F4'
const SERIF = "font-['Gowun_Batang',serif] font-bold"

type ArtProps = { className: string }

const STEPS = [
  {
    tab: '찍기',
    title: '서랍 한 칸을|사진 한 장으로',
    body: '정리하는 김에|칸을 찍어 두세요.\n사진 속 물건 목록은|AI가 대신 적어 둬요.',
    Art: SnapArt,
  },
  {
    tab: '확인하기',
    title: 'AI가 본 물건을|함께 확인해요',
    body: '물건을 누르면|사진에 위치가 표시돼요.\n틀린 건 바로 고치고,\n가려져 안 보이는 곳은|몇 가지만 물어볼게요.',
    Art: CheckArt,
  },
  {
    tab: '찾기',
    title: '다르게 불러도|찾아 드려요',
    body: '“줄자 어디 뒀지?”처럼|말이나 글로 물어보세요.\n그 칸 사진과|찍은 날짜를 보여 드려요.',
    Art: FindArt,
  },
]

export function LandingPage({ onStart }: { onStart: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useReveal(rootRef)

  return (
    // body가 overflow: hidden이라 이 화면이 직접 스크롤함
    <div ref={rootRef} className="h-full overflow-y-auto bg-[#FAFAF9] break-keep text-[#1C1917]">
      {/* 첫 화면: 머리말과 소개가 화면 한 장을 꽉 채워, 아래 구간이 비치지 않게 함 */}
      <div className="relative flex min-h-dvh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8">
          <span className="text-xl font-bold">어디있지?</span>
          <Button variant="ghost" onClick={onStart} className="rounded-xl text-[#1C1917] hover:bg-[#F5F5F4] hover:text-[#1C1917]">
            로그인
          </Button>
        </header>

        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-4 pt-2 pb-16 md:flex-row md:gap-16 md:px-8 md:pt-4 md:pb-20">
          <div className="reveal text-center md:flex-1 md:text-left">
            <h1 className={`${SERIF} text-4xl leading-tight md:text-5xl lg:text-6xl`}><Phrases text={'넣어 둔 곳,\n사진 한 장으로|기억해요'} /></h1>
            <p className="mt-4 text-lg text-[#78716C] md:mt-6 md:text-xl md:leading-relaxed">
              <Phrases text={'가끔 쓰는 물건이|어디 있는지 기억나지 않을 때,\n찍어 둔 칸 사진으로|바로 찾아 드려요.'} />
            </p>
            <Button onClick={onStart} className="mt-6 h-12 rounded-xl bg-[#1C1917] px-8 text-base text-white hover:bg-[#44403C] md:mt-8">
              시작하기
            </Button>
          </div>
          <div className="reveal [--reveal-delay:150ms] md:flex md:flex-1 md:justify-center">
            <HeroPhone />
          </div>
        </section>

        {/* 주소에 #을 남기지 않게 스크롤만 함 (App이 #login으로 로그인 화면을 엶) */}
        <button
          type="button"
          aria-label="어떻게 쓰는지 보기"
          onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute inset-x-0 bottom-4 mx-auto grid size-11 place-items-center rounded-full text-[#78716C] hover:text-[#1C1917]"
        >
          <ChevronDownIcon className="size-6 animate-bounce" />
        </button>
      </div>

      <main>
        {/* 단계마다 한 구간. PC는 한 화면씩 차지하고 그림을 좌우 번갈아 둠 */}
        {STEPS.map(({ tab, title, body, Art }, i) => (
            <section key={tab} id={i === 0 ? 'how' : undefined} aria-labelledby={`step-${i}`} className="md:flex md:min-h-dvh md:items-center">
              <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 text-center md:grid-cols-2 md:gap-16 md:px-8 md:py-24 md:text-left">
                <div className={`reveal ${i % 2 ? 'md:order-2' : ''}`}>
                  <p className="inline-flex items-center gap-2.5 text-lg font-bold md:text-2xl">
                    <span className="grid size-8 place-items-center rounded-full bg-[#1C1917] text-base text-white md:size-11 md:text-xl">{i + 1}</span>
                    {tab}
                  </p>
                  <h2 id={`step-${i}`} className={`${SERIF} mt-4 text-3xl leading-tight md:mt-6 md:text-5xl`}><Phrases text={title} /></h2>
                  <p className="mt-4 text-lg text-[#78716C] md:mt-6 md:text-xl md:leading-relaxed"><Phrases text={body} /></p>
                </div>
                <div className="reveal rounded-2xl border border-[#E7E5E4] bg-white px-6 py-10 [--reveal-delay:150ms] md:py-16">
                  <Art className="mx-auto w-56 md:w-80" />
                </div>
              </div>
            </section>
        ))}

        <section aria-labelledby="persona-title" className="mx-auto max-w-5xl px-4 py-16 text-center md:px-8 md:py-24">
          <h2 id="persona-title" className={`${SERIF} text-3xl leading-tight md:text-5xl`}>대화 상대도 골라요</h2>
          <p className="mx-auto mt-4 text-lg text-[#78716C]">
            <Phrases text={'같은 기록을 두고,|편한 말투로 물어보세요.\n대화 첫 화면에서|엄마와 AI 비서 중에 고를 수 있어요.'} />
          </p>
          <div className="mt-10 grid gap-4 text-left md:mt-14 md:grid-cols-2 md:gap-6">
            <div className="reveal"><PersonaPreview persona="mom" /></div>
            <div className="reveal [--reveal-delay:150ms]"><PersonaPreview persona="jarvis" /></div>
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

// 화면에 들어온 .reveal 요소에 is-shown을 붙여 한 번만 나타나게 함 (index.css). 이 화면은 다시 그려지지 않아 클래스를 직접 붙여도 안전
function useReveal(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-shown')
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.2 })
    rootRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [rootRef])
}

// 줄(\n)에서는 항상 바꾸고, 줄 안에서는 구(|) 사이에서만 바꾼다. 좁은 폰에서도 말이 중간에 끊기지 않게
function Phrases({ text }: { text: string }) {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split('|').map((phrase, j) => (
        <Fragment key={j}>{j > 0 && ' '}<span className="whitespace-nowrap">{phrase}</span></Fragment>
      ))}
    </Fragment>
  ))
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
    <article className={`h-full border p-5 md:p-7 ${look.card}`} style={look.grid ? { background: `${look.grid}, #070D14` } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`px-3 py-1 text-sm font-semibold ${look.chip}`}>{look.label}</h3>
        <span className={`text-sm ${look.muted}`}>{look.desc}</span>
      </div>
      <p className={`mt-6 ${look.hi}`}>{P.hi}</p>
      <p className={`mt-1 leading-tight ${look.title}`}>{P.title}</p>
      <div className="mt-6 flex flex-col gap-2 text-[15px]" aria-label={`${look.label} 대화 예시`}>
        <p className={`self-end px-4 py-2.5 text-balance ${look.me}`}>줄자 어디 뒀지?</p>
        <p className={`max-w-[85%] self-start px-4 py-2.5 text-balance ${look.bot}`}>{P.foundAt('줄자', '책상 둘째 서랍', null)}</p>
      </div>
    </article>
  )
}

// 첫 화면 그림: 휴대폰에 물으면 찍어 둔 칸 사진에서 그 물건을 짚어 주는 장면
function HeroPhone() {
  return (
    <div aria-hidden="true" className="mx-auto w-56 rounded-[2.25rem] border-[3px] border-[#1C1917] bg-white p-2.5 shadow-[10px_10px_0_rgba(28,25,23,0.12)] md:w-72 md:rounded-[2.5rem]">
      <div className="flex flex-col gap-2.5 rounded-[1.8rem] bg-[#F5F5F4] px-3 pt-3 pb-3 md:min-h-[30rem] md:gap-3 md:rounded-[2rem] md:pt-4">
        <i className="mx-auto mb-1 h-1.5 w-14 rounded-full bg-[#D6D3D1] md:mb-3 md:w-16" />
        <p className="self-end rounded-2xl rounded-tr-sm bg-[#1C1917] px-3.5 py-2 text-sm text-white">여권 어디 뒀지?</p>
        <div className="w-[88%] self-start rounded-2xl rounded-tl-sm bg-white p-2.5 shadow-sm">
          <DrawerPhotoArt />
          <p className="mt-2.5 text-sm font-semibold">책상 둘째 서랍</p>
          <p className="text-xs text-[#78716C]">10월 30일에 찍은 사진</p>
        </div>
        {/* 폰에서는 첫 화면 한 장에 들어가게 답 버튼을 뺌 */}
        <div className="hidden gap-1.5 text-xs md:flex">
          <span className="rounded-full border border-[#D6D3D1] bg-white px-3 py-1.5">찾았어!</span>
          <span className="rounded-full border border-[#D6D3D1] bg-white px-3 py-1.5">거기 없던데?</span>
        </div>
        <div className="mt-auto flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs text-[#A8A29E]">
          <span className="flex-1">무엇을 찾을까요?</span>
          <i className="size-5 rounded-full bg-[#1C1917]" />
        </div>
      </div>
    </div>
  )
}

// 위에서 찍은 서랍 속. 여권에만 호박색 박스를 쳐서 시선이 가게 함
function DrawerPhotoArt() {
  return (
    <svg viewBox="0 0 200 128" className="w-full rounded-lg" {...LINE} strokeWidth={2}>
      <rect x="0" y="0" width="200" height="128" fill={PAPER} stroke="none" />
      <rect x="6" y="6" width="188" height="116" rx="6" fill={CREAM} />
      <rect x="20" y="22" width="44" height="58" rx="4" fill={INK} />
      <circle cx="42" cy="46" r="8" stroke={AMBER} />
      <line x1="32" y1="66" x2="52" y2="66" stroke={AMBER} />
      <rect x="80" y="28" width="62" height="10" rx="5" fill="#fff" transform="rotate(-8 111 33)" />
      <circle cx="160" cy="44" r="14" fill={SOFT} />
      <rect x="84" y="62" width="36" height="44" rx="5" fill="#fff" />
      <path d="M134 84c10-14 20 12 30-2s18 8 26-4" />
      <rect x="12" y="14" width="60" height="74" rx="6" stroke={AMBER} strokeWidth={4} className="animate-pulse" />
    </svg>
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
