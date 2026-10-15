-- Tests for the Discover feed rules. Run on a scratch database after stub_supabase.sql and the
-- migrations (see supabase/tests/run.sh). Any failed check stops the script with an error.
\set ON_ERROR_STOP on

-- Runs a statement that must be refused.
create function pg_temp.refused(stmt text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'expected this to be refused: %', stmt;
exception when others then
  if sqlerrm like 'expected this to be refused%' then raise; end if;
end $$;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'check failed: %', what; end if;
end $$;

grant execute on function pg_temp.refused(text), pg_temp.check(boolean, text) to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'cy@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dee@example.com');

-- ---------- Ana: profile, upload and post ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

select pg_temp.refused($$insert into public.profiles (username) values ('Bad Name!')$$);
insert into public.profiles (username) values ('ana_cooks');
select pg_temp.refused($$insert into public.profiles (id, username)
  values ('00000000-0000-0000-0000-00000000000b', 'not_ana')$$);

insert into storage.objects (bucket_id, name)
  values ('post-media', '00000000-0000-0000-0000-00000000000a/v1.mp4');
select pg_temp.refused($$insert into storage.objects (bucket_id, name)
  values ('post-media', '00000000-0000-0000-0000-00000000000b/sneaky.mp4')$$);

-- A full recipe is required.
select pg_temp.refused($$insert into public.posts (recipe, video_path) values
  ('{"title":"Toast","ingredients":[],"steps":["Toast it"]}',
   '00000000-0000-0000-0000-00000000000a/v1.mp4')$$);
select pg_temp.refused($$insert into public.posts (recipe, video_path) values
  ('{"title":"Toast","ingredients":[{"text":"bread"}]}',
   '00000000-0000-0000-0000-00000000000a/v1.mp4')$$);
select pg_temp.refused($$insert into public.posts (recipe, video_path) values
  ('{"title":"  ","ingredients":[{"text":"bread"}],"steps":["Toast it"]}',
   '00000000-0000-0000-0000-00000000000a/v1.mp4')$$);
-- Media must be in your own folder; counts can't be faked.
select pg_temp.refused($$insert into public.posts (recipe, video_path) values
  ('{"title":"Toast","ingredients":[{"text":"bread"}],"steps":["Toast it"]}',
   '00000000-0000-0000-0000-00000000000b/v.mp4')$$);
select pg_temp.refused($$insert into public.posts (recipe, video_path, like_count) values
  ('{"title":"Toast","ingredients":[{"text":"bread"}],"steps":["Toast it"]}',
   '00000000-0000-0000-0000-00000000000a/v1.mp4', 500)$$);
-- Posting as someone else.
select pg_temp.refused($$insert into public.posts (author_id, recipe, video_path) values
  ('00000000-0000-0000-0000-00000000000b',
   '{"title":"Toast","ingredients":[{"text":"bread"}],"steps":["Toast it"]}',
   '00000000-0000-0000-0000-00000000000b/v1.mp4')$$);

insert into public.posts (id, recipe, video_path, poster_path) values
  ('10000000-0000-0000-0000-000000000001',
   '{"title":"Garlic noodles","ingredients":[{"text":"200 g spaghetti"}],"steps":["Cook"]}',
   '00000000-0000-0000-0000-00000000000a/v1.mp4', '00000000-0000-0000-0000-00000000000a/v1.jpg'),
  ('10000000-0000-0000-0000-000000000002',
   '{"title":"Lentil soup","ingredients":[{"text":"1 cup lentils"}],"steps":["Simmer"]}',
   '00000000-0000-0000-0000-00000000000a/v2.mp4', null);

-- Posts can't be edited (no update policy), so counts can't be changed by hand.
update public.posts set like_count = 999;
select pg_temp.check((select max(like_count) from public.posts) = 0, 'counts not editable');

-- ---------- Ben: likes and saves ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.profiles (username) values ('ben');
select pg_temp.refused($$insert into public.profiles (username) values ('ana_cooks')$$);
insert into public.post_likes (post_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.post_saves (post_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.post_saves (post_id) values ('10000000-0000-0000-0000-000000000002');
select pg_temp.refused($$insert into public.post_likes (post_id) values ('10000000-0000-0000-0000-000000000001')$$);
select pg_temp.refused($$insert into public.post_likes (post_id, user_id)
  values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c')$$);
-- Row-level security makes this delete match nothing (no error), so check the post survived.
delete from public.posts where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.check(
  (select count(*) from public.posts where id = '10000000-0000-0000-0000-000000000001') = 1,
  'Ben cannot delete Ana''s post');

-- ---------- Cy: likes too ----------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.post_likes (post_id) values ('10000000-0000-0000-0000-000000000001');
insert into public.post_likes (post_id) values ('10000000-0000-0000-0000-000000000002');
-- Cy only sees their own likes, not Ben's.
select pg_temp.check((select count(*) from public.post_likes) = 2, 'only own likes visible');

select pg_temp.check(
  (select like_count from public.posts where id = '10000000-0000-0000-0000-000000000001') = 2,
  'like_count counted');
select pg_temp.check(
  (select save_count from public.posts where id = '10000000-0000-0000-0000-000000000001') = 1,
  'save_count counted');

-- Unlike lowers the count.
delete from public.post_likes where post_id = '10000000-0000-0000-0000-000000000002';
select pg_temp.check(
  (select like_count from public.posts where id = '10000000-0000-0000-0000-000000000002') = 0,
  'unlike counted');

-- ---------- Top ranking ----------
select pg_temp.check(
  (select array_agg(post_id order by score desc, post_id) from public.top_posts('saves', 'all'))
    = array['10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002']::uuid[],
  'top saves all time');
select pg_temp.check(
  (select score from public.top_posts('likes', 'all') where post_id = '10000000-0000-0000-0000-000000000001') = 2,
  'top likes score');
select pg_temp.check(
  (select count(*) from public.top_posts('likes', 'all')) = 1, 'posts with no likes left out');
select pg_temp.check(
  (select score from public.top_posts('likes', 'week') where post_id = '10000000-0000-0000-0000-000000000001') = 2,
  'top likes this week');
select pg_temp.refused($$select * from public.top_posts('views', 'all')$$);

-- ---------- Signed out: can watch, can't act ----------
reset request.jwt.claim.sub;
set role anon;
select pg_temp.check((select count(*) from public.posts) = 2, 'anon sees the feed');
select pg_temp.check((select count(*) from public.profiles) = 2, 'anon sees usernames');
select pg_temp.check((select count(*) from public.top_posts('saves', 'week')) = 2, 'anon sees top');
select pg_temp.refused($$insert into public.post_likes (post_id, user_id)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a')$$);
select pg_temp.refused($$insert into public.posts (author_id, recipe, video_path) values
  ('00000000-0000-0000-0000-00000000000a',
   '{"title":"x","ingredients":[{"text":"a"}],"steps":["b"]}',
   '00000000-0000-0000-0000-00000000000a/x.mp4')$$);

-- ---------- Blocking ----------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
insert into public.blocks (blocked_id) values ('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.posts) = 0, 'blocked author hidden from feed');
select pg_temp.check((select count(*) from public.top_posts('saves', 'all')) = 0, 'and from top');
delete from public.blocks;
select pg_temp.check((select count(*) from public.posts) = 2, 'unblock shows posts again');

-- ---------- Reports: gone for the reporter at once, for everyone after 3 people ----------
insert into public.post_reports (post_id, reason) values ('10000000-0000-0000-0000-000000000002', 'spam');
select pg_temp.check((select count(*) from public.posts) = 1, 'reporter no longer sees it');
select pg_temp.check(
  (select count(*) from public.top_posts('saves', 'all')
   where post_id = '10000000-0000-0000-0000-000000000002') = 0, 'reporter no longer sees it in top');
select pg_temp.refused($$insert into public.post_reports (post_id) values ('10000000-0000-0000-0000-000000000002')$$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
insert into public.post_reports (post_id) values ('10000000-0000-0000-0000-000000000002');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from public.posts) = 2, 'others still see it after 2 reports');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.post_reports (post_id) values ('10000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.posts) = 1, 'hidden after 3 reports');
select pg_temp.check(
  (select count(*) from public.top_posts('saves', 'all')
   where post_id = '10000000-0000-0000-0000-000000000002') = 0, 'hidden post out of top');
-- The author still sees their hidden post and can delete it.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.check((select count(*) from public.posts) = 2, 'author still sees own hidden post');
delete from public.posts where id = '10000000-0000-0000-0000-000000000002';
delete from storage.objects where name = '00000000-0000-0000-0000-00000000000a/v1.mp4';
select pg_temp.check((select count(*) from public.posts) = 1, 'author deleted own post');

reset role;
select pg_temp.check((select count(*) from storage.objects) = 0, 'author deleted own video file');
select pg_temp.check((select count(*) from public.post_saves) = 1, 'saves of a deleted post removed');
\echo 'All feed database checks passed'
