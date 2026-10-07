import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';
import { likeWeight, suggestForYou } from '../src/lib/suggest.ts';

const DAY = 86_400_000;
const now = 1_800_000_000_000;

const recipe = (id: string, ingredients: string, over: Partial<Recipe> = {}): Recipe => ({
  id,
  title: id,
  tags: [],
  ingredients: parseIngredientList(ingredients),
  steps: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

test('likeWeight combines stars, favorite and times cooked', () => {
  assert.equal(likeWeight(recipe('a', ''), 0), 0);
  assert.equal(likeWeight(recipe('a', '', { rating: 5 }), 0), 2);
  assert.equal(likeWeight(recipe('a', '', { rating: 3 }), 0), 0);
  assert.equal(likeWeight(recipe('a', '', { favorite: true, rating: 4 }), 2), 3);
  assert.equal(likeWeight(recipe('a', ''), 10), 2); // capped at 4 times
});

test('no liked recipes, no suggestions', () => {
  assert.deepEqual(suggestForYou([recipe('a', '1 cup rice')], [], now), []);
});

test('suggests recipes like the ones you love, best match first', () => {
  const loved = recipe('Lentil Soup', '1 cup red lentils\n1 onion\n1 tsp cumin', {
    rating: 5,
    tags: ['vegetarian', 'soup'],
    category: 'Dinner',
  });
  const close = recipe('Chickpea Soup', '1 can chickpeas\n1 onion\n1 tsp cumin', {
    tags: ['vegetarian', 'soup'],
    category: 'Dinner',
  });
  const far = recipe('Brownies', '200 g chocolate\n2 eggs', { category: 'Dessert' });
  const okish = recipe('Veg Curry', '1 onion\n2 potatoes', { tags: ['vegetarian'] });
  const result = suggestForYou([loved, close, far, okish], [], now);
  assert.deepEqual(
    result.map((s) => s.recipe.id),
    ['Chickpea Soup', 'Veg Curry'],
  );
  assert.equal(result[0].similarTo.id, 'Lentil Soup');
});

test('skips recently cooked, low-rated and the loved recipe itself', () => {
  const loved = recipe('Soup', '1 onion', { rating: 5, tags: ['soup'] });
  const recent = recipe('Recent', '1 onion', { tags: ['soup'] });
  const old = recipe('Old', '1 onion', { tags: ['soup'] });
  const disliked = recipe('Disliked', '1 onion', { tags: ['soup'], rating: 1 });
  const cooked = [
    { recipeId: 'Recent', cookedAt: now - 3 * DAY },
    { recipeId: 'Old', cookedAt: now - 30 * DAY },
  ];
  const ids = suggestForYou([loved, recent, old, disliked], cooked, now).map((s) => s.recipe.id);
  assert.deepEqual(ids, ['Old']);
});

test('limit', () => {
  const loved = recipe('Loved', '1 onion', { rating: 5 });
  const others = Array.from({ length: 8 }, (_, i) => recipe(`r${i}`, '1 onion'));
  assert.equal(suggestForYou([loved, ...others], [], now, 3).length, 3);
});
