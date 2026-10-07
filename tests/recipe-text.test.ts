import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseRecipeText, recipeDraftFromText } from '../src/lib/recipe-text.ts';

test('caption with headings, emojis, hashtags and promo lines', () => {
  const caption = `EASY 15-MINUTE GARLIC NOODLES 🍜🔥
Save this for later! 📌

Serves 2 | Prep 5 min | Cook 10 min

Ingredients:
🍜 200 g spaghetti
🧈 2 tbsp butter
🧄 6 cloves garlic, minced
• 2 tbsp soy sauce
• 1 tbsp brown sugar
- Green onions to garnish

Method:
1. Cook the noodles according to the packet.
2) Melt butter in a pan and fry the garlic for 1 minute.
3️⃣ Add soy sauce and sugar, then toss in the noodles.

Follow @someone for more easy recipes!
#garlicnoodles #noodles #easyrecipes #dinner #reels`;

  const r = parseRecipeText(caption);
  assert.equal(r.title, 'Easy 15-Minute Garlic Noodles');
  assert.deepEqual(r.ingredients, [
    '200 g spaghetti',
    '2 tbsp butter',
    '6 cloves garlic, minced',
    '2 tbsp soy sauce',
    '1 tbsp brown sugar',
    'Green onions to garnish',
  ]);
  assert.deepEqual(r.steps, [
    'Cook the noodles according to the packet.',
    'Melt butter in a pan and fry the garlic for 1 minute.',
    'Add soy sauce and sugar, then toss in the noodles.',
  ]);
  assert.equal(r.servings, 2);
  assert.equal(r.prepMinutes, 5);
  assert.equal(r.cookMinutes, 10);
  assert.deepEqual(r.tags, ['garlicnoodles', 'noodles', 'dinner']);
  assert.equal(r.category, 'Dinner');
});

test('no headings: amounts become ingredients, numbered lines become steps', () => {
  const r = parseRecipeText(`Banana oat pancakes
1 banana
1/2 cup oats
2 eggs
Pinch of cinnamon
1. Blend everything.
2. Cook small pancakes in a hot pan, 2 minutes per side.`);
  assert.equal(r.title, 'Banana oat pancakes');
  assert.deepEqual(r.ingredients, ['1 banana', '1/2 cup oats', '2 eggs', 'Pinch of cinnamon']);
  assert.equal(r.steps.length, 2);
  assert.equal(r.category, 'Breakfast');
});

test('sub-headings are skipped and a step paragraph is split into sentences', () => {
  const r = parseRecipeText(`Chicken bowls
Ingredients
For the chicken:
500 g chicken thighs
1 tsp paprika
For the sauce:
½ cup greek yogurt
1 lemon
How to make it
Season the chicken with paprika and salt, then grill it for 6 minutes on each side until cooked through. Mix the yogurt with lemon juice. Serve over rice with the sauce on top.`);
  assert.deepEqual(r.ingredients, [
    '500 g chicken thighs',
    '1 tsp paprika',
    '½ cup greek yogurt',
    '1 lemon',
  ]);
  assert.deepEqual(r.steps, [
    'Season the chicken with paprika and salt, then grill it for 6 minutes on each side until cooked through.',
    'Mix the yogurt with lemon juice.',
    'Serve over rice with the sauce on top.',
  ]);
});

test('ingredients on one line after the heading', () => {
  const r = parseRecipeText('Ingredients: 2 eggs, 1 cup milk, 1 cup flour\nSteps:\nWhisk and fry.');
  assert.deepEqual(r.ingredients, ['2 eggs', '1 cup milk', '1 cup flour']);
  assert.deepEqual(r.steps, ['Whisk and fry.']);
});

test('total time and servings phrasing', () => {
  const r = parseRecipeText(
    'Lemon cake\nMakes 8 slices. Ready in 1 hour.\nIngredients\n2 cups flour',
  );
  assert.equal(r.servings, 8);
  assert.equal(r.cookMinutes, 60);
  assert.equal(r.prepMinutes, undefined);
  assert.equal(r.category, 'Dessert');
});

test('time only in the title', () => {
  assert.equal(parseRecipeText('10 minute pasta\nIngredients\n100 g pasta').cookMinutes, 10);
});

test('empty or junk text gives an empty draft, not a crash', () => {
  const r = parseRecipeText('🔥🔥🔥\n#food #yum');
  assert.deepEqual(r, {
    title: undefined,
    ingredients: [],
    steps: [],
    notes: undefined,
    sourceUrl: undefined,
    servings: undefined,
    prepMinutes: undefined,
    cookMinutes: undefined,
    tags: [],
    category: undefined,
  });
});

test('draft from text keeps the source, credits the author, and saves text it could not sort', () => {
  const full = recipeDraftFromText('Toast\nIngredients\n2 slices bread\nMethod\nToast it.', {
    sourceUrl: 'https://www.instagram.com/p/A/',
    author: 'chef_sara',
  });
  assert.equal(full.title, 'Toast');
  assert.equal(full.ingredients[0].name, 'bread');
  assert.equal(full.ingredients[0].unit, 'slice');
  assert.deepEqual(full.steps, ['Toast it.']);
  assert.equal(full.notes, 'From @chef_sara on Instagram.');
  assert.equal(full.sourceUrl, 'https://www.instagram.com/p/A/');

  const vague = recipeDraftFromText('just mix stuff and bake it', { author: 'chef_sara' });
  assert.equal(vague.title, 'just mix stuff and bake it');
  assert.match(vague.notes ?? '', /Original text:\njust mix stuff and bake it/);

  assert.equal(recipeDraftFromText('🔥', { author: 'chef_sara' }).title, 'Recipe from @chef_sara');
  assert.equal(recipeDraftFromText('').title, 'Imported recipe');
});

test('Notes and Source lines are kept apart from the steps', () => {
  const r = parseRecipeText(
    'Soup\n\nIngredients:\n- 1 onion\n\nMethod:\n1. Fry it.\n2. Eat.\n\nNotes: Freezes well.\nServe hot.\n\n#meal-prep\n\nSource: https://example.com/soup',
  );
  assert.deepEqual(r.steps, ['Fry it.', 'Eat.']);
  assert.equal(r.notes, 'Freezes well.\nServe hot.');
  assert.equal(r.sourceUrl, 'https://example.com/soup');
  assert.deepEqual(r.tags, ['meal-prep']);
});
