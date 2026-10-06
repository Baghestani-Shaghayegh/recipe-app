import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientLine, parseIngredientList } from '../src/lib/ingredients.ts';

test('amount, unit and name', () => {
  assert.deepEqual(parseIngredientLine('2 cups flour'), {
    text: '2 cups flour',
    amount: 2,
    unit: 'cup',
    name: 'flour',
  });
});

test('fractions and mixed numbers', () => {
  assert.equal(parseIngredientLine('1/2 tsp salt').amount, 0.5);
  assert.equal(parseIngredientLine('1 1/2 cups milk').amount, 1.5);
  assert.equal(parseIngredientLine('½ cup sugar').amount, 0.5);
  assert.equal(parseIngredientLine('1½ cups rice').amount, 1.5);
  assert.equal(parseIngredientLine('1.5 kg lamb').amount, 1.5);
});

test('amount without a unit', () => {
  const ing = parseIngredientLine('3 eggs');
  assert.equal(ing.amount, 3);
  assert.equal(ing.unit, undefined);
  assert.equal(ing.name, 'eggs');
});

test('no amount keeps the whole line as the name', () => {
  assert.deepEqual(parseIngredientLine('Salt and pepper to taste'), {
    text: 'Salt and pepper to taste',
    amount: undefined,
    unit: undefined,
    name: 'Salt and pepper to taste',
  });
});

test('"of", bullets and unit abbreviations with a dot', () => {
  const ing = parseIngredientLine('- 2 tbsp. of olive oil');
  assert.equal(ing.unit, 'tbsp');
  assert.equal(ing.name, 'olive oil');
  assert.equal(ing.text, '2 tbsp. of olive oil');
});

test('T is tablespoon, t is teaspoon', () => {
  assert.equal(parseIngredientLine('1 T butter').unit, 'tbsp');
  assert.equal(parseIngredientLine('1 t cinnamon').unit, 'tsp');
});

test('a word that only looks like a unit is not taken without an amount', () => {
  assert.equal(parseIngredientLine('can of tomatoes').unit, undefined);
});

test('list skips blank lines', () => {
  assert.equal(parseIngredientList('2 eggs\n\n  \n1 cup milk\n').length, 2);
});
