-- D4-1: 사용자별 일일 호출 한도 (PRD 04 가드레일: 인식 20회, 검색 100회).
-- events에는 읽기 정책이 없으므로, 오늘(한국 시간) 내가 부른 AI 호출 수만 세어 주는 함수를 둔다.
-- AI 호출 이벤트는 함수가 남기고 props.model이 있다. 0단계처럼 브라우저가 남기는 이벤트에는 model이 없어 세지 않는다.
create function public.ai_calls_today(event_name text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.events
  where user_id = (select auth.uid())
    and name = event_name
    and props->>'model' is not null
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
$$;

revoke execute on function public.ai_calls_today(text) from public, anon;
grant execute on function public.ai_calls_today(text) to authenticated;
