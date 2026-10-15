import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  compactCount,
  fileExtension,
  filterFeed,
  hasFilters,
  mediaPath,
  normalizeUsername,
  postProblems,
  recipeFromPost,
  toPostRecipe,
  usernameProblem,
  videoMimeType,
  type FeedPost,
} from '../src/lib/feed.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';
import { createSupabase, SupabaseError, type Session } from '../src/lib/supabase.ts';

function recipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    title: 'Toast',
    tags: [],
    ingredients: parseIngredientList('2 slices bread\n1 tbsp butter'),
    steps: ['Toast the bread.', '  '],
    createdAt: 1,
    updatedAt: 2,
    ...over,
  };
}

function post(id: string, r: Partial<Recipe>, at = 0): FeedPost {
  const full = recipe(r);
  return {
    id,
    authorId: 'a',
    username: 'ana',
    recipe: toPostRecipe(full),
    videoUrl: `https://cdn/${id}.mp4`,
    likeCount: 0,
    saveCount: 0,
    createdAt: at,
  };
}

test('a post needs a name, ingredients and steps', () => {
  assert.deepEqual(postProblems(recipe()), []);
  assert.deepEqual(postProblems(recipe({ title: ' ', ingredients: [], steps: [' '] })), [
    'a name',
    'ingredients',
    'steps',
  ]);
});

test('posted recipe leaves out private fields and blank steps', () => {
  const p = toPostRecipe(recipe({ photoUri: 'file://x.jpg', favorite: true, rating: 5 }));
  assert.deepEqual(Object.keys(p).sort(), [
    'category',
    'cookMinutes',
    'ingredients',
    'notes',
    'nutrition',
    'prepMinutes',
    'servings',
    'steps',
    'tags',
    'title',
  ]);
  assert.deepEqual(p.steps, ['Toast the bread.']);
  assert.equal((p as Record<string, unknown>).photoUri, undefined);
});

test('saving a post credits the author', () => {
  const saved = recipeFromPost({
    username: 'ana',
    recipe: { ...toPostRecipe(recipe()), notes: 'Crispy.' },
  });
  assert.equal(saved.notes, 'From @ana on Discover.\n\nCrispy.');
  assert.equal(saved.ingredients.length, 2);
  assert.equal(
    recipeFromPost({ username: 'ben', recipe: toPostRecipe(recipe()) }).notes,
    'From @ben on Discover.',
  );
});

test('usernames', () => {
  assert.equal(normalizeUsername('  @Ana Cooks '), 'ana_cooks');
  assert.equal(usernameProblem('ana_cooks'), undefined);
  assert.equal(usernameProblem('ab'), 'Use at least 3 characters.');
  assert.match(usernameProblem('ana!') ?? '', /letters, numbers/);
  assert.match(usernameProblem('a'.repeat(25)) ?? '', /at most 24/);
});

test('media paths stay in the user folder', () => {
  assert.match(mediaPath('user-1', 'MOV', 1000), /^user-1\/rs-[a-z0-9]{1,6}\.mov$/);
  assert.equal(fileExtension('file:///a/b/clip.MOV?x=1'), 'mov');
  assert.equal(fileExtension('blob:http://x/abc', 'video/quicktime'), 'mov');
  assert.equal(fileExtension('blob:http://x/abc'), 'mp4');
  assert.equal(videoMimeType('mov'), 'video/quicktime');
  assert.equal(videoMimeType('mp4'), 'video/mp4');
});

test('feed filters: category, time, can make', () => {
  const posts = [
    post('toast', { category: 'Breakfast', prepMinutes: 5 }),
    post('stew', {
      category: 'Dinner',
      cookMinutes: 120,
      ingredients: parseIngredientList('500 g lamb\n2 onions'),
    }),
  ];
  assert.deepEqual(
    filterFeed(posts, { category: 'Dinner' }, []).map((p) => p.id),
    ['stew'],
  );
  assert.deepEqual(
    filterFeed(posts, { maxMinutes: 30 }, []).map((p) => p.id),
    ['toast'],
  );
  assert.deepEqual(
    filterFeed(posts, { canMake: true }, ['bread', 'butter']).map((p) => p.id),
    ['toast'],
  );
  assert.deepEqual(
    filterFeed(posts, { canMake: true }, []).map((p) => p.id),
    [],
  );
  assert.equal(filterFeed(posts, {}, []).length, 2);
  assert.equal(hasFilters({}), false);
  assert.equal(hasFilters({ canMake: true }), true);
  assert.equal(hasFilters({ diets: [] }), false);
});

test('compact counts', () => {
  assert.equal(compactCount(999), '999');
  assert.equal(compactCount(1000), '1K');
  assert.equal(compactCount(1250), '1.3K');
  assert.equal(compactCount(2_000_000), '2M');
});

// ---------- API calls ----------

type Call = { url: string; init: RequestInit };
function fakeFetch(
  answer: (url: string, init: RequestInit) => { status?: number; body?: unknown },
) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status = 200, body } = answer(url, init);
    return new Response(body === undefined ? '' : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}
const config = { url: 'https://x.supabase.co', key: 'pk' };
const session: Session = {
  accessToken: 'tok',
  refreshToken: 'r',
  expiresAt: 0,
  userId: 'u1',
  email: '',
};
const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

test('media url and upload go to the post-media bucket', async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { Key: 'x' } }));
  const api = createSupabase(config, fn);
  assert.equal(
    api.mediaUrl('u1/a b.mp4'),
    'https://x.supabase.co/storage/v1/object/public/post-media/u1/a%20b.mp4',
  );
  const bytes = new Uint8Array([1, 2, 3]);
  await api.uploadMedia(session, 'u1/v.mp4', bytes, 'video/mp4');
  assert.equal(calls[0].url, 'https://x.supabase.co/storage/v1/object/post-media/u1/v.mp4');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(header(calls[0], 'Content-Type'), 'video/mp4');
  assert.equal(header(calls[0], 'Authorization'), 'Bearer tok');
  assert.equal(calls[0].init.body, bytes);
});

test('feed is readable signed out, pages by time, embeds usernames', async () => {
  const { fn, calls } = fakeFetch(() => ({ body: [] }));
  const api = createSupabase(config, fn);
  await api.listPosts(undefined, { before: Date.UTC(2026, 9, 15), limit: 10 });
  const url = calls[0].url;
  assert.match(url, /\/rest\/v1\/posts\?select=.*profiles\(username\)/);
  assert.match(url, /order=created_at\.desc/);
  assert.match(url, /limit=10/);
  assert.match(url, /created_at=lt\.2026-10-15T00%3A00%3A00\.000Z/);
  assert.equal(header(calls[0], 'Authorization'), 'Bearer pk');
});

test('top posts calls the ranking function', async () => {
  const { fn, calls } = fakeFetch(() => ({ body: [{ post_id: 'p1', score: '7' }] }));
  const top = await createSupabase(config, fn).topPosts(undefined, 'saves', 'week');
  assert.deepEqual(top, [{ postId: 'p1', score: 7 }]);
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/rpc/top_posts');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    p_metric: 'saves',
    p_period: 'week',
    p_limit: 30,
  });
});

test('like, unlike and an already-liked post', async () => {
  const { fn, calls } = fakeFetch((url, init) =>
    init.method === 'POST' && calls.length === 2
      ? { status: 409, body: { message: 'duplicate key' } }
      : {},
  );
  const api = createSupabase(config, fn);
  await api.react(session, 'like', 'p1', true);
  await api.react(session, 'save', 'p1', false);
  await api.react(session, 'like', 'p1', true); // 409 -> fine
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/post_likes');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { post_id: 'p1' });
  assert.equal(calls[1].init.method, 'DELETE');
  assert.equal(
    calls[1].url,
    'https://x.supabase.co/rest/v1/post_saves?post_id=eq.p1&user_id=eq.u1',
  );
});

test('taken username gets a friendly message', async () => {
  const { fn } = fakeFetch(() => ({ status: 409, body: { message: 'duplicate key value' } }));
  await assert.rejects(
    createSupabase(config, fn).setUsername(session, 'ana'),
    (e: unknown) => e instanceof SupabaseError && /taken/.test(e.message),
  );
});

test('deleting a post also deletes its files', async () => {
  const { fn, calls } = fakeFetch(() => ({}));
  await createSupabase(config, fn).deletePost(session, {
    id: 'p1',
    video_path: 'u1/v.mp4',
    poster_path: 'u1/v.jpg',
  });
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/posts?id=eq.p1');
  assert.equal(calls[1].url, 'https://x.supabase.co/storage/v1/object/post-media');
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { prefixes: ['u1/v.mp4', 'u1/v.jpg'] });
});

test('my reactions for a page of posts', async () => {
  const { fn, calls } = fakeFetch((url) => ({
    body: url.includes('post_likes') ? [{ post_id: 'a' }] : [{ post_id: 'b' }],
  }));
  const r = await createSupabase(config, fn).myReactions(session, ['a', 'b']);
  assert.deepEqual(r, { liked: ['a'], saved: ['b'] });
  assert.match(calls[0].url, /post_id=in\.\(a,b\)/);
});
