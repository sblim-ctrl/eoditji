-- 검색 1단계 (개발계획 5절): 질문과 search_text가 비슷한 물건 상위 n개.
-- 기준선(threshold)을 두지 않는다. 글자가 안 겹치는 다른 이름도 2단계 LLM이 고를 수 있게 후보를 채워 둔다.
-- security invoker라서 RLS가 그대로 걸린다. 남의 그룹, 남이 공유를 끈 칸의 물건은 후보에 나오지 않는다.
create function public.search_candidates(q text, include_ids uuid[] default '{}', max_count int default 20)
returns table (id uuid, name text, aliases text[], area text, place text, inside text)
language sql stable security invoker set search_path = ''
as $$
  select i.id, i.name, i.aliases, p.area, p.name, i.inside
  from public.items i
  join public.places p on p.id = i.place_id
  order by i.id = any (include_ids) desc,
           extensions.word_similarity(q, i.search_text) desc,
           p.captured_at desc
  limit least(greatest(max_count, 1), 50)
$$;

revoke execute on function public.search_candidates(text, uuid[], int) from public, anon;
grant execute on function public.search_candidates(text, uuid[], int) to authenticated;
