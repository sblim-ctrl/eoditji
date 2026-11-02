import { assertAlmostEquals, assertEquals } from 'jsr:@std/assert@1'
import { iou, percentile } from './common.ts'

Deno.test('iou: 같은 박스는 1, 안 겹치면 0', () => {
  assertEquals(iou([0, 0, 100, 100], [0, 0, 100, 100]), 1)
  assertEquals(iou([0, 0, 100, 100], [200, 200, 300, 300]), 0)
  assertEquals(iou([0, 0, 100, 100], [100, 0, 200, 100]), 0) // 변만 닿음
})

Deno.test('iou: 절반 겹치면 1/3, 안에 든 작은 박스는 넓이 비율', () => {
  assertAlmostEquals(iou([0, 0, 100, 100], [50, 0, 150, 100]), 1 / 3)
  assertEquals(iou([0, 0, 100, 100], [0, 0, 50, 50]), 0.25)
})

Deno.test('percentile: p95는 위에서 5% 안쪽 값', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1)
  assertEquals(percentile(xs, 95), 19)
  assertEquals(percentile(xs, 50), 10)
  assertEquals(percentile([], 95), 0)
})
