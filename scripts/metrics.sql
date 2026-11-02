-- 운영 지표 (PRD 03 KPI의 속도·비용 행). 읽기 쿼리만 쓴다
-- 실행: set -a; . ./.env; set +a; supabase db query --linked -o table -f scripts/metrics.sql
-- 행동 지표(기록 완료율, 1칸 기록 시간 등)는 사용자 테스트를 하지 않아 뺐다 (D4-7). 표본은 PO 본인의 사용이다
-- 가격(1M 토큰당 $): eval/common.ts의 PRICE와 같게. output 토큰에 reasoning이 들어 있다
with price(model, p_in, p_out) as (
  values ('gpt-6.1-terra', 1.0, 5.0), ('gpt-6-luna', 0.1, 0.5)
),
calls as (
  select e.name,
         e.props ->> 'resolved_by' as resolved_by,
         (e.props ->> 'latency_ms')::int as ms,
         ((e.props -> 'tokens' ->> 'input')::numeric * p.p_in + (e.props -> 'tokens' ->> 'output')::numeric * p.p_out) / 1e6 as usd
  from public.events e
  left join price p on p.model = e.props ->> 'model'
  where e.name in ('receive_draft', 'view_search_result')
),
draft as (select * from calls where name = 'receive_draft'),
llm as (select * from calls where name = 'view_search_result' and resolved_by = 'llm'),
searches as (select * from calls where name = 'view_search_result')
select '인식 p95 (초, 기준 ≤ 12)' as metric,
       round((percentile_cont(0.95) within group (order by ms) / 1000)::numeric, 1)::text as value, count(*) as n from draft
union all
select '인식 중앙값 (초)', round((percentile_cont(0.5) within group (order by ms) / 1000)::numeric, 1)::text, count(*) from draft
union all
select '칸 1개 기록 비용 평균 ($, 기준 ≤ 0.01)', round(avg(usd), 4)::text, count(*) from draft
union all
select '검색 LLM 단계 p95 (초, 기준 ≤ 3)', round((percentile_cont(0.95) within group (order by ms) / 1000)::numeric, 1)::text, count(*) from llm
union all
select '검색 1회 평균 비용 ($, LLM 안 쓴 검색 포함)', round(coalesce(avg(coalesce(usd, 0)), 0), 6)::text, count(*) from searches
union all
select 'LLM 없이 해결한 검색 비율 (0단계 match)',
       round(100.0 * count(*) filter (where resolved_by = 'match') / nullif(count(*) filter (where resolved_by in ('match', 'llm', 'fallback')), 0), 1)::text || '%',
       count(*) filter (where resolved_by in ('match', 'llm', 'fallback')) from searches;
