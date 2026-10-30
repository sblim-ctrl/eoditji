// 개발계획 9절 단위 테스트 4·5번
import assert from 'node:assert/strict'
import { exactMatch, keywordMatch, questionKeys } from './match.ts'

const items = [
  { id: 'cap', name: '이어캡', aliases: ['이어팁', '에어팟 고무'] },
  { id: 'scissors', name: '가위', aliases: ['자르는 거'] },
  { id: 'pouch', name: '검정 파우치', aliases: ['검은 주머니'] },
  { id: 'aa', name: 'AA 건전지', aliases: ['건전지'] },
  { id: 'aaa', name: 'AAA 건전지', aliases: ['건전지'] },
]

Deno.test('4. 질문 정규화: 문장부호·끝말·조사를 떼고 띄어쓰기를 무시함', () => {
  assert.ok(questionKeys('이어팁 어디 있어?').has('이어팁'))
  assert.ok(questionKeys('이어팁어디있어').has('이어팁'))
  assert.ok(questionKeys('가위는 어딨어').has('가위'))
  assert.ok(questionKeys('검정 파우치는 어디 뒀더라').has('검정파우치'))
  assert.ok(questionKeys('에어팟 고무 어디야').has('에어팟고무'))
})

Deno.test('5. 이름이나 다른 이름과 정확히 하나만 일치하면 바로 답함', () => {
  assert.deepEqual(exactMatch('이어팁 어디 있어?', items), { hitId: 'cap', ids: ['cap'] })
  assert.equal(exactMatch('검은 주머니 어딨어', items).hitId, 'pouch')
  assert.equal(exactMatch('AA 건전지 어디 있어', items).hitId, 'aa')
})

Deno.test('5. 여러 개가 걸리면 답하지 않고 후보로 넘김', () => {
  assert.deepEqual(exactMatch('건전지 어디 있어', items), { hitId: null, ids: ['aa', 'aaa'] })
})

Deno.test('5. 부분만 겹치면 0단계에서 답하지 않음', () => {
  assert.deepEqual(exactMatch('이어 어디 있어', items), { hitId: null, ids: [] })
  assert.deepEqual(exactMatch('자르는 거 말고 테이프', items), { hitId: null, ids: [] })
})

Deno.test('v0 키워드 검색: 글자가 겹치는 첫 물건 (동의어는 못 찾음)', () => {
  assert.equal(keywordMatch('파우치 어디 있어', items), 'pouch')
  assert.equal(keywordMatch('테이프 어디 있어', items), null)
})
