import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  afterMealChange,
  batchUse,
  cookingBatch,
  finishBatch,
  leftoverBatch,
  saveBatch,
  dateKey,
  fromDateKey,
  mealKey,
  normalizePlan,
  plannedMeals,
  setMeal,
  shopRangeDays,
  startOfWeek,
  weekDays,
} from '../src/lib/plan.ts';

test('dateKey uses the local date with zero padding', () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('weeks run Monday to Sunday', () => {
  // 2026-10-07 is a Wednesday, 2026-10-11 a Sunday.
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 7))), '2026-10-05');
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 11))), '2026-10-05');
  assert.equal(dateKey(startOfWeek(new Date(2026, 9, 5))), '2026-10-05');
  assert.deepEqual(weekDays(new Date(2026, 9, 7)).map(dateKey), [
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
  ]);
});

test('addDays crosses month and year ends', () => {
  assert.equal(dateKey(addDays(new Date(2026, 11, 31), 1)), '2027-01-01');
  assert.equal(dateKey(addDays(new Date(2026, 2, 1), -1)), '2026-02-28');
});

test('fromDateKey reads a date key back', () => {
  assert.equal(dateKey(fromDateKey('2026-03-29')), '2026-03-29');
  assert.equal(fromDateKey('2026-10-07').getDay(), 3);
});

test('setMeal plans, replaces and clears one meal', () => {
  let plan = setMeal({}, '2026-10-07', 'lunch', 'a');
  plan = setMeal(plan, '2026-10-07', 'dinner', 'b');
  assert.deepEqual(plan, { '2026-10-07': { lunch: 'a', dinner: 'b' } });
  plan = setMeal(plan, '2026-10-07', 'lunch', 'c');
  assert.deepEqual(plan, { '2026-10-07': { lunch: 'c', dinner: 'b' } });
  plan = setMeal(plan, '2026-10-07', 'lunch', undefined);
  assert.deepEqual(plan, { '2026-10-07': { dinner: 'b' } });
  assert.deepEqual(setMeal(plan, '2026-10-07', 'dinner', undefined), {});
});

test('plannedMeals lists meals in day and meal order, the same recipe as often as planned', () => {
  const plan = {
    '2026-10-08': { dinner: 'soup', breakfast: 'eggs' },
    '2026-10-07': { dinner: 'soup' },
    '2026-10-01': { lunch: 'old' },
  };
  assert.deepEqual(
    plannedMeals(plan, ['2026-10-07', '2026-10-08']).map((m) => `${m.day} ${m.meal} ${m.recipeId}`),
    ['2026-10-07 dinner soup', '2026-10-08 breakfast eggs', '2026-10-08 dinner soup'],
  );
  assert.equal(
    mealKey({ day: '2026-10-07', meal: 'dinner', recipeId: 'soup' }),
    '2026-10-07:dinner:soup',
  );
});

test('normalizePlan turns old lists into meals and drops junk', () => {
  assert.deepEqual(
    normalizePlan({
      '2026-10-07': ['a', 'b', 'c', 'd'],
      '2026-10-08': ['x'],
      '2026-10-09': { lunch: 'y', snack: 'z', dinner: 3 },
      '2026-10-10': [],
    }),
    {
      '2026-10-07': { breakfast: 'a', lunch: 'b', dinner: 'c' },
      '2026-10-08': { breakfast: 'x' },
      '2026-10-09': { lunch: 'y' },
    },
  );
  assert.deepEqual(normalizePlan(null), {});
});

test('shopping ranges start today and stay inside the week', () => {
  const week = weekDays(new Date(2026, 9, 7)).map(dateKey); // Mon 5 .. Sun 11
  assert.deepEqual(shopRangeDays(week, '2026-10-07', 'today'), ['2026-10-07']);
  assert.deepEqual(shopRangeDays(week, '2026-10-07', 'next3'), [
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
  ]);
  assert.deepEqual(shopRangeDays(week, '2026-10-10', 'next3'), ['2026-10-10', '2026-10-11']);
  assert.equal(shopRangeDays(week, '2026-10-07', 'week').length, 5);
  // A week that hasn't started, and one that's over.
  assert.equal(shopRangeDays(week, '2026-10-01', 'week').length, 7);
  assert.deepEqual(shopRangeDays(week, '2026-10-01', 'today'), []);
  assert.deepEqual(shopRangeDays(week, '2026-10-20', 'week'), []);
});

const soupBatch = {
  id: 'b1',
  recipeId: 'soup',
  cookDay: '2026-10-19',
  cookMeal: 'dinner' as const,
  servings: 8,
  people: 2,
  eats: [
    { day: '2026-10-20', meal: 'lunch' as const },
    { day: '2026-10-22', meal: 'lunch' as const },
  ],
};

test('a batch counts one serving per person per meal, the cooking meal too', () => {
  assert.deepEqual(batchUse(soupBatch), { used: 6, left: 2 });
  assert.deepEqual(batchUse({ ...soupBatch, servings: 4 }), { used: 6, left: -2 });
});

test('saving a batch plans its leftovers, and skips meals that hold something else', () => {
  const plan = { '2026-10-22': { lunch: 'pasta' } };
  const saved = saveBatch(plan, [], soupBatch);
  assert.deepEqual(saved.plan, {
    '2026-10-19': { dinner: 'soup' },
    '2026-10-20': { lunch: 'soup' },
    '2026-10-22': { lunch: 'pasta' },
  });
  assert.deepEqual(saved.batches[0].eats, [{ day: '2026-10-20', meal: 'lunch' }]);
  assert.equal(cookingBatch(saved.batches, saved.plan, '2026-10-19', 'dinner')?.id, 'b1');
  assert.equal(leftoverBatch(saved.batches, saved.plan, '2026-10-20', 'lunch')?.id, 'b1');
  assert.equal(leftoverBatch(saved.batches, saved.plan, '2026-10-22', 'lunch'), undefined);
});

test('editing a batch clears the leftover meals it no longer has', () => {
  const first = saveBatch({}, [], soupBatch);
  const edited = saveBatch(first.plan, first.batches, {
    ...soupBatch,
    eats: [{ day: '2026-10-21', meal: 'breakfast' }],
  });
  assert.deepEqual(edited.plan, {
    '2026-10-19': { dinner: 'soup' },
    '2026-10-21': { breakfast: 'soup' },
  });
  assert.equal(edited.batches.length, 1);
});

test('finishing a batch frees its leftover meals from today on', () => {
  const { plan, batches } = saveBatch({}, [], soupBatch);
  const done = finishBatch(plan, batches, 'b1', '2026-10-21');
  assert.deepEqual(done.plan, {
    '2026-10-19': { dinner: 'soup' },
    '2026-10-20': { lunch: 'soup' },
  });
  assert.deepEqual(done.batches, []);
});

test('changing a meal by hand updates the batches', () => {
  const saved = saveBatch({}, [], soupBatch);
  // A leftover meal swapped for something else stops being leftovers.
  const swapped = setMeal(saved.plan, '2026-10-20', 'lunch', 'salad');
  const a = afterMealChange(swapped, saved.batches, '2026-10-20', 'lunch');
  assert.deepEqual(a.batches[0].eats, [{ day: '2026-10-22', meal: 'lunch' }]);
  // Removing the cooking meal removes the batch and its leftovers.
  const cleared = setMeal(saved.plan, '2026-10-19', 'dinner', undefined);
  const b = afterMealChange(cleared, saved.batches, '2026-10-19', 'dinner');
  assert.deepEqual(b.plan, {});
  assert.deepEqual(b.batches, []);
});
