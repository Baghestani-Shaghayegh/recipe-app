-- Minimal stand-ins for what a Supabase project provides, so the migrations can be tested on a
-- plain local Postgres: the anon/authenticated roles, auth.users + auth.uid(), and storage.
create extension if not exists pgcrypto;
-- Roles belong to the whole server, so they may exist from an earlier run.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;
grant anon, authenticated to postgres;

create schema auth;
create table auth.users (id uuid primary key, email text);
-- Same as Supabase's: the signed-in user's id is the "sub" claim of the request's JWT.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text not null, owner uuid default auth.uid()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

-- Supabase grants table access on public to these roles by default; row-level security decides.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
