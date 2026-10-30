-- 저장 (개발계획 2절): 칸과 물건을 한 트랜잭션에 넣는다.
-- 같은 공간·같은 이름의 칸이 있으면 그 칸을 새 기록으로 바꾼다. place_id는 그대로라서 사진 폴더도 그대로다.
-- 사진은 저장 뒤에 올린다 (D2 TBD #2): save_place → '{group_id}/{place_id}/{ts}.jpg' 올리기 → photo_path 갱신 → old_photo_path 지우기.
-- 그래서 바꿀 때 photo_path를 비워 둔다. 올리기가 실패하면 예전 사진과 새 물건이 어긋나는 대신 사진 없는 칸이 남는다.
-- security invoker라서 RLS가 그대로 걸린다. 남의 그룹이나 내가 못 보는 칸(남이 공유를 끈 같은 이름의 칸)이면 거절된다.
create function public.save_place(group_id uuid, area text, name text, items jsonb)
returns table (place_id uuid, old_photo_path text)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  clean_area text := btrim(coalesce(save_place.area, ''));
  clean_name text := btrim(coalesce(save_place.name, ''));
  pid uuid;
  old_path text;
begin
  select p.photo_path into old_path
  from public.places p
  where p.group_id = save_place.group_id and p.area = clean_area and p.name = clean_name;

  insert into public.places (group_id, area, name)
  values (save_place.group_id, clean_area, clean_name)
  on conflict on constraint places_group_id_area_name_key do update
    set photo_path = null, captured_by = (select auth.uid()), captured_at = now()
  returning id into pid;

  delete from public.items i where i.place_id = pid;

  -- 이름이 빈 물건은 건너뜀 (초안에서 지운 칩)
  insert into public.items (place_id, group_id, name, level, inside, source, box, box_source, aliases)
  select pid, save_place.group_id, btrim(i.name), i.level, nullif(btrim(i.inside), ''), i.source,
         i.box, i.box_source, coalesce(i.aliases, '{}')
  from jsonb_to_recordset(coalesce(save_place.items, '[]')) as i (
    name text, level text, inside text, source text, box int[], box_source text, aliases text[]
  )
  where btrim(coalesce(i.name, '')) <> '';

  return query select pid, old_path;
end
$$;

revoke execute on function public.save_place(uuid, text, text, jsonb) from public, anon;
grant execute on function public.save_place(uuid, text, text, jsonb) to authenticated;

-- 다시 찍을 때 예전 썸네일을 지우려고 추가. 읽기와 같은 조건
create policy "photos: 볼 수 있는 칸의 사진만 지우기" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.can_see_place(public.path_uuid(name, 2)));
