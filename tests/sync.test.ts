import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Recipe } from '../src/lib/recipe.ts';
import type { RemoteRow, Session, SupabaseClient } from '../src/lib/supabase.ts';
import { markChanged, mergeRecipeLists, runSync, type SyncMeta } from '../src/lib/sync.ts';

const session: Session = {
  accessToken: 't',
  refreshToken: 'r',
  expiresAt: 0,
  userId: 'u',
  email: 'e',
};

function fakeServer(rows: RemoteRow[] = []) {
  const store = new Map(rows.map((r) => [r.key, r]));
  const client = {
    getData: async () => [...store.values()],
    putData: async (_s: Session, _scope: string, put: RemoteRow[]) => {
      for (const r of put) store.set(r.key, r);
    },
  } as unknown as SupabaseClient;
  return { client, store };
}

function fakeStorage(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    data,
    storage: {
      get: async (k: string) => data.get(k) ?? null,
      set: async (k: string, json: string) => void data.set(k, json),
    },
  };
}

const recipe = (id: string, over: Partial<Recipe> = {}): Recipe => ({
  id,
  title: id,
  tags: [],
  ingredients: [],
  steps: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const run = (
  server: ReturnType<typeof fakeServer>,
  local: ReturnType<typeof fakeStorage>,
  meta: SyncMeta,
  now = 1000,
) => {
  const pulledKeys: string[] = [];
  return runSync({
    client: server.client,
    session,
    scope: 's',
    storage: local.storage,
    meta,
    now,
    onPulled: (k) => pulledKeys.push(k),
  }).then((r) => ({ ...r, pulledKeys }));
};

test('first sign-in with an empty server uploads what is on the device', async () => {
  const server = fakeServer();
  const local = fakeStorage({ 'pantry.v1': ['rice'], 'recipes.v1': [recipe('a')] });
  const r = await run(server, local, {});
  assert.deepEqual(r.pushed.sort(), ['pantry.v1', 'recipes.v1']);
  assert.deepEqual(server.store.get('pantry.v1')?.value, ['rice']);
});

test('a new device takes the server data, and recipes from both sides are merged', async () => {
  const server = fakeServer([
    { key: 'pantry.v1', value: ['eggs'], updatedAt: 500 },
    { key: 'recipes.v1', value: [recipe('a', { updatedAt: 5 }), recipe('b')], updatedAt: 500 },
  ]);
  const local = fakeStorage({
    'pantry.v1': ['rice'],
    'recipes.v1': [recipe('a', { updatedAt: 1 }), recipe('c')],
  });
  const r = await run(server, local, {});
  assert.deepEqual(JSON.parse(local.data.get('pantry.v1')!), ['eggs']);
  const ids = (JSON.parse(local.data.get('recipes.v1')!) as Recipe[]).map((x) => x.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']);
  const a = (JSON.parse(local.data.get('recipes.v1')!) as Recipe[]).find((x) => x.id === 'a')!;
  assert.equal(a.updatedAt, 5);
  assert.ok(r.pushed.includes('recipes.v1')); // the merged list goes back up
  assert.deepEqual(r.pulledKeys.sort(), ['pantry.v1', 'recipes.v1']);
});

test('the newer side wins for a key', async () => {
  const server = fakeServer([{ key: 'pantry.v1', value: ['server'], updatedAt: 500 }]);
  // Changed here after the server's version: pushed.
  const newer = fakeStorage({ 'pantry.v1': ['mine'] });
  const r1 = await run(server, newer, markChanged({}, 'pantry.v1', 900));
  assert.deepEqual(r1.pushed, ['pantry.v1']);
  assert.deepEqual(server.store.get('pantry.v1')?.value, ['mine']);
  // Changed here before the server's version: the server's is stored.
  const server2 = fakeServer([{ key: 'pantry.v1', value: ['server'], updatedAt: 500 }]);
  const older = fakeStorage({ 'pantry.v1': ['mine'] });
  const r2 = await run(server2, older, markChanged({}, 'pantry.v1', 100));
  assert.deepEqual(r2.pulled, ['pantry.v1']);
  assert.deepEqual(JSON.parse(older.data.get('pantry.v1')!), ['server']);
});

test('nothing to do when both sides agree', async () => {
  const server = fakeServer([{ key: 'goals.v1', value: { kcal: 2000 }, updatedAt: 500 }]);
  const local = fakeStorage({ 'goals.v1': { kcal: 2000 } });
  const r = await run(server, local, { 'goals.v1': { updatedAt: 500, dirty: false } });
  assert.deepEqual([r.pulled, r.pushed], [[], []]);
});

test('mergeRecipeLists keeps everything and prefers the newest edit', () => {
  const merged = mergeRecipeLists(
    [recipe('a', { title: 'old', updatedAt: 1 })],
    [recipe('a', { title: 'new', updatedAt: 2 }), recipe('b')],
  );
  assert.deepEqual(merged.map((r) => [r.id, r.title]).sort(), [
    ['a', 'new'],
    ['b', 'b'],
  ]);
});
