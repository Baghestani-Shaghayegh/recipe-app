import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientList } from '../src/lib/ingredients.ts';
import {
  allTags,
  filterRecipes,
  formatMinutes,
  parseTags,
  totalMinutes,
  type Recipe,
} from '../src/lib/recipe.ts';

function recipe(over: Partial<Recipe>): Recipe {
  return {
    id: Math.random().toString(36),
    title: 'Untitled',
    tags: [],
    ingredients: [],
    steps: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const omelette = recipe({
  title: 'Herb Omelette',
  category: 'Breakfast',
  prepMinutes: 5,
  cookMinutes: 5,
  tags: ['quick', 'vegetarian'],
  ingredients: parseIngredientList('3 eggs\n1 tbsp butter\nfresh herbs'),
});
const stew = recipe({
  title: 'Ghormeh Sabzi',
  category: 'Dinner',
  prepMinutes: 30,
  cookMinutes: 150,
  tags: ['persian'],
  ingredients: parseIngredientList('500 g lamb\n1 cup kidney beans\n4 dried limes'),
});
const noTime = recipe({ title: 'Mystery Cake', category: 'Dessert' });
const all = [omelette, stew, noTime];

test('total time', () => {
  assert.equal(totalMinutes(omelette), 10);
  assert.equal(totalMinutes({ cookMinutes: 20 }), 20);
  assert.equal(totalMinutes(noTime), undefined);
});

test('format minutes', () => {
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(180), '3 h');
  assert.equal(formatMinutes(95), '1 h 35 min');
});

test('parse tags', () => {
  assert.deepEqual(parseTags(' Spicy, quick ,, spicy,Vegetarian '), [
    'spicy',
    'quick',
    'vegetarian',
  ]);
});

test('no filters returns everything', () => {
  assert.equal(filterRecipes(all, { query: '', tags: [] }).length, 3);
});

test('search by title, ingredient and tag, case insensitive', () => {
  assert.deepEqual(filterRecipes(all, { query: 'ghormeh', tags: [] }), [stew]);
  assert.deepEqual(filterRecipes(all, { query: 'EGGS', tags: [] }), [omelette]);
  assert.deepEqual(filterRecipes(all, { query: 'persian lamb', tags: [] }), [stew]);
  assert.deepEqual(filterRecipes(all, { query: 'lamb eggs', tags: [] }), []);
});

test('filter by category', () => {
  assert.deepEqual(filterRecipes(all, { query: '', category: 'Dinner', tags: [] }), [stew]);
});

test('time filter hides slow recipes and ones with no time', () => {
  assert.deepEqual(filterRecipes(all, { query: '', maxMinutes: 30, tags: [] }), [omelette]);
});

test('all selected tags must match', () => {
  assert.deepEqual(filterRecipes(all, { query: '', tags: ['quick'] }), [omelette]);
  assert.deepEqual(filterRecipes(all, { query: '', tags: ['quick', 'persian'] }), []);
});

test('all tags, most used first', () => {
  const extra = recipe({ tags: ['quick'] });
  assert.deepEqual(allTags([...all, extra]), ['quick', 'persian', 'vegetarian']);
});
