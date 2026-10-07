import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitsDiet, ingredientTraits } from '../src/lib/diet.ts';
import { parseIngredientList } from '../src/lib/ingredients.ts';
import { filterRecipes, type Recipe } from '../src/lib/recipe.ts';

const recipe = (ingredients: string, over: Partial<Recipe> = {}): Recipe => ({
  id: ingredients,
  title: 'R',
  tags: [],
  ingredients: parseIngredientList(ingredients),
  steps: [],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const traits = (s: string) => [...ingredientTraits(s)].sort();

test('detects what ingredients contain', () => {
  assert.deepEqual(traits('chicken breast'), ['meat']);
  assert.deepEqual(traits('fish sauce'), ['fish']);
  assert.deepEqual(traits('2 tbsp butter'), ['dairy']);
  assert.deepEqual(traits('plain flour'), ['gluten']);
  assert.deepEqual(traits('chopped walnuts'), ['nuts']);
  assert.deepEqual(traits('3 eggs'), ['egg']);
  assert.deepEqual(traits('honey'), ['honey']);
  assert.deepEqual(traits('soy sauce'), ['gluten']);
});

test('look-alikes are not flagged', () => {
  for (const s of [
    'coconut milk',
    'almond milk',
    'oat milk',
    'cream of tartar',
    'eggplant',
    'nutmeg',
    'butternut squash',
    'rice flour',
    'almond flour',
    'buckwheat',
    'rice noodles',
    'gluten-free pasta',
    'tamari',
    'cocoa butter',
    'coconut',
  ]) {
    const t = traits(s);
    assert.ok(!t.includes('dairy') || s === 'x', s);
  }
  assert.deepEqual(traits('coconut milk'), []);
  assert.deepEqual(traits('eggplant'), []);
  assert.deepEqual(traits('nutmeg'), []);
  assert.deepEqual(traits('rice flour'), []);
  assert.deepEqual(traits('gluten-free pasta'), []);
  assert.deepEqual(traits('rice noodles'), []);
  assert.deepEqual(traits('butternut squash'), []);
  assert.deepEqual(traits('almond flour'), ['nuts']);
  assert.deepEqual(traits('peanut butter'), ['nuts']);
});

test('diets', () => {
  const soup = recipe('1 cup red lentils\n1 onion\n2 cloves garlic\n1 tsp cumin');
  assert.ok(
    fitsDiet(soup, 'vegan') && fitsDiet(soup, 'vegetarian') && fitsDiet(soup, 'gluten-free'),
  );
  const omelette = recipe('3 eggs\n1 tbsp butter');
  assert.ok(fitsDiet(omelette, 'vegetarian'));
  assert.ok(!fitsDiet(omelette, 'vegan') && !fitsDiet(omelette, 'dairy-free'));
  const pasta = recipe('200 g spaghetti\n100 g bacon\n50 g parmesan');
  assert.ok(!fitsDiet(pasta, 'vegetarian') && !fitsDiet(pasta, 'gluten-free'));
  assert.ok(fitsDiet(pasta, 'nut-free'));
});

test('tags win, empty ingredient lists never match, protein uses nutrition', () => {
  assert.ok(fitsDiet(recipe('chicken', { tags: ['vegan'] }), 'vegan'));
  assert.ok(!fitsDiet(recipe(''), 'vegan'));
  const manual = { kcal: 500, protein: 30, carbs: 10, fat: 10 };
  assert.ok(fitsDiet(recipe('x', { nutrition: manual }), 'high-protein'));
  assert.ok(!fitsDiet(recipe('x', { nutrition: { ...manual, protein: 10 } }), 'high-protein'));
});

test('filterRecipes needs every selected diet', () => {
  const a = recipe('1 cup lentils');
  const b = recipe('3 eggs');
  assert.deepEqual(filterRecipes([a, b], { query: '', tags: [], diets: ['vegan'] }), [a]);
  assert.equal(filterRecipes([a, b], { query: '', tags: [], diets: ['vegetarian'] }).length, 2);
  assert.equal(filterRecipes([a, b], { query: '', tags: [] }).length, 2);
});
