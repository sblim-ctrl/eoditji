// 개발계획 9절 단위 테스트 1·2·6번
import assert from 'node:assert/strict'
import { type Box, boxAt, cleanRecognition, cleanSearch, validateBox } from './validate.ts'

Deno.test('2. 범위를 벗어난 박스는 0~1000으로 자름', () => {
  assert.deepEqual(validateBox([-20, 100, 1200, 900]), [0, 100, 1000, 900])
})

Deno.test('2. 뒤집힌 박스는 축을 바꿈', () => {
  assert.deepEqual(validateBox([800, 900, 100, 200]), [100, 200, 800, 900])
})

Deno.test('2. 넓이가 0이거나 형식이 틀린 박스는 null', () => {
  assert.equal(validateBox([100, 100, 100, 500]), null)
  assert.equal(validateBox([1, 2, 3]), null)
  assert.equal(validateBox(['a', 0, 10, 10]), null)
  assert.equal(validateBox(null), null)
})

Deno.test('인식 결과: 이름 없는 물건은 빼고, 질문은 3개까지', () => {
  const r = cleanRecognition({
    sure: [{ name: ' 가위 ', box: [10, 10, 50, 50], aliases: ['자르는 거', '', 3] }, { name: '', box: null, aliases: [] }],
    guess: 'oops',
    hidden: [{ name: '검정 파우치', box: null, aliases: [] }],
    questions: [1, 2, 3, 4].map((i) => ({ target: '검정 파우치', ask: `질문 ${i}` })),
    try: ['자르는 거 어디 있어?'],
  })
  assert.deepEqual(r.sure, [{ name: '가위', box: [10, 10, 50, 50], aliases: ['자르는 거'] }])
  assert.deepEqual(r.guess, [])
  assert.equal(r.questions.length, 3)
})

Deno.test('1. 기록에 없는 id만 있으면 found=false', () => {
  const r = cleanSearch({ intent: 'find', itemIds: ['ghost'], confidence: 'high' }, ['a', 'b'])
  assert.equal(r.found, false)
  assert.deepEqual(r.itemIds, [])
})

Deno.test('6. 후보 밖의 id는 거절하고 후보 안의 id만 남김', () => {
  const r = cleanSearch({ intent: 'find', itemIds: ['a', 'ghost', 'a'], confidence: 'mid' }, ['a', 'b'])
  assert.deepEqual(r, { intent: 'find', itemIds: ['a'], confidence: 'mid', found: true })
})

Deno.test('찾는 말이 아니면 id가 있어도 found=false, 모르는 confidence는 low', () => {
  assert.equal(cleanSearch({ intent: 'other', itemIds: ['a'], confidence: 'high' }, ['a']).found, false)
  assert.equal(cleanSearch({ intent: 'find', itemIds: ['a'], confidence: '??' }, ['a']).confidence, 'low')
})

Deno.test('사진을 누른 자리: 그 자리를 덮는 박스 중 가장 작은 것, 없으면 -1', () => {
  const boxes: (Box | null)[] = [[0, 0, 1000, 1000], null, [100, 100, 300, 300], [600, 600, 700, 700]]
  assert.equal(boxAt(boxes, 200, 200), 2)
  assert.equal(boxAt(boxes, 500, 500), 0)
  assert.equal(boxAt([[100, 100, 300, 300], null], 500, 500), -1)
})
