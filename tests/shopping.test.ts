import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOODS, STORE_SECTIONS } from '../src/lib/foods.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';
import {
  buildShoppingList,
  formatAmount,
  shoppingListText,
  shoppingName,
} from '../src/lib/shopping.ts';

function recipe(title: string, ingredients: string): Recipe {
  return {
    id: title,
    title,
    tags: [],
    ingredients: parseIngredientList(ingredients),
    steps: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

const byName = (items: ReturnType<typeof buildShoppingList>) =>
  Object.fromEntries(items.map((i) => [i.name, i]));

test('every food has a store section', () => {
  const section = (n: string) => FOODS.find((f) => f.names[0] === n)?.section;
  assert.equal(section('egg'), 'Dairy & eggs');
  assert.equal(section('bread'), 'Bakery');
  assert.equal(section('rice'), 'Pantry');
  assert.equal(section('salmon'), 'Meat & fish');
  assert.equal(section('onion'), 'Produce');
  assert.equal(section('parsley'), 'Produce');
  assert.equal(section('cumin'), 'Spices');
  for (const f of FOODS) assert.ok(STORE_SECTIONS.includes(f.section), f.names[0]);
});

test('amount formatting', () => {
  assert.equal(formatAmount(5), '5');
  assert.equal(formatAmount(1.5), '1½');
  assert.equal(formatAmount(0.25), '¼');
  assert.equal(formatAmount(2 / 3), '⅔');
  assert.equal(formatAmount(2.4), '2.4');
});

test('shopping names drop prep words and notes', () => {
  assert.equal(shoppingName('6 cloves garlic, minced'.replace(/^\S+ \S+ /, '')), 'garlic');
  assert.equal(shoppingName('chopped parsley (1 bunch)'), 'parsley');
  assert.equal(shoppingName('Green onions to garnish'), 'green onions');
  assert.equal(shoppingName('Fresh'), 'fresh');
});

test('adds up the same ingredient across recipes and skips pantry and staples', () => {
  const items = buildShoppingList(
    [
      recipe('Omelette', '3 eggs\n1 tbsp butter\nSalt and pepper\n1 cup milk'),
      recipe('Pancakes', '2 eggs\n1 cup flour\n2 tbsp milk\n1 tbsp olive oil\n1 onion'),
      recipe(
        'Soup',
        '2 onions, chopped\n2 cloves garlic\n1 clove garlic\n200 g lamb\n1 lb lamb\nfresh herbs',
      ),
    ],
    ['butter', 'Flour'],
  );
  const m = byName(items);
  assert.deepEqual(Object.keys(m).sort(), ['eggs', 'garlic', 'herbs', 'lamb', 'milk', 'onions']);
  assert.equal(m.eggs.quantity, '5');
  assert.deepEqual(m.eggs.recipes, ['Omelette', 'Pancakes']);
  assert.equal(m.eggs.section, 'Dairy & eggs');
  assert.equal(m.onions.quantity, '3');
  assert.equal(m.onions.section, 'Produce');
  assert.equal(m.garlic.quantity, '3 cloves');
  assert.equal(m.lamb.quantity, '654 g'); // 200 g + 1 lb, mixed units -> grams
  assert.equal(m.milk.quantity, '266 ml'); // 1 cup + 2 tbsp
  assert.equal(m.herbs.quantity, undefined);
  assert.equal(m.herbs.section, 'Other');
});

test('same unit stays in that unit; different kinds of amount are listed together', () => {
  const m = byName(
    buildShoppingList(
      [
        recipe('A', '1 cup rice\n1 can chickpeas\n200 g chickpeas'),
        recipe('B', '½ cup rice\n2 cans chickpeas'),
      ],
      [],
    ),
  );
  assert.equal(m.rice.quantity, '1½ cups');
  assert.equal(m.chickpeas.quantity, '3 cans + 200 g');
});

test('nothing to buy when the pantry has it all', () => {
  assert.deepEqual(
    buildShoppingList([recipe('Toast', '2 slices bread\nbutter')], ['bread', 'butter']),
    [],
  );
});

test('text version is grouped by section in store order', () => {
  const text = shoppingListText(
    [
      { name: 'eggs', quantity: '5', section: 'Dairy & eggs' },
      { name: 'onions', quantity: '3', section: 'Produce' },
      { name: 'fresh herbs', section: 'Other' },
    ],
    STORE_SECTIONS,
  );
  assert.equal(text, 'Produce\n- 3 onions\n\nDairy & eggs\n- 5 eggs\n\nOther\n- fresh herbs');
});
