import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOODS, STORE_SECTIONS } from '../src/lib/foods.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import type { Recipe } from '../src/lib/recipe.ts';
import {
  buildShoppingList,
  formatAmount,
  mealsShopping,
  shoppingKey,
  shoppingParts,
  shoppingRecipes,
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
  assert.equal(m.herbs.section, 'Produce');
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
  assert.equal(text, 'Fruit & veg\n- 3 onions\n\nDairy & eggs\n- 5 eggs\n\nOther\n- fresh herbs');
});

test('planned meals: a recipe planned twice counts twice, pantry items are listed apart', () => {
  const omelette = recipe('Omelette', '3 eggs\n1 tbsp butter\n1 bunch fresh herbs\nsalt');
  const soup = recipe('Soup', '1 cup red lentils\n2 tomatoes\n1 onion');
  const { items, have } = mealsShopping([omelette, soup, omelette], ['butter', 'onions']);
  const list = byName(items);
  assert.equal(list['eggs'].quantity, '6');
  assert.equal(list['herbs'].quantity, '2 bunches');
  assert.deepEqual(list['eggs'].recipes, ['Omelette']);
  assert.equal(list['butter'], undefined);
  assert.deepEqual(have, ['butter', 'onion']);
});

test('the list has each ingredient once, amounts added up, and nothing from the pantry', () => {
  const omelette = recipe('Omelette', '3 eggs\n1 tbsp butter\n2 ripe tomatoes, chopped');
  const soup = recipe('Soup', '2 tomatoes\n1 onion\n1 egg');
  const byId = new Map([omelette, soup].map((r) => [r.id, r]));
  const planned = [
    { day: '2026-10-21', recipeId: 'Soup', skip: [] },
    { day: '2026-10-19', recipeId: 'Omelette', skip: [] }, // yesterday: left out
  ];
  const list = byName(
    buildShoppingList(shoppingRecipes(['Omelette', 'Soup'], planned, byId, '2026-10-20'), [
      'onion',
    ]),
  );
  assert.equal(list['eggs'].quantity, '4');
  assert.equal(list['tomatoes'].quantity, '4');
  assert.equal(list['onion'], undefined);
  assert.deepEqual(Object.keys(list).sort(), ['butter', 'eggs', 'tomatoes']);
});

test('shoppingRecipes: planned twice counts twice, unticked ingredients stay off', () => {
  const soup = recipe('Soup', '1 cup red lentils\n1 tbsp cumin');
  const byId = new Map([[soup.id, soup]]);
  const planned = [
    { day: '2026-10-21', recipeId: 'Soup', skip: [shoppingKey('cumin')] },
    { day: '2026-10-22', recipeId: 'Soup', skip: [] },
    { day: '2026-10-22', recipeId: 'deleted', skip: [] },
  ];
  // Soup is on Make next too, but it's already there from the plan.
  const list = byName(
    buildShoppingList(shoppingRecipes(['Soup'], planned, byId, '2026-10-20'), []),
  );
  assert.equal(list['red lentils'].quantity, '2 cups');
  assert.equal(list['cumin'].quantity, '1 tbsp');
  assert.equal(shoppingKey('2 Ripe Tomatoes, chopped'), shoppingKey('tomato'));
});

test('shopping names say what to buy, without amounts written any way', () => {
  for (const line of [
    'spring onions x 3',
    '3 x spring onions',
    '2-3 spring onions',
    'Spring onions: 3',
    'three spring onions',
    '3 stalks spring onions',
    'a handful of spring onions',
  ]) {
    assert.equal(shoppingName(line), 'spring onions', line);
  }
  assert.equal(shoppingName('2 cloves garlic'), 'garlic');
});

test('an ingredient with "and" is two things to buy, unless it is one dish', () => {
  assert.deepEqual(shoppingParts('chopped parsley and chives'), ['parsley', 'chives']);
  assert.deepEqual(shoppingParts('salt & pepper'), ['salt', 'pepper']);
  assert.deepEqual(shoppingParts('sweet and sour sauce'), ['sweet and sour sauce']);
  assert.deepEqual(shoppingParts('red lentils'), ['red lentils']);
  const herbs = recipe('Omelette', '2 tbsp chopped parsley and chives\nsalt and pepper');
  assert.deepEqual(
    buildShoppingList([herbs], ['chives']).map((i) => i.name),
    ['parsley'],
  );
});

test('foods the table does not know still land in a sensible section', () => {
  const r = recipe(
    'Mix',
    '1 l vegetable stock\n500 g lamb mince\n2 salmon fillets\n4 tortillas\n100 g halloumi\n1 bag rocket\n1 tsp sumac\n1 jar mystery thing',
  );
  assert.deepEqual(
    buildShoppingList([r], []).map((i) => [i.name, i.section]),
    [
      ['vegetable stock', 'Pantry'],
      ['lamb mince', 'Meat & fish'],
      ['salmon fillets', 'Meat & fish'],
      ['tortillas', 'Bakery'],
      ['halloumi', 'Dairy & eggs'],
      ['rocket', 'Produce'],
      ['sumac', 'Spices'],
      ['mystery thing', 'Other'],
    ],
  );
});
