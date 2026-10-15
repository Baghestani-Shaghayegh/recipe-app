-- Recipe Box: Discover feed of short recipe videos.
-- Run once in the Supabase SQL editor, after 20261007000000_recipe_box.sql.
--
-- Everyone (even signed out) can watch the feed. Signed-in people with a username can post,
-- like, save, report and block. Every post must carry a full recipe (ingredients and steps).
-- Posts can't be edited, only deleted. A post reported by 3 people is hidden automatically;
-- to remove one yourself, set `hidden = true` on it in the Table Editor.

-- Public name shown on posts.
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The recipe as the app stores it (title, ingredients, steps, category, times, ...).
  recipe jsonb not null,
  -- Files in the post-media bucket, inside the author's own folder: "<author id>/<file>".
  video_path text not null,
  poster_path text,
  like_count integer not null default 0,
  save_count integer not null default 0,
  report_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  -- coalesce: a missing field makes these comparisons null, which a check would let through.
  constraint posts_full_recipe check (coalesce(
    jsonb_typeof(recipe -> 'title') = 'string'
    and char_length(btrim(recipe ->> 'title')) between 1 and 120
    and jsonb_typeof(recipe -> 'ingredients') = 'array'
    and jsonb_array_length(recipe -> 'ingredients') between 1 and 100
    and jsonb_typeof(recipe -> 'steps') = 'array'
    and jsonb_array_length(recipe -> 'steps') between 1 and 60
    and pg_column_size(recipe) < 100000, false)),
  constraint posts_media_in_own_folder check (
    split_part(video_path, '/', 1) = author_id::text
    and (poster_path is null or split_part(poster_path, '/', 1) = author_id::text)
  )
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_created_idx on public.post_likes (created_at);

create table public.post_saves (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_saves_created_idx on public.post_saves (created_at);

create table public.post_reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_reports enable row level security;
alter table public.blocks enable row level security;

-- Profiles: anyone can see usernames; you pick and change your own.
create policy "profiles are public" on public.profiles
  for select to anon, authenticated using (true);
create policy "create your own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "rename your own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Posts: visible unless hidden, by someone you blocked, or one you reported. Your own posts are
-- always visible to you.
create policy "watch the feed" on public.posts
  for select to anon, authenticated using (
    author_id = (select auth.uid())
    or (
      not hidden
      and not exists (
        select 1 from public.blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = posts.author_id
      )
      and not exists (
        select 1 from public.post_reports r
        where r.reporter_id = (select auth.uid()) and r.post_id = posts.id
      )
    )
  );
-- New posts start with zero counts and visible; the counts are only changed by the triggers below.
create policy "post as yourself" on public.posts
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and like_count = 0 and save_count = 0 and report_count = 0 and not hidden
  );
create policy "delete your own posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

-- Likes, saves, reports and blocks: you only see and change your own.
create policy "your likes" on public.post_likes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "like" on public.post_likes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unlike" on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "your saves" on public.post_saves
  for select to authenticated using (user_id = (select auth.uid()));
create policy "save" on public.post_saves
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "unsave" on public.post_saves
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "your reports" on public.post_reports
  for select to authenticated using (reporter_id = (select auth.uid()));
create policy "report" on public.post_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

create policy "your blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "block" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Counters. SECURITY DEFINER because people can't update posts directly.
create function public.count_post_reaction()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  pid uuid := case when tg_op = 'INSERT' then new.post_id else old.post_id end;
begin
  if tg_table_name = 'post_likes' then
    update public.posts set like_count = greatest(like_count + delta, 0) where id = pid;
  elsif tg_table_name = 'post_saves' then
    update public.posts set save_count = greatest(save_count + delta, 0) where id = pid;
  end if;
  return null;
end $$;

create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.count_post_reaction();
create trigger post_saves_count after insert or delete on public.post_saves
  for each row execute function public.count_post_reaction();

-- Hides a post once 3 different people have reported it.
create function public.count_post_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.posts
    set report_count = report_count + 1,
        hidden = hidden or report_count + 1 >= 3
    where id = new.post_id;
  return null;
end $$;

create trigger post_reports_count after insert on public.post_reports
  for each row execute function public.count_post_report();

-- Ranking for the Top view: post ids with their number of likes or saves, over the last
-- 7 days ('week') or ever ('all'). Respects hidden posts and the caller's blocks and reports.
create function public.top_posts(p_metric text, p_period text, p_limit integer default 30)
returns table (post_id uuid, score bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  since timestamptz := case when p_period = 'week' then now() - interval '7 days' end;
  n integer := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if p_metric not in ('likes', 'saves') or p_period not in ('week', 'all') then
    raise exception 'Unknown ranking';
  end if;
  if since is null then
    return query
      select p.id, (case when p_metric = 'likes' then p.like_count else p.save_count end)::bigint as s
      from public.posts p
      where not p.hidden
        and not exists (select 1 from public.blocks b
                        where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id)
        and not exists (select 1 from public.post_reports r
                        where r.reporter_id = (select auth.uid()) and r.post_id = p.id)
        and (case when p_metric = 'likes' then p.like_count else p.save_count end) > 0
      order by s desc, p.created_at desc
      limit n;
  else
    return query
      select p.id, count(*)::bigint as s
      from (
        select r.post_id from public.post_likes r where p_metric = 'likes' and r.created_at >= since
        union all
        select r.post_id from public.post_saves r where p_metric = 'saves' and r.created_at >= since
      ) x
      join public.posts p on p.id = x.post_id
      where not p.hidden
        and not exists (select 1 from public.blocks b
                        where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id)
        and not exists (select 1 from public.post_reports r
                        where r.reporter_id = (select auth.uid()) and r.post_id = p.id)
      group by p.id, p.created_at
      order by s desc, p.created_at desc
      limit n;
  end if;
end $$;

revoke all on function public.count_post_reaction() from public, anon, authenticated;
revoke all on function public.count_post_report() from public, anon, authenticated;
revoke all on function public.top_posts(text, text, integer) from public;
grant execute on function public.top_posts(text, text, integer) to anon, authenticated;

-- Video and cover files. Public to read (the feed streams them); each person uploads only into
-- their own folder. 60 MB per file is plenty for a 60-second phone video.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', true, 62914560,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "upload post media to your own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Deleting a file also needs permission to see it (everyone else reads through the public URL).
create policy "see your own post media" on storage.objects
  for select to authenticated using (
    bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "delete your own post media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
