-- Recipe Box: account sync, households (shared data) and share-by-link.
-- Run once in the Supabase SQL editor of the project the app points at.

-- One row per synced piece of app data (recipes, pantry, meal plan, ...).
-- `scope` is the signed-in user's id for private data, or a household id when sharing.
create table public.user_data (
  scope uuid not null,
  key text not null check (char_length(key) <= 64),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (scope, key)
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- A recipe published with a link: anyone holding the id can read it (through get_shared_recipe).
create table public.shared_recipes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe jsonb not null,
  created_at timestamptz not null default now()
);
create index shared_recipes_owner_idx on public.shared_recipes (owner);

alter table public.user_data enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.shared_recipes enable row level security;

-- Helpers. SECURITY DEFINER so the policies below don't recurse into themselves.
create function public.my_households()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select household_id from public.household_members where user_id = (select auth.uid()) $$;

create function public.my_scopes()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select (select auth.uid()) union select household_id from public.household_members where user_id = (select auth.uid()) $$;

revoke all on function public.my_households() from public, anon;
revoke all on function public.my_scopes() from public, anon;
grant execute on function public.my_households() to authenticated;
grant execute on function public.my_scopes() to authenticated;

create policy "own and household data: read" on public.user_data
  for select to authenticated using (scope in (select public.my_scopes()));
create policy "own and household data: insert" on public.user_data
  for insert to authenticated with check (scope in (select public.my_scopes()));
create policy "own and household data: update" on public.user_data
  for update to authenticated
  using (scope in (select public.my_scopes())) with check (scope in (select public.my_scopes()));
create policy "own and household data: delete" on public.user_data
  for delete to authenticated using (scope in (select public.my_scopes()));

create policy "members see their household" on public.households
  for select to authenticated using (id in (select public.my_households()));
create policy "members see who is in their household" on public.household_members
  for select to authenticated using (household_id in (select public.my_households()));
create policy "members can leave" on public.household_members
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "owners manage their shared recipes" on public.shared_recipes
  for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- Households are created and joined only through these functions.
create function public.create_household()
returns table (id uuid, code text)
language plpgsql security definer set search_path = ''
as $$
declare h public.households;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  insert into public.households default values returning * into h;
  insert into public.household_members (household_id, user_id) values (h.id, (select auth.uid()));
  return query select h.id, h.code;
end $$;

create function public.join_household(p_code text)
returns table (id uuid, code text)
language plpgsql security definer set search_path = ''
as $$
declare h public.households;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  select * into h from public.households where public.households.code = upper(trim(p_code));
  if not found then raise exception 'No household with that code'; end if;
  insert into public.household_members (household_id, user_id)
    values (h.id, (select auth.uid())) on conflict do nothing;
  return query select h.id, h.code;
end $$;

-- Leaves every household; a household nobody belongs to any more (and its data) is removed.
create function public.leave_household()
returns void
language plpgsql security definer set search_path = ''
as $$
declare hid uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first'; end if;
  for hid in select household_id from public.household_members where user_id = (select auth.uid()) loop
    delete from public.household_members where household_id = hid and user_id = (select auth.uid());
    if not exists (select 1 from public.household_members where household_id = hid) then
      delete from public.user_data where scope = hid;
      delete from public.households where public.households.id = hid;
    end if;
  end loop;
end $$;

-- Anyone with the link can read one shared recipe, but cannot list or search them.
create function public.get_shared_recipe(p_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$ select recipe from public.shared_recipes where id = p_id $$;

revoke all on function public.create_household() from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.leave_household() from public, anon;
revoke all on function public.get_shared_recipe(uuid) from public;
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.get_shared_recipe(uuid) to anon, authenticated;
