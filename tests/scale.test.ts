import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientLine } from '../src/lib/ingredients.ts';
import { scaleFactor, scaleIngredientText } from '../src/lib/scale.ts';

const scale = (line: string, factor: number) => scaleIngredientText(parseIngredientLine(line), factor);

test('scaleFactor', () => {
  assert.equal(scaleFactor(2, 6), 3);
  assert.equal(scaleFactor(4, 2), 0.5);
  assert.equal(scaleFactor(undefined, 6), 1);
  assert.equal(scaleFactor(0, 6), 1);
});

test('scales amounts and keeps units', () => {
  assert.equal(scale('1 1/2 cups flour', 2), '3 cups flour');
  assert.equal(scale('2 eggs', 3), '6 eggs');
  assert.equal(scale('200 g rice', 0.5), '100 g rice');
});

test('formats fractions and pluralises units', () => {
  assert.equal(scale('1 cup milk', 1.5), '1½ cups milk');
  assert.equal(scale('1 cup milk', 0.25), '¼ cup milk');
  assert.equal(scale('1 tbsp oil', 4 / 3), '1⅓ tbsp oil');
  assert.equal(scale('2 cloves garlic', 0.5), '1 clove garlic');
});

test('leaves lines without an amount, and factor 1, unchanged', () => {
  assert.equal(scale('salt to taste', 4), 'salt to taste');
  assert.equal(scale('2-3 eggs', 2), '2-3 eggs');
  assert.equal(scale('1 cup of flour', 1), '1 cup of flour');
});
