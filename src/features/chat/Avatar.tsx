// 대화 상대 아바타 (프로토타입 SVG). 색은 index.css의 --av-* 토큰을 따른다
import type { Persona } from '@/lib/personas'

function Mom() {
  return (
    <>
      <rect width="64" height="64" fill="var(--av-bg)" />
      <g fill="var(--av-hair)">
        <circle cx="18" cy="30" r="8" /><circle cx="46" cy="30" r="8" />
        <circle cx="20" cy="20" r="8" /><circle cx="44" cy="20" r="8" />
        <circle cx="27" cy="13" r="8" /><circle cx="37" cy="13" r="8" />
        <circle cx="17" cy="39" r="6" /><circle cx="47" cy="39" r="6" />
      </g>
      <path d="M10 66c1-11 10-17 22-17s21 6 22 17z" fill="var(--av-apron)" />
      <path d="M27.5 49l4.5 6 4.5-6z" fill="var(--av-skin)" />
      <ellipse cx="32" cy="35" rx="13" ry="14" fill="var(--av-skin)" />
      <g fill="var(--av-hair)"><circle cx="24" cy="23" r="6" /><circle cx="32" cy="21" r="6" /><circle cx="40" cy="23" r="6" /></g>
      <g fill="none" stroke="var(--av-hair)" strokeWidth="2" strokeLinecap="round">
        <path d="M24.5 35q2.5-3 5 0" /><path d="M34.5 35q2.5-3 5 0" /><path d="M28.5 41.5q3.5 3 7 0" />
      </g>
      <circle cx="23" cy="40" r="2.6" fill="var(--av-cheek)" opacity=".7" />
      <circle cx="41" cy="40" r="2.6" fill="var(--av-cheek)" opacity=".7" />
    </>
  )
}

function Jarvis() {
  return (
    <>
      <rect width="64" height="64" fill="var(--av-bg)" />
      <circle cx="32" cy="32" r="14" fill="var(--primary)" opacity=".18" />
      <g fill="none" stroke="var(--primary)">
        <circle cx="32" cy="32" r="25" pathLength="120" strokeWidth="1.2" strokeDasharray="1 2" opacity=".6" />
        <circle cx="32" cy="32" r="19" pathLength="80" strokeWidth="3.5" strokeDasharray="7 3" />
        <circle cx="32" cy="32" r="12" strokeWidth="1.5" />
      </g>
      <circle cx="32" cy="32" r="6" fill="var(--av-core)" />
    </>
  )
}

type AvatarProps = { persona: Persona; size: number; isSpinning?: boolean }

export function Avatar({ persona, size, isSpinning }: AvatarProps) {
  return (
    <span className="avatar inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className={`block size-full ${isSpinning ? 'spin' : ''}`}>
        {persona === 'jarvis' ? <Jarvis /> : <Mom />}
      </svg>
    </span>
  )
}
