import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createBackup, mergeRecipes, parseBackup } from '../src/lib/backup.ts';
import type { Recipe } from '../src/lib/recipe.ts';

const recipe = (id: string): Recipe => ({
  id,
  title: `Recipe ${id}`,
  tags: ['quick'],
  ingredients: [{ text: '2 eggs', amount: 2, name: 'eggs' }],
  steps: ['Cook.'],
  favorite: true,
  createdAt: 1,
  updatedAt: 2,
});

test('a backup round-trips', () => {
  const data = { recipes: [recipe('a'), recipe('b')], pantry: ['rice', 'eggs'] };
  const parsed = parseBackup(createBackup(data));
  assert.deepEqual(parsed, { ok: true, data });
});

test('bad text is rejected with a message', () => {
  for (const text of ['', 'hello', '{"recipes":[]}', '[]', 'null']) {
    const parsed = parseBackup(text);
    assert.equal(parsed.ok, false, text);
  }
  const newer = JSON.stringify({ app: 'recipe-box', version: 99, recipes: [] });
  assert.equal(parseBackup(newer).ok, false);
});

test('malformed recipes are skipped', () => {
  const text = JSON.stringify({
    app: 'recipe-box',
    version: 1,
    recipes: [recipe('a'), { id: 'x' }, null, { ...recipe('c'), steps: 'nope' }],
  });
  const parsed = parseBackup(text);
  assert.ok(parsed.ok);
  assert.deepEqual(
    parsed.data.recipes.map((r) => r.id),
    ['a'],
  );
  assert.deepEqual(parsed.data.pantry, []);
});

test('merge keeps existing recipes and adds only new ones', () => {
  const mine = { ...recipe('a'), title: 'My edited version' };
  const { merged, added } = mergeRecipes([mine], [recipe('a'), recipe('b'), recipe('b')]);
  assert.equal(added, 1);
  assert.deepEqual(
    merged.map((r) => [r.id, r.title]),
    [
      ['a', 'My edited version'],
      ['b', 'Recipe b'],
    ],
  );
});
