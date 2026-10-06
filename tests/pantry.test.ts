import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientList } from '../src/lib/ingredients.ts';
import {
  isStaple,
  matchRecipe,
  newPantryItems,
  normalizeWords,
  pantryHas,
  recommend,
} from '../src/lib/pantry.ts';
import type { Recipe } from '../src/lib/recipe.ts';

function recipe(title: string, ingredients: string): Recipe {
  return {
    id: title,
    title,
    tags: [],
    ingredients: parseIngredientList(ingredients),
    steps: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

test('normalize drops descriptors, notes and plurals', () => {
  assert.deepEqual(normalizeWords('Ripe Tomatoes, chopped (about 300 g)'), ['tomato']);
  assert.deepEqual(normalizeWords('red lentils'), ['red', 'lentil']);
  assert.deepEqual(normalizeWords('fresh berries'), ['berry']);
  assert.deepEqual(normalizeWords('peaches'), ['peach']);
  assert.deepEqual(normalizeWords('potatoes'), ['potato']);
  assert.deepEqual(normalizeWords('hummus'), ['hummus']);
  assert.deepEqual(normalizeWords('molasses'), ['molasses']);
  assert.deepEqual(normalizeWords('glasses'), ['glass']);
});

test('staples', () => {
  for (const s of [
    'salt',
    'Salt and pepper',
    'olive oil',
    'black pepper',
    'water',
    'salt to taste',
  ]) {
    assert.ok(isStaple(s), s);
  }
  for (const s of ['olives', 'red pepper', 'black beans', 'sesame oil dressing', 'peppers']) {
    assert.ok(!isStaple(s), s);
  }
});

test('pantry matching works both ways and on whole words', () => {
  assert.ok(pantryHas(['egg'], 'eggs'));
  assert.ok(pantryHas(['Eggs'], 'egg'));
  assert.ok(pantryHas(['lentils'], 'red lentils'));
  assert.ok(pantryHas(['cheddar cheese'], 'cheese'));
  assert.ok(pantryHas(['onion'], 'red onion'));
  assert.ok(!pantryHas(['red onion'], 'onion powder'));
  assert.ok(!pantryHas(['pea'], 'peanut butter'));
  assert.ok(!pantryHas([], 'eggs'));
});

test('match skips staples', () => {
  const m = matchRecipe(recipe('Omelette', '3 eggs\n1 tbsp butter\nSalt and pepper'), ['eggs']);
  assert.deepEqual(
    m.have.map((i) => i.name),
    ['eggs'],
  );
  assert.deepEqual(
    m.missing.map((i) => i.name),
    ['butter'],
  );
});

test('recommend: ready, almost, and too far', () => {
  const omelette = recipe('Omelette', '3 eggs\n1 tbsp butter\nsalt');
  const pancakes = recipe(
    'Pancakes',
    '2 eggs\n1 cup flour\n1 cup milk\n1 tbsp sugar\n1 tsp baking powder',
  );
  const toast = recipe('Toast', '2 slices bread\nbutter');
  const soup = recipe('Soup', '1 cup lentils\n1 onion\n1 carrot\n1 lemon');
  const empty = recipe('Empty', '');
  const r = recommend(
    [pancakes, omelette, toast, soup, empty],
    ['eggs', 'butter', 'flour', 'milk'],
  );
  assert.deepEqual(
    r.ready.map((m) => m.recipe.title),
    ['Omelette'],
  );
  // Toast misses 1 (bread) so it ranks before Pancakes, which misses 2.
  assert.deepEqual(
    r.almost.map((m) => m.recipe.title),
    ['Toast', 'Pancakes'],
  );
});

test('recommend does not suggest recipes you have nothing for', () => {
  const r = recommend([recipe('Salad', '1 cucumber\n1 tomato')], ['eggs']);
  assert.deepEqual(r.almost, []);
});

test('new pantry items: split, trim, lowercase, no duplicates', () => {
  assert.deepEqual(newPantryItems(['eggs'], 'Egg, Milk ,\n rice, milk, ,'), ['milk', 'rice']);
});
