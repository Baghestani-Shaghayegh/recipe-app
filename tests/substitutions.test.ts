import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findSubstitutions } from '../src/lib/substitutions.ts';

test('finds swaps for common ingredients, ignoring plurals and harmless words', () => {
  assert.match(findSubstitutions('buttermilk')![0], /milk \+ 1 tbsp lemon/);
  assert.ok(findSubstitutions('3 large eggs'.replace('3 ', '')));
  assert.ok(findSubstitutions('eggs'));
  assert.ok(findSubstitutions('unsalted butter'));
  assert.ok(findSubstitutions('Fresh Parsley, chopped'));
  assert.ok(findSubstitutions('all-purpose flour'));
  assert.ok(findSubstitutions('low-fat milk'));
  assert.ok(findSubstitutions('heavy cream'));
});

test('look-alikes and unknown ingredients get nothing', () => {
  assert.equal(findSubstitutions('peanut butter'), undefined);
  assert.equal(findSubstitutions('coconut milk'), undefined);
  assert.equal(findSubstitutions('eggplant'), undefined);
  assert.equal(findSubstitutions('ice cream'), undefined);
  assert.equal(findSubstitutions('saffron'), undefined);
  assert.equal(findSubstitutions(''), undefined);
});
