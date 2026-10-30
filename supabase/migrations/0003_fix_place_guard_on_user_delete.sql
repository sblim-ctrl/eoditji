-- 계정을 지우면 places.created_by가 on delete set null로 바뀌는데, 0001의 보호 트리거가 이것까지 막아
-- 칸을 기록한 사용자는 계정 삭제가 실패했음 (rls-check에서 발견).
-- 로그인 사용자의 요청(auth.uid()가 있음)만 막고, 계정 삭제처럼 시스템이 바꾸는 경우는 허용한다.
create or replace function public.guard_place_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if new.group_id <> old.group_id or new.created_by is distinct from old.created_by then
    raise exception 'group_id and created_by cannot be changed';
  end if;
  if new.visibility <> old.visibility and old.created_by is distinct from (select auth.uid()) then
    raise exception 'only the creator can change visibility';
  end if;
  return new;
end
$$;
