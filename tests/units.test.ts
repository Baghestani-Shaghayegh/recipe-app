import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIngredientLine } from '../src/lib/ingredients.ts';
import { scaleIngredientText } from '../src/lib/scale.ts';
import { convertAmount, convertTemperatures } from '../src/lib/units.ts';

const show = (line: string, system: 'metric' | 'us', factor = 1) =>
  scaleIngredientText(parseIngredientLine(line), factor, system);

test('US to metric', () => {
  assert.equal(show('1 cup milk', 'metric'), '235 ml milk');
  assert.equal(show('2 tbsp oil', 'metric'), '30 ml oil');
  assert.equal(show('1 tsp salt', 'metric'), '5 ml salt');
  assert.equal(show('4 cups water', 'metric'), '945 ml water');
  assert.equal(show('5 cups water', 'metric'), '1.2 l water');
  assert.equal(show('8 oz pasta', 'metric'), '225 g pasta');
  assert.equal(show('2 lb potatoes', 'metric'), '905 g potatoes');
  assert.equal(show('5 lb potatoes', 'metric'), '2¼ kg potatoes');
});

test('metric to US', () => {
  assert.equal(show('250 ml milk', 'us'), '1 cup milk');
  assert.equal(show('30 ml oil', 'us'), '2 tbsp oil');
  assert.equal(show('5 ml vanilla', 'us'), '1 tsp vanilla');
  assert.equal(show('100 g sugar', 'us'), '3.5 oz sugar');
  assert.equal(show('1 kg flour', 'us'), '2.2 lb flour');
});

test('other units, counts and no-amount lines are untouched; scaling combines', () => {
  assert.equal(show('2 cloves garlic', 'metric'), '2 cloves garlic');
  assert.equal(show('3 eggs', 'us'), '3 eggs');
  assert.equal(show('salt to taste', 'metric'), 'salt to taste');
  assert.equal(show('1 cup milk', 'metric', 2), '475 ml milk');
  assert.deepEqual(convertAmount(5, 'cup', 'original'), { amount: 5, unit: 'cup' });
});

test('temperatures', () => {
  assert.equal(
    convertTemperatures('Bake at 350°F for 20 min', 'metric'),
    'Bake at 175°C for 20 min',
  );
  assert.equal(convertTemperatures('Heat oven to 180 °C.', 'us'), 'Heat oven to 355°F.');
  assert.equal(convertTemperatures('Heat to 200 degrees C', 'us'), 'Heat to 390°F');
  assert.equal(convertTemperatures('Bake at 350°F', 'us'), 'Bake at 350°F');
  assert.equal(convertTemperatures('Bake at 350°F', 'original'), 'Bake at 350°F');
});
