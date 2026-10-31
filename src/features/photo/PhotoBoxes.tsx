// 사진 위 테두리 박스 (개발계획 4절). 보기 전용: 고른 물건의 박스만 그리고, 사진을 누르면 그 자리의 물건을 고른다.
// 박스는 0~1000 정규화 좌표라 사진을 자르지 않고 원래 비율로 보여 줘야 위치가 맞는다.
// 세로 사진도 박스와 물건 칩이 한 화면에 들어오게 높이를 화면의 40%로 묶고, 박스를 그리는 틀은 줄어든 사진 크기에 맞춘다
import type { MouseEvent } from 'react'
import { BOX_MAX, type Box, boxAt } from '@shared/validate.ts'

const pct = (v: number) => `${(v / BOX_MAX) * 100}%`

type PhotoBoxesProps = { src: string; alt: string; boxes: (Box | null)[]; selected: number; onSelect: (index: number) => void }

export function PhotoBoxes({ src, alt, boxes, selected, onSelect }: PhotoBoxesProps) {
  const box = boxes[selected]

  // 칩으로도 고를 수 있으니 사진 누르기는 손가락·마우스용 지름길로만 둔다
  function pick(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    onSelect(boxAt(boxes, ((e.clientX - r.left) / r.width) * BOX_MAX, ((e.clientY - r.top) / r.height) * BOX_MAX))
  }

  return (
    <div className="bg-muted">
      <div className="relative mx-auto w-fit overflow-hidden" onClick={pick}>
        <img src={src} alt={alt} className="block h-auto max-h-[40dvh] w-auto max-w-full" />
        {box && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-sm border-2 border-primary"
            style={{ left: pct(box[0]), top: pct(box[1]), width: pct(box[2] - box[0]), height: pct(box[3] - box[1]) }}
          />
        )}
      </div>
    </div>
  )
}
