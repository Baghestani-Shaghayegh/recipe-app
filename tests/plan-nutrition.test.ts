import assert from 'node:assert/strict';
import { test } from 'node:test';

import { goalProgress, parseGoal, planNutrition } from '../src/lib/plan-nutrition.ts';
import type { Recipe } from '../src/lib/recipe.ts';

const recipe = (id: string, over: Partial<Recipe> = {}): Recipe => ({
  id,
  title: id,
  tags: [],
  ingredients: [],
  steps: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const manual = (kcal: number, protein: number) => ({ kcal, protein, carbs: 10, fat: 5 });

test('adds up one serving of each planned recipe', () => {
  const recipes = new Map([
    ['a', recipe('a', { nutrition: manual(500, 30) })],
    ['b', recipe('b', { nutrition: manual(300, 10) })],
    ['nodata', recipe('nodata')],
  ]);
  const plan = {
    '2026-10-05': ['a', 'b'],
    '2026-10-06': ['a', 'nodata', 'deleted'],
    '2026-10-12': ['b'],
  };
  const week = planNutrition(plan, ['2026-10-05', '2026-10-06'], recipes);
  assert.deepEqual(week.total, { kcal: 1300, protein: 70, carbs: 30, fat: 15 });
  assert.equal(week.unknown, 1);
  const empty = planNutrition(plan, ['2026-10-07'], recipes);
  assert.deepEqual(empty, { total: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, unknown: 0 });
});

test('parseGoal and goalProgress', () => {
  assert.equal(parseGoal('1,800'), 1800);
  assert.equal(parseGoal('120 g'), 120);
  assert.equal(parseGoal(''), undefined);
  assert.equal(parseGoal('0'), undefined);
  assert.equal(parseGoal('abc'), undefined);
  assert.equal(goalProgress(900, 1800), 0.5);
  assert.equal(goalProgress(900, undefined), undefined);
});
