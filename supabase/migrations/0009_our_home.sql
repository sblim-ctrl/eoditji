-- 0009_our_home: 기본 그룹 이름 "내 집" → "우리 집" (같이 쓰는 그룹이 되면 "내 집"이 어색함)

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  insert into public.groups (name, created_by) values ('우리 집', new.id) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, new.id, 'owner');
  return new;
end
$$;

-- 이미 만들어진 기본 그룹도 바꾼다 (그룹 이름을 바꾸는 화면이 없어서 '내 집'은 모두 트리거가 만든 것)
update public.groups set name = '우리 집' where name = '내 집';
