import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  configFromEnv,
  createSupabase,
  parseShareId,
  shareLink,
  SupabaseError,
} from '../src/lib/supabase.ts';

type Call = { url: string; init: RequestInit };

function fakeFetch(answer: (url: string) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const { status = 200, body } = answer(url);
    return new Response(body === undefined ? '' : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

const config = { url: 'https://x.supabase.co', key: 'pk' };

test('configFromEnv needs both values', () => {
  assert.deepEqual(
    configFromEnv({
      EXPO_PUBLIC_SUPABASE_URL: 'https://a.supabase.co/',
      EXPO_PUBLIC_SUPABASE_KEY: ' k ',
    }),
    {
      url: 'https://a.supabase.co',
      key: 'k',
    },
  );
  assert.equal(configFromEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://a.supabase.co' }), undefined);
  assert.equal(
    configFromEnv({ EXPO_PUBLIC_SUPABASE_URL: 'nope', EXPO_PUBLIC_SUPABASE_KEY: 'k' }),
    undefined,
  );
});

test('signIn returns a session and sends the key', async () => {
  const f = fakeFetch(() => ({
    body: {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 100,
      user: { id: 'u1', email: 'me@x.com' },
    },
  }));
  const s = await createSupabase(config, f.fn).signIn('me@x.com', 'pw', 1000);
  assert.deepEqual(s, {
    accessToken: 'a',
    refreshToken: 'r',
    expiresAt: 101_000,
    userId: 'u1',
    email: 'me@x.com',
  });
  assert.match(f.calls[0].url, /\/auth\/v1\/token\?grant_type=password$/);
  assert.equal((f.calls[0].init.headers as Record<string, string>).apikey, 'pk');
});

test('signUp without a session means the email must be confirmed', async () => {
  const f = fakeFetch(() => ({ body: { id: 'u1', email: 'me@x.com' } }));
  assert.equal(await createSupabase(config, f.fn).signUp('me@x.com', 'pw'), undefined);
});

test('errors carry the server message', async () => {
  const f = fakeFetch(() => ({
    status: 400,
    body: { error_description: 'Invalid login credentials' },
  }));
  await assert.rejects(createSupabase(config, f.fn).signIn('a', 'b'), (e: SupabaseError) => {
    return e.message === 'Invalid login credentials' && e.status === 400;
  });
  const down = (async () => {
    throw new Error('offline');
  }) as typeof fetch;
  await assert.rejects(
    createSupabase(config, down).signIn('a', 'b'),
    (e: SupabaseError) => e.status === 0,
  );
});

test('getData and putData use the scope and merge on conflict', async () => {
  const session = { accessToken: 'tok', refreshToken: 'r', expiresAt: 0, userId: 'u', email: '' };
  const f = fakeFetch((url) =>
    url.includes('select=')
      ? { body: [{ key: 'pantry.v1', value: ['a'], updated_at: '2026-10-07T00:00:00.000Z' }] }
      : { status: 201 },
  );
  const api = createSupabase(config, f.fn);
  const rows = await api.getData(session, 'scope-1');
  assert.deepEqual(rows, [
    { key: 'pantry.v1', value: ['a'], updatedAt: Date.parse('2026-10-07T00:00:00.000Z') },
  ]);
  assert.match(f.calls[0].url, /scope=eq\.scope-1/);
  assert.equal((f.calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');

  await api.putData(session, 'scope-1', [{ key: 'pantry.v1', value: ['b'], updatedAt: 5 }]);
  assert.match(f.calls[1].url, /on_conflict=scope,key$/);
  assert.equal(
    (f.calls[1].init.headers as Record<string, string>).Prefer,
    'resolution=merge-duplicates,return=minimal',
  );
  assert.deepEqual(JSON.parse(f.calls[1].init.body as string), [
    { scope: 'scope-1', key: 'pantry.v1', value: ['b'], updated_at: '1970-01-01T00:00:00.005Z' },
  ]);
  await api.putData(session, 's', []);
  assert.equal(f.calls.length, 2);
});

test('share links', async () => {
  const id = '3f2a9c1e-5b7d-4e8a-9f10-2c4d6e8a0b1c';
  assert.equal(shareLink(id), `recipeapp://recipe/import?share=${id}`);
  assert.equal(parseShareId(`open ${shareLink(id)} please`), id);
  assert.equal(parseShareId(id.toUpperCase()), id);
  assert.equal(parseShareId('no id here'), undefined);
  const f = fakeFetch(() => ({ body: { title: 'Soup' } }));
  assert.deepEqual(await createSupabase(config, f.fn).getSharedRecipe(id), { title: 'Soup' });
  assert.match(f.calls[0].url, /rpc\/get_shared_recipe$/);
});
