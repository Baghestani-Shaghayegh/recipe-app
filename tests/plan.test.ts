import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  addToPlan,
  dateKey,
  removeFromPlan,
  startOfWeek,
  upcomingRecipeIds,
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

test('add and remove keep the plan tidy', () => {
  let plan = addToPlan({}, '2026-10-07', 'a');
  plan = addToPlan(plan, '2026-10-07', 'b');
  assert.deepEqual(plan, { '2026-10-07': ['a', 'b'] });
  assert.equal(addToPlan(plan, '2026-10-07', 'a'), plan);
  plan = removeFromPlan(plan, '2026-10-07', 'a');
  assert.deepEqual(plan, { '2026-10-07': ['b'] });
  assert.deepEqual(removeFromPlan(plan, '2026-10-07', 'b'), {});
  assert.deepEqual(removeFromPlan(plan, '2026-10-08', 'x'), plan);
});

test('upcomingRecipeIds skips the past, sorts by date and dedupes', () => {
  const plan = {
    '2026-10-09': ['c', 'a'],
    '2026-10-06': ['old'],
    '2026-10-07': ['a', 'b'],
  };
  assert.deepEqual(upcomingRecipeIds(plan, '2026-10-07'), ['a', 'b', 'c']);
  assert.deepEqual(upcomingRecipeIds({}, '2026-10-07'), []);
});
