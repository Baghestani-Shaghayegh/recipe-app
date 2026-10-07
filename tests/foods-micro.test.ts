import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOODS } from '../src/lib/foods.ts';
import { microFor } from '../src/lib/foods-micro.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import { estimateExtras } from '../src/lib/nutrition.ts';

test('every food in the table has fiber, sugar and sodium values', () => {
  for (const f of FOODS) {
    const m = microFor(f);
    assert.ok(m, f.names[0]);
    // Sugar can't be more than the carbs, within rounding.
    assert.ok(m.sugar <= f.carbs + 2, `${f.names[0]}: sugar ${m.sugar} vs carbs ${f.carbs}`);
    assert.ok(m.fiber <= f.carbs + f.protein + f.fat + 1 || f.carbs === 0, f.names[0]);
  }
});

test('adds up fiber, sugar and sodium per serving', () => {
  // 200 g flour (5.4 g fiber, 0.6 g sugar, 4 mg sodium) + 100 g sugar (100 g sugar), 2 servings.
  const extras = estimateExtras({
    ingredients: parseIngredientList('200 g flour\n100 g sugar'),
    servings: 2,
  })!;
  assert.ok(Math.abs(extras.fiber - 2.7) < 0.01);
  assert.ok(Math.abs(extras.sugar - 50.3) < 0.01);
  assert.ok(Math.abs(extras.sodium - 2.5) < 0.01);
  assert.equal(
    estimateExtras({ ingredients: parseIngredientList('something exotic'), servings: 1 }),
    undefined,
  );
});
