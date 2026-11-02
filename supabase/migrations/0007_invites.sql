-- 0007_invites: P1 그룹 (개발계획 6절). 그룹 만들기, 초대 코드로 참여, 멤버 이름, 그룹별 검색 후보.
-- group_members에는 직접 추가 정책이 없다. 참여는 join_group(code)로만 한다.

create table public.group_invites (
  code text primary key,
  group_id uuid not null references public.groups on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);
-- 정책도 권한도 주지 않는다. 코드를 목록으로 훔쳐볼 수 없게 아래 RPC로만 다룬다
alter table public.group_invites enable row level security;

create function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  clean text := btrim(coalesce(group_name, ''));
  gid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if clean = '' or length(clean) > 30 then raise exception 'bad group name'; end if;
  insert into public.groups (name, created_by) values (clean, (select auth.uid())) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, (select auth.uid()), 'owner');
  return gid;
end
$$;

-- 멤버면 누구나 초대할 수 있다. 코드는 16자리 무작위(64비트)이고 7일 뒤 만료
create function public.create_invite(gid uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c text := left(replace(gen_random_uuid()::text, '-', ''), 16);
begin
  if not public.is_member(gid) then raise exception 'not a member'; end if;
  insert into public.group_invites (code, group_id, created_by) values (c, gid, (select auth.uid()));
  return c;
end
$$;

create function public.join_group(invite_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  select i.group_id into gid from public.group_invites i where i.code = invite_code and i.expires_at > now();
  if gid is null then raise exception 'invite_invalid'; end if;
  insert into public.group_members (group_id, user_id, role) values (gid, (select auth.uid()), 'member')
  on conflict do nothing;
  return gid;
end
$$;

-- 칸 카드의 "누가 찍었는지". profiles는 본인만 읽을 수 있어서 같은 그룹 멤버의 이름만 내준다
create function public.group_people(gid uuid)
returns table (user_id uuid, name text) language sql stable security definer set search_path = ''
as $$
  select m.user_id, coalesce(nullif(btrim(p.display_name), ''), '멤버')
  from public.group_members m
  left join public.profiles p on p.id = m.user_id
  where m.group_id = gid and public.is_member(gid)
  order by m.joined_at
$$;

-- 검색 1단계를 지금 보고 있는 그룹으로 좁힌다. only_group이 null이면 볼 수 있는 모든 칸 (예전 동작)
drop function public.search_candidates(text, uuid[], int);
create function public.search_candidates(q text, include_ids uuid[] default '{}', max_count int default 20, only_group uuid default null)
returns table (id uuid, name text, aliases text[], area text, place text, inside text)
language sql stable security invoker set search_path = ''
as $$
  select i.id, i.name, i.aliases, p.area, p.name, i.inside
  from public.items i
  join public.places p on p.id = i.place_id
  where only_group is null or p.group_id = only_group
  order by i.id = any (include_ids) desc,
           extensions.word_similarity(q, i.search_text) desc,
           p.captured_at desc
  limit least(greatest(max_count, 1), 50)
$$;

revoke execute on function
  public.create_group(text), public.create_invite(uuid), public.join_group(text), public.group_people(uuid),
  public.search_candidates(text, uuid[], int, uuid)
  from public, anon;
grant execute on function
  public.create_group(text), public.create_invite(uuid), public.join_group(text), public.group_people(uuid),
  public.search_candidates(text, uuid[], int, uuid)
  to authenticated;
