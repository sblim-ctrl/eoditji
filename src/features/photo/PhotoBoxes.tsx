// 사진 위 테두리 박스 (개발계획 4절). 고른 물건의 박스만 그리고, 사진을 누르면 그 자리의 물건을 고른다.
// onDraw를 주면 편집 모드 (D4-3): 고른 물건의 박스 안을 끌면 옮기고, 밖을 끌면 새로 그린다.
// 박스는 0~1000 정규화 좌표라 사진을 자르지 않고 원래 비율로 보여 줘야 위치가 맞는다.
// 세로 사진도 박스와 물건 칩이 한 화면에 들어오게 높이를 화면의 40%로 묶고, 박스를 그리는 틀은 줄어든 사진 크기에 맞춘다
import { type MouseEvent, type PointerEvent, useRef, useState } from 'react'
import { BOX_MAX, type Box, boxAt, validateBox } from '@shared/validate.ts'

const pct = (v: number) => `${(v / BOX_MAX) * 100}%`
const MIN_DRAG = 20 // 이보다 덜 움직이면 끌기가 아니라 누르기 (0~1000 기준)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Drag = { mode: 'move' | 'draw'; x: number; y: number; start: Box | null }
type PhotoBoxesProps = {
  src: string
  alt: string
  boxes: (Box | null)[]
  selected: number
  onSelect: (index: number) => void
  onDraw?: (box: Box) => void
}

export function PhotoBoxes({ src, alt, boxes, selected, onSelect, onDraw }: PhotoBoxesProps) {
  const drag = useRef<Drag | null>(null)
  const didDrag = useRef(false)
  const [live, setLiveState] = useState<Box | null>(null) // 끄는 중인 박스
  // pointermove 렌더는 묶여서 늦게 오므로 pointerup은 ref로 마지막 박스를 읽는다
  const liveRef = useRef<Box | null>(null)
  const setLive = (b: Box | null) => { liveRef.current = b; setLiveState(b) }
  const box = live ?? boxes[selected]
  const isEditing = !!onDraw && selected >= 0

  function at(e: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect()
    return [clamp(((e.clientX - r.left) / r.width) * BOX_MAX, 0, BOX_MAX), clamp(((e.clientY - r.top) / r.height) * BOX_MAX, 0, BOX_MAX)]
  }

  // 칩으로도 고를 수 있으니 사진 누르기는 손가락·마우스용 지름길로만 둔다
  function pick(e: MouseEvent<HTMLDivElement>) {
    if (didDrag.current) return void (didDrag.current = false)
    const [x, y] = at(e)
    onSelect(boxAt(boxes, x, y))
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!isEditing) return
    const [x, y] = at(e)
    const cur = boxes[selected]
    const isInside = !!cur && x >= cur[0] && x <= cur[2] && y >= cur[1] && y <= cur[3]
    drag.current = { mode: isInside ? 'move' : 'draw', x, y, start: cur }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const [x, y] = at(e)
    if (Math.abs(x - d.x) < MIN_DRAG && Math.abs(y - d.y) < MIN_DRAG && !liveRef.current) return
    if (d.mode === 'draw') return setLive([Math.min(d.x, x), Math.min(d.y, y), Math.max(d.x, x), Math.max(d.y, y)])
    const [x1, y1, x2, y2] = d.start!
    const dx = clamp(x - d.x, -x1, BOX_MAX - x2)
    const dy = clamp(y - d.y, -y1, BOX_MAX - y2)
    setLive([x1 + dx, y1 + dy, x2 + dx, y2 + dy])
  }

  function up() {
    const done = liveRef.current && validateBox(liveRef.current)
    drag.current = null
    setLive(null)
    if (!done) return
    didDrag.current = true // 끌기 끝의 click이 다른 물건을 고르지 않게
    onDraw!(done)
  }

  return (
    <div className="bg-muted">
      <div
        className={`relative mx-auto w-fit overflow-hidden ${isEditing ? 'touch-none select-none' : ''}`}
        onClick={pick}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <img src={src} alt={alt} draggable={false} className="block h-auto max-h-[40dvh] w-auto max-w-full" />
        {box && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-sm border-2 border-primary ${isEditing ? 'bg-primary/10' : ''}`}
            style={{ left: pct(box[0]), top: pct(box[1]), width: pct(box[2] - box[0]), height: pct(box[3] - box[1]) }}
          />
        )}
      </div>
    </div>
  )
}
