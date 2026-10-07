import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';
import { parseRecipeText } from '../src/lib/recipe-text.ts';
import { recipeToText } from '../src/lib/share.ts';

const soup: Recipe = {
  id: 'a',
  title: 'Lentil Soup',
  category: 'Dinner',
  tags: ['vegetarian', 'meal-prep'],
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 35,
  ingredients: parseIngredientList('1 cup red lentils\n1 onion\n2 cloves garlic'),
  steps: ['Fry the onion and garlic.', 'Add lentils and 1 l stock. Simmer 30 minutes at 350°F.'],
  notes: 'Freezes well.',
  sourceUrl: 'https://example.com/soup',
  createdAt: 0,
  updatedAt: 0,
};

test('formats a recipe as text', () => {
  assert.equal(
    recipeToText(soup),
    [
      'Lentil Soup\nServes 4 · Prep 10 min · Cook 35 min · Total 45 min',
      'Ingredients:\n- 1 cup red lentils\n- 1 onion\n- 2 cloves garlic',
      'Method:\n1. Fry the onion and garlic.\n2. Add lentils and 1 l stock. Simmer 30 minutes at 350°F.',
      'Notes: Freezes well.',
      '#vegetarian #meal-prep',
      'Source: https://example.com/soup',
    ].join('\n\n'),
  );
});

test('uses the chosen servings and units', () => {
  const text = recipeToText(soup, { factor: 2, servings: 8, units: 'metric' });
  assert.match(text, /Serves 8/);
  assert.match(text, /- 475 ml red lentils/);
  assert.match(text, /at 175°C/);
});

test('a shared recipe can be read back by the importer', () => {
  const back = parseRecipeText(recipeToText(soup));
  assert.equal(back.title, 'Lentil Soup');
  assert.deepEqual(back.ingredients.length, 3);
  assert.equal(back.steps.length, 2);
  assert.equal(back.servings, 4);
});

test('leaves out empty parts', () => {
  const text = recipeToText({
    ...soup,
    ingredients: [],
    steps: [],
    notes: undefined,
    tags: [],
    sourceUrl: undefined,
  });
  assert.equal(text, 'Lentil Soup\nServes 4 · Prep 10 min · Cook 35 min · Total 45 min');
});

import { recipeFromShared, sharedPayload } from '../src/lib/share.ts';

test('a shared link round-trips and leaves out private details', () => {
  const mine: Recipe = { ...soup, photoUri: 'file:///photo.jpg', rating: 5, favorite: true };
  const payload = sharedPayload(mine);
  assert.ok(!('photoUri' in payload) && !('rating' in payload) && !('id' in payload));
  const back = recipeFromShared(JSON.parse(JSON.stringify(payload)))!;
  assert.equal(back.title, 'Lentil Soup');
  assert.equal(back.category, 'Dinner');
  assert.equal(back.servings, 4);
  assert.deepEqual(back.steps, soup.steps);
  assert.deepEqual(
    back.ingredients.map((i) => i.name),
    ['red lentils', 'onion', 'garlic'],
  );
  assert.equal(back.ingredients[0].amount, 1);
});

test('junk from a shared link is rejected or cleaned', () => {
  assert.equal(recipeFromShared(null), undefined);
  assert.equal(recipeFromShared({ title: '', steps: [], tags: [], ingredients: [] }), undefined);
  assert.equal(recipeFromShared({ title: 'x', steps: 'no', tags: [], ingredients: [] }), undefined);
  const odd = recipeFromShared({
    title: 'x',
    steps: [],
    tags: [],
    category: 'Nonsense',
    ingredients: [{ text: 'ok', name: 'ok' }, { text: 5 }, null],
    nutrition: { kcal: 'lots' },
  })!;
  assert.equal(odd.category, undefined);
  assert.equal(odd.ingredients.length, 1);
  assert.equal(odd.nutrition, undefined);
});
