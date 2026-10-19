import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findTimers, formatClock } from '../src/lib/timers.ts';

test('finds times in steps', () => {
  assert.deepEqual(findTimers('Simmer for 30 minutes, stirring now and then.'), [
    { label: '30 min', seconds: 1800 },
  ]);
  assert.deepEqual(findTimers('Bake 1.5 hours.'), [{ label: '1.5 h', seconds: 5400 }]);
  assert.deepEqual(findTimers('Rest 45 sec'), [{ label: '45 sec', seconds: 45 }]);
});

test('ranges use the shorter time', () => {
  assert.deepEqual(findTimers('Fry 5-7 minutes per side'), [{ label: '5–7 min', seconds: 300 }]);
  assert.deepEqual(findTimers('Cook 10 to 12 mins'), [{ label: '10–12 min', seconds: 600 }]);
});

test('several times, and none', () => {
  assert.deepEqual(
    findTimers('Boil 10 minutes, then rest 5 minutes, then boil 10 minutes again.').map(
      (t) => t.label,
    ),
    ['10 min', '5 min'],
  );
  assert.deepEqual(findTimers('Add 2 tbsp butter and 3 eggs.'), []);
  assert.deepEqual(findTimers('Heat to 180 degrees, 5m of oil'), []);
  assert.deepEqual(findTimers('Wait 0 minutes'), []);
});

test('fractions and words', () => {
  assert.deepEqual(findTimers('Bake 1½ hours.'), [{ label: '1.5 h', seconds: 5400 }]);
  assert.deepEqual(findTimers('Bake 1 1/2 hours.'), [{ label: '1.5 h', seconds: 5400 }]);
  assert.deepEqual(findTimers('Rest ½ hour'), [{ label: '0.5 h', seconds: 1800 }]);
  assert.deepEqual(findTimers('Chill for 1/2 hour'), [{ label: '0.5 h', seconds: 1800 }]);
  assert.deepEqual(findTimers('Let it rest for half an hour.'), [
    { label: '30 min', seconds: 1800 },
  ]);
  assert.deepEqual(findTimers('Simmer for an hour.'), [{ label: '1 h', seconds: 3600 }]);
  assert.deepEqual(findTimers('Roast for an hour and a half.'), [
    { label: '1.5 h', seconds: 5400 },
  ]);
  assert.deepEqual(findTimers('Stir for a minute.'), [{ label: '1 min', seconds: 60 }]);
});

test('hours and minutes together make one timer', () => {
  assert.deepEqual(findTimers('Bake for 1 hour 30 minutes.'), [
    { label: '1 h 30 min', seconds: 5400 },
  ]);
  assert.deepEqual(findTimers('Simmer 2 hrs and 15 mins'), [
    { label: '2 h 15 min', seconds: 8100 },
  ]);
  assert.deepEqual(
    findTimers('Proof 1 hour, then bake 30 minutes').map((t) => t.label),
    ['1 h', '30 min'],
  );
});

test('formatClock', () => {
  assert.equal(formatClock(90), '1:30');
  assert.equal(formatClock(5), '0:05');
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatClock(-3), '0:00');
  assert.equal(formatClock(0.2), '0:01');
});
