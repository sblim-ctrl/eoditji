-- 0001_init: 그룹 단위 데이터 모델, RLS, Storage (개발계획 6절)
-- 오늘 안 하는 것: save_place RPC(D2), group_invites·join_group(P1, TBD #9)

create extension if not exists pg_trgm with schema extensions;

-- ───────────── 테이블 ─────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  persona text not null default 'mom' check (persona in ('mom', 'jarvis')),
  allow_training boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  inventory_version int not null default 0  -- places·items가 바뀌면 트리거로 +1
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  -- ''이면 '공간 없음' (null이면 unique가 안 걸려서). 앞뒤 공백은 저장 전에 지움
  area text not null default '' check (area = btrim(area)),
  name text not null check (name <> '' and name = btrim(name)),
  photo_path text,
  created_by uuid default auth.uid() references auth.users on delete set null,  -- 공유 스위치를 바꿀 수 있는 사람
  visibility text not null default 'group' check (visibility in ('private', 'group')),
  captured_by uuid default auth.uid() references auth.users on delete set null,
  captured_at timestamptz not null default now(),
  unique (group_id, area, name),
  unique (id, group_id)  -- items의 group_id가 칸의 그룹과 같도록 복합 FK 대상
);

-- array_to_string은 stable이라 generated column에 바로 못 씀
create function public.item_search_text(name text, aliases text[])
returns text language sql immutable set search_path = ''
as $$ select name || ' ' || array_to_string(aliases, ' ') $$;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null,
  group_id uuid not null,
  name text not null,
  level text not null check (level in ('sure', 'guess', 'hidden', 'told')),
  inside text,
  source text not null check (source in ('ai', 'user')),
  box int[] check (box is null or array_length(box, 1) = 4),
  box_source text check (box_source in ('ai', 'user')),
  aliases text[] not null default '{}',
  search_text text generated always as (public.item_search_text(name, aliases)) stored,
  created_at timestamptz not null default now(),
  foreign key (place_id, group_id) references public.places (id, group_id) on delete cascade
);
create index items_place_idx on public.items (place_id, group_id);
create index items_search_text_trgm on public.items using gin (search_text extensions.gin_trgm_ops);

-- 라벨은 지우지 않음. 칸이 지워져도 남도록 place_id에 FK를 걸지 않음
create table public.item_labels (
  id bigint generated always as identity primary key,
  place_id uuid not null,
  group_id uuid not null,
  item_id uuid,
  photo_path text,
  action text not null check (action in ('confirm', 'move', 'rename', 'reject', 'add', 'draw')),
  ai_name text, ai_box int[], user_name text, user_box int[],
  model text, prompt_version text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),
  group_id uuid,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index events_user_day_idx on public.events (user_id, name, created_at);

-- ───────────── 판별 함수 (RLS 재귀를 피하려고 security definer) ─────────────

create function public.is_member(gid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid and m.user_id = (select auth.uid())
  )
$$;

-- 같은 그룹 멤버이고, 칸이 공유 중이거나 내가 기록한 칸
create function public.can_see_place(pid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.places p
    where p.id = pid
      and public.is_member(p.group_id)
      and (p.visibility = 'group' or p.created_by = (select auth.uid()))
  )
$$;

-- Storage 경로 '{group_id}/{place_id}/{ts}.jpg'의 pos번째 폴더. uuid가 아니면 null (형 변환 오류 방지)
create function public.path_uuid(path text, pos int)
returns uuid language sql immutable set search_path = ''
as $$
  select case
    when split_part(path, '/', pos) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(path, '/', pos)::uuid
  end
$$;

-- ───────────── 트리거 ─────────────

-- 가입하면 profiles 행 + 그룹 "내 집" + owner 멤버십
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  gid uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  insert into public.groups (name, created_by) values ('내 집', new.id) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, new.id, 'owner');
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- places·items가 바뀌면 inventory_version +1 (P1 결과 캐시용)
create function public.bump_inventory_version()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.groups
  set inventory_version = inventory_version + 1
  where id = coalesce(new.group_id, old.group_id);
  return null;
end
$$;

create trigger places_bump_version
  after insert or update or delete on public.places
  for each row execute function public.bump_inventory_version();
create trigger items_bump_version
  after insert or update or delete on public.items
  for each row execute function public.bump_inventory_version();

-- 공유 스위치는 기록한 사람만. group_id·created_by를 바꿔 남의 칸을 숨기거나 옮기지 못하게 함
create function public.guard_place_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.group_id <> old.group_id or new.created_by is distinct from old.created_by then
    raise exception 'group_id and created_by cannot be changed';
  end if;
  if new.visibility <> old.visibility and old.created_by is distinct from (select auth.uid()) then
    raise exception 'only the creator can change visibility';
  end if;
  return new;
end
$$;

create trigger places_guard_update
  before update on public.places
  for each row execute function public.guard_place_update();

-- ───────────── RLS ─────────────

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.places enable row level security;
alter table public.items enable row level security;
alter table public.item_labels enable row level security;
alter table public.events enable row level security;

create policy "profiles: 본인만 읽기" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: 본인만 수정" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: 멤버만 읽기" on public.groups
  for select to authenticated using (public.is_member(id));
create policy "groups: owner만 수정" on public.groups
  for update to authenticated
  using (exists (
    select 1 from public.group_members m
    where m.group_id = groups.id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));
create policy "groups: owner만 삭제" on public.groups
  for delete to authenticated
  using (exists (
    select 1 from public.group_members m
    where m.group_id = groups.id and m.user_id = (select auth.uid()) and m.role = 'owner'
  ));

-- 직접 추가·수정·삭제 정책 없음. 참여는 P1의 join_group(code)로만
create policy "group_members: 같은 그룹 멤버만 읽기" on public.group_members
  for select to authenticated using (public.is_member(group_id));

-- 행의 값으로 판정 (can_see_place는 바뀌기 전 행을 보므로 with check에 쓰지 않음)
create policy "places: 볼 수 있는 칸만 읽기" on public.places
  for select to authenticated
  using (public.is_member(group_id) and (visibility = 'group' or created_by = (select auth.uid())));
create policy "places: 내 그룹에 내 이름으로만 추가" on public.places
  for insert to authenticated
  with check (public.is_member(group_id) and created_by = (select auth.uid()));
create policy "places: 볼 수 있는 칸만 수정" on public.places
  for update to authenticated
  using (public.is_member(group_id) and (visibility = 'group' or created_by = (select auth.uid())))
  with check (public.is_member(group_id) and (visibility = 'group' or created_by = (select auth.uid())));
create policy "places: 볼 수 있는 칸만 삭제" on public.places
  for delete to authenticated
  using (public.is_member(group_id) and (visibility = 'group' or created_by = (select auth.uid())));

create policy "items: 볼 수 있는 칸의 물건만" on public.items
  for all to authenticated
  using (public.can_see_place(place_id))
  with check (public.can_see_place(place_id));

-- 읽기 정책 없음 (추가만)
create policy "item_labels: 볼 수 있는 칸에 내 이름으로만 추가" on public.item_labels
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_see_place(place_id)
    and exists (select 1 from public.places p where p.id = place_id and p.group_id = item_labels.group_id)
  );

create policy "events: 내 이름으로만 추가" on public.events
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (group_id is null or public.is_member(group_id)));

-- ───────────── 권한 (새 테이블 자동 노출을 껐으므로 직접 부여. anon에는 주지 않음) ─────────────

grant select, update (display_name, persona, allow_training) on public.profiles to authenticated;
grant select, update (name), delete on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant select, insert, update, delete on public.places to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant insert on public.item_labels to authenticated;
grant insert on public.events to authenticated;

-- 함수는 기본으로 PUBLIC 실행 권한이 있어서 거둬들임. RLS 판정 함수는 로그인 사용자만
revoke execute on function
  public.is_member(uuid), public.can_see_place(uuid), public.path_uuid(text, int),
  public.handle_new_user(), public.bump_inventory_version(), public.guard_place_update()
  from public, anon;
grant execute on function public.is_member(uuid), public.can_see_place(uuid), public.path_uuid(text, int)
  to authenticated;

-- ───────────── Storage: 비공개 버킷 photos ─────────────

insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

-- 올리기: 첫 폴더가 내 그룹이고 둘째 폴더가 uuid일 때만 (칸은 저장 직후 생기므로 아직 없을 수 있음)
create policy "photos: 내 그룹 폴더에만 올리기" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and public.is_member(public.path_uuid(name, 1))
    and public.path_uuid(name, 2) is not null
  );

create policy "photos: 볼 수 있는 칸의 사진만 읽기" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.can_see_place(public.path_uuid(name, 2)));
