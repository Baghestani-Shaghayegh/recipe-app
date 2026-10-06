import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOODS } from '../src/lib/foods.ts';
import { parseIngredientLine, parseIngredientList } from '../src/lib/ingredients.ts';
import {
  estimateNutrition,
  findFood,
  ingredientNutrition,
  servingNutrition,
} from '../src/lib/nutrition.ts';

const near = (actual: number | undefined, expected: number, tol = 0.5) =>
  assert.ok(actual !== undefined && Math.abs(actual - expected) <= tol, `${actual} ≉ ${expected}`);

const line = (text: string) => ingredientNutrition(parseIngredientLine(text));

test('every food has sane values', () => {
  for (const f of FOODS) {
    // Exceptions: baking powder is mostly non-digestible carbs; vanilla extract's calories are alcohol.
    if (['baking powder', 'vanilla'].includes(f.names[0])) continue;
    const macroKcal = f.protein * 4 + f.carbs * 4 + f.fat * 9;
    assert.ok(f.protein + f.carbs + f.fat <= 101, f.names[0]);
    // Calories should roughly match the macros. They can be lower (fiber counts as carbs
    // but has few calories, e.g. spices and cocoa), but not by more than half.
    assert.ok(
      f.kcal <= macroKcal + Math.max(40, macroKcal * 0.25) && f.kcal >= macroKcal * 0.5,
      `${f.names[0]}: ${macroKcal} vs ${f.kcal}`,
    );
  }
});

test('the most specific food name wins', () => {
  assert.equal(findFood('olive oil')?.names[0], 'oil');
  assert.equal(findFood('olives')?.names[0], 'olive');
  assert.equal(findFood('lemon juice')?.names[0], 'lemon juice');
  assert.equal(findFood('lemon')?.names[0], 'lemon');
  assert.equal(findFood('peanut butter')?.names[0], 'peanut butter');
  assert.equal(findFood('red lentils')?.names[0], 'lentil');
  assert.equal(findFood('chopped tomatoes')?.names[0], 'tomato');
  assert.equal(findFood('vegetable stock')?.names[0], 'stock');
  assert.equal(findFood('chicken stock')?.names[0], 'stock');
  assert.equal(findFood('eggplant')?.names[0], 'eggplant');
  assert.equal(findFood('dragon fruit'), undefined);
});

test('counts, weights and volumes', () => {
  near(line('3 eggs').grams, 150);
  near(line('3 eggs').nutrients?.kcal, 214.5);
  near(line('1 cup flour').grams, 125);
  near(line('1 tbsp butter').grams, 14.2, 0.1);
  near(line('1 tbsp olive oil').nutrients?.kcal, 119.4);
  near(line('2 cloves garlic').grams, 6);
  near(line('200 g chicken breast').nutrients?.protein, 45);
  near(line('1 lb ground beef').grams, 453.6);
  near(line('1 l vegetable stock').nutrients?.kcal, 70);
  near(line('1 can chickpeas').grams, 240);
});

test('problems are reported, staples without amount are skipped quietly', () => {
  assert.equal(line('Salt and pepper').problem, 'skipped');
  assert.equal(line('fresh herbs').problem, 'no-amount');
  assert.equal(line('2 dragon fruits').problem, 'unknown-food');
  assert.equal(line('1 can lentils').problem, 'unknown-size');
});

test('recipe totals and per serving', () => {
  const recipe = {
    servings: 2,
    ingredients: parseIngredientList('4 eggs\n1 tbsp butter\nsalt\n1 handful of something'),
  };
  const est = estimateNutrition(recipe);
  near(est.total.kcal, 4 * 50 * 1.43 + 14.2 * 7.17, 1);
  near(est.perServing.kcal, est.total.kcal / 2, 0.01);
  assert.equal(est.countedCount, 2);
  assert.deepEqual(
    est.notCounted.map((l) => l.ingredient.text),
    ['1 handful of something'],
  );
});

test('no servings means one serving', () => {
  const est = estimateNutrition({ ingredients: parseIngredientList('2 eggs') });
  assert.equal(est.servings, 1);
  near(est.perServing.kcal, 143);
});

test('manual numbers win over the estimate', () => {
  const manual = { kcal: 500, protein: 20, carbs: 50, fat: 10 };
  const ingredients = parseIngredientList('2 eggs');
  assert.deepEqual(servingNutrition({ ingredients, nutrition: manual }), {
    values: manual,
    source: 'manual',
  });
  assert.equal(servingNutrition({ ingredients })?.source, 'estimate');
  assert.equal(
    servingNutrition({ ingredients: parseIngredientList('a pinch of love') }),
    undefined,
  );
});
