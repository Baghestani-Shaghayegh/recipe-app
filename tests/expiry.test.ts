import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  daysLeft,
  describeExpiry,
  expiringItems,
  expiryIn,
  recipesToUseUp,
} from '../src/lib/expiry.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';

const today = new Date(2026, 9, 7); // 7 Oct 2026

const recipe = (title: string, ingredients: string): Recipe => ({
  id: title,
  title,
  tags: [],
  ingredients: parseIngredientList(ingredients),
  steps: [],
  createdAt: 0,
  updatedAt: 0,
});

test('expiryIn and daysLeft agree, including across month ends', () => {
  assert.equal(expiryIn(3, today), '2026-10-10');
  assert.equal(expiryIn(30, today), '2026-11-06');
  assert.equal(daysLeft('2026-10-10', today), 3);
  assert.equal(daysLeft('2026-10-07', today), 0);
  assert.equal(daysLeft('2026-10-05', today), -2);
  assert.equal(daysLeft('2026-11-06', today), 30);
});

test('describeExpiry', () => {
  assert.equal(describeExpiry(-1), 'Expired yesterday');
  assert.equal(describeExpiry(-3), 'Expired 3 days ago');
  assert.equal(describeExpiry(0), 'Expires today');
  assert.equal(describeExpiry(1), 'Expires tomorrow');
  assert.equal(describeExpiry(5), 'Expires in 5 days');
});

test('expiringItems picks items due soon, soonest first', () => {
  const pantry = ['milk', 'rice', 'spinach', 'yogurt', 'old cream'];
  const expiry = {
    milk: '2026-10-09',
    rice: '2027-01-01',
    spinach: '2026-10-08',
    'old cream': '2026-10-01',
    gone: '2026-10-08', // not in the pantry any more
  };
  assert.deepEqual(expiringItems(pantry, expiry, today), [
    { item: 'old cream', daysLeft: -6 },
    { item: 'spinach', daysLeft: 1 },
    { item: 'milk', daysLeft: 2 },
  ]);
  assert.deepEqual(expiringItems(pantry, {}, today), []);
});

test('recipesToUseUp ranks recipes by how many expiring items they use', () => {
  const recipes = [
    recipe('Omelette', '3 eggs\n1 tbsp butter'),
    recipe('Spinach Soup', '200 g spinach\n1 cup milk\n1 onion'),
    recipe('Toast', '2 slices bread'),
    recipe('Smoothie', '1 cup milk\n1 banana'),
  ];
  const expiring = [
    { item: 'spinach', daysLeft: 1 },
    { item: 'milk', daysLeft: 2 },
  ];
  const result = recipesToUseUp(recipes, expiring);
  assert.deepEqual(
    result.map((m) => m.recipe.title),
    ['Spinach Soup', 'Smoothie'],
  );
  assert.deepEqual(
    result[0].uses.map((u) => u.item),
    ['spinach', 'milk'],
  );
  assert.deepEqual(recipesToUseUp(recipes, []), []);
});
