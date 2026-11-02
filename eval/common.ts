// 평가 스크립트 공통 (Deno). 함수와 같은 프롬프트·스키마·검증 코드를 _shared에서 그대로 가져다 쓴다.
// 원본 결과에는 집 물건 목록이 들어 있어 eval/results/(gitignore)에만 쓰고, 수치만 문서에 옮긴다.
import { callStructured, OpenAIError, type Usage } from '../supabase/functions/_shared/openai.ts'

export const RESULT_DIR = 'eval/results'
const MAX_TRIES = 4 // Flex는 자원이 모자라면 429를 준다

// 100만 토큰당 달러, 표준가 (PRD 05). 평가는 Flex라 실제 청구는 이 값의 절반
const PRICE: Record<string, { input: number; output: number }> = {
  'gpt-6.1-terra': { input: 1, output: 5 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
}

// 추론 토큰은 output_tokens에 이미 들어 있다
export function costOf(model: string, usage: Usage): number {
  const p = PRICE[model]
  if (!p) throw new Error(`가격을 모르는 모델: ${model}`)
  return (usage.input * p.input + usage.output * p.output) / 1e6
}

export async function callFlex(args: Omit<Parameters<typeof callStructured>[0], 'flex'>) {
  for (let i = 1; ; i++) {
    try {
      return await callStructured({ ...args, flex: true })
    } catch (e) {
      const isRetryable = e instanceof OpenAIError && (e.status === 429 || e.status >= 500)
      if (!isRetryable || i >= MAX_TRIES) throw e
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i))
    }
  }
}

// 따옴표로 감싼 칸(쉼표·줄바꿈 포함)까지 읽는 작은 CSV 파서. 첫 줄은 머리글
export function readCsv(path: string): Record<string, string>[] {
  const text = Deno.readTextFileSync(path).replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', isQuoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (isQuoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') isQuoted = false
      else cell += c
    } else if (c === '"') isQuoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.some((v) => v.trim()))
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

export const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}% (${n}/${d})` : '-')

export function arg(name: string): string | undefined {
  const i = Deno.args.indexOf(name)
  return i >= 0 ? Deno.args[i + 1] : undefined
}

export function saveJson(file: string, data: unknown): string {
  Deno.mkdirSync(RESULT_DIR, { recursive: true })
  const path = `${RESULT_DIR}/${file}`
  Deno.writeTextFileSync(path, JSON.stringify(data, null, 2))
  return path
}

// 두 박스(0~1000 좌표 [x1, y1, x2, y2])가 겹친 넓이 ÷ 합친 넓이. 박스 적중률(PRD 03)은 이 값이 0.5 이상인 비율
export function iou(a: number[], b: number[]): number {
  const w = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const h = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const inter = w * h
  const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
  return union > 0 ? inter / union : 0
}
