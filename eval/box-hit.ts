// 박스 적중률 (PRD 03): 앱에서 그린 정답 박스(공간 '평가', 칸 이름 = 사진 파일 이름)와 1400px 인식 박스의 IoU ≥ 0.5 비율.
// 실행: npm run eval:box   (먼저 eval:recognize --size 1400. DB는 읽기 쿼리만)
import { iou, pct, RESULT_DIR, saveJson } from './common.ts'

const HIT_IOU = 0.5

const r = new Deno.Command('supabase', {
  args: ['db', 'query', '--linked', '-o', 'json',
    "select p.name as photo, i.name, i.box from public.places p join public.items i on i.place_id = p.id where p.area = '평가' and i.box is not null"],
  stdout: 'piped', stderr: 'piped',
}).outputSync()
if (!r.success) throw new Error(`정답 박스 쿼리 실패: ${new TextDecoder().decode(r.stderr)}`)
const gold: { photo: string; name: string; box: number[] }[] = JSON.parse(new TextDecoder().decode(r.stdout)).rows

type Recognized = { photo: string; truth: { name: string }[]; ai: { name: string; box: number[] | null }[]; pairs: { truth: number; ai: number }[] }
const recognized: Recognized[] = JSON.parse(Deno.readTextFileSync(`${RESULT_DIR}/recognize-1400.json`)).results

// 정답 박스는 정답표 이름으로 붙인다. 정답표에 없는 이름은 따로 세어 이름을 고치게 알린다
const unknown = gold.filter((g) => !recognized.find((x) => x.photo === g.photo)?.truth.some((t) => t.name === g.name))
const rows = gold.filter((g) => !unknown.includes(g)).map((g) => {
  const rec = recognized.find((x) => x.photo === g.photo)!
  const pair = rec.pairs.find((p) => rec.truth[p.truth].name === g.name)
  const aiBox = pair ? rec.ai[pair.ai].box : null
  return { ...g, aiName: pair ? rec.ai[pair.ai].name : null, aiBox, iou: aiBox ? +iou(aiBox, g.box).toFixed(3) : 0 }
})
const withAiBox = rows.filter((x) => x.aiBox)
const summary = {
  goldBoxes: gold.length,
  photos: new Set(gold.map((g) => g.photo)).size,
  hitRate: pct(rows.filter((x) => x.iou >= HIT_IOU).length, rows.length), // AI가 못 찾았거나 박스가 없으면 실패
  hitRateWhenBoxed: pct(withAiBox.filter((x) => x.iou >= HIT_IOU).length, withAiBox.length),
  meanIou: withAiBox.length ? +(withAiBox.reduce((n, x) => n + x.iou, 0) / withAiBox.length).toFixed(3) : 0,
  unknownNames: unknown.length,
}
console.table(summary)
if (unknown.length) console.log('정답표에 없는 이름:', unknown.map((u) => `${u.photo}/${u.name}`).join(', '))
console.log('저장:', saveJson('box-hit.json', { summary, rows, unknown }))
