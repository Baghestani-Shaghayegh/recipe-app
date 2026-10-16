import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type AiRecipe,
  draftAsText,
  draftFromAi,
  needsTranslation,
  readWithAi,
  smartDraftFromText,
} from '../src/lib/ai-recipe.ts';
import { servingNutrition } from '../src/lib/nutrition.ts';

const CONFIG = { url: 'https://abc.supabase.co', key: 'sb_publishable_test' };

// A Persian Instagram caption, and what the parse-recipe function sends back for it.
const CAPTION = `املت گوجه فرنگی 🍅
مواد لازم:
تخم مرغ ۳ عدد
گوجه فرنگی ۲ عدد
کره ۱ قاشق غذاخوری
نمک و فلفل
طرز تهیه: گوجه ها را خرد کنید و با کره تفت دهید. تخم مرغ ها را اضافه کنید و هم بزنید.
#املت #صبحانه`;

const ANSWER: AiRecipe = {
  isRecipe: true,
  language: 'Persian',
  title: 'Tomato Omelette (Omlet)',
  servings: 2,
  prepMinutes: 5,
  cookMinutes: 10,
  category: 'Breakfast',
  ingredients: ['3 eggs', '2 tomatoes, chopped', '1 tbsp butter', 'salt', 'pepper'],
  steps: ['Chop the tomatoes and fry them in the butter.', 'Add the eggs and stir until set.'],
  notes: '',
};

const fakeFetch = (status: number, body: unknown, seen: Request[] = []) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(new Request(input, init));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;

test('a translated answer becomes an English recipe with nutrition', () => {
  const draft = draftFromAi(ANSWER, { author: 'chef.maryam', sourceUrl: 'https://ig/p/1' });
  assert.ok(draft);
  assert.equal(draft.title, 'Tomato Omelette (Omlet)');
  assert.equal(draft.category, 'Breakfast');
  assert.deepEqual([draft.servings, draft.prepMinutes, draft.cookMinutes], [2, 5, 10]);
  assert.deepEqual(
    draft.ingredients.map((i) => [i.amount, i.unit, i.name]),
    [
      [3, undefined, 'eggs'],
      [2, undefined, 'tomatoes, chopped'],
      [1, 'tbsp', 'butter'],
      [undefined, undefined, 'salt'],
      [undefined, undefined, 'pepper'],
    ],
  );
  assert.equal(draft.steps.length, 2);
  assert.equal(draft.notes, 'From @chef.maryam on Instagram.\n\nTranslated from Persian.');
  assert.equal(draft.sourceUrl, 'https://ig/p/1');
  // English ingredient names are what the nutrition table understands.
  const nutrition = servingNutrition({ ...draft, id: 'x', createdAt: 0, updatedAt: 0 });
  assert.ok(nutrition && nutrition.values.kcal > 50, 'expected a calorie estimate');
});

test('zero times and an unknown category are left empty', () => {
  const draft = draftFromAi({ ...ANSWER, servings: 0, prepMinutes: 0, category: 'Unknown' });
  assert.equal(draft?.servings, undefined);
  assert.equal(draft?.prepMinutes, undefined);
  assert.equal(draft?.category, undefined);
});

test('text that isn’t a recipe gives no draft', () => {
  assert.equal(draftFromAi({ ...ANSWER, isRecipe: false }), undefined);
  assert.equal(draftFromAi({ ...ANSWER, ingredients: [], steps: [] }), undefined);
});

test('calls the parse-recipe function with the publishable key', async () => {
  const seen: Request[] = [];
  const answer = await readWithAi(CAPTION, CONFIG, fakeFetch(200, { recipe: ANSWER }, seen));
  assert.equal(answer.title, 'Tomato Omelette (Omlet)');
  const [req] = seen;
  assert.equal(req.url, 'https://abc.supabase.co/functions/v1/parse-recipe');
  assert.equal(req.method, 'POST');
  assert.equal(req.headers.get('apikey'), CONFIG.key);
  assert.equal(req.headers.get('authorization'), `Bearer ${CONFIG.key}`);
  assert.deepEqual(await req.json(), { text: CAPTION });
});

test('uses the smart reader when it works', async () => {
  const draft = await smartDraftFromText(CAPTION, {}, CONFIG, fakeFetch(200, { recipe: ANSWER }));
  assert.equal(draft.title, 'Tomato Omelette (Omlet)');
  assert.equal(draft.ingredients.length, 5);
});

test('falls back to the app’s own reader when the smart reader can’t help', async () => {
  const english = 'Toast\n\nIngredients:\n1 slice bread\n\nMethod:\n1. Toast it.';
  const cases: [string, typeof fetch | undefined, typeof CONFIG | undefined][] = [
    ['not set up', undefined, undefined],
    ['server error', fakeFetch(503, { error: 'not set up' }), CONFIG],
    [
      'offline',
      (async () => Promise.reject(new TypeError('Network request failed'))) as typeof fetch,
      CONFIG,
    ],
    ['no recipe found', fakeFetch(200, { recipe: { ...ANSWER, isRecipe: false } }), CONFIG],
  ];
  for (const [why, fetchImpl, config] of cases) {
    const draft = await smartDraftFromText(english, {}, config, fetchImpl);
    assert.equal(draft.title, 'Toast', why);
    assert.deepEqual(draft.steps, ['Toast it.'], why);
  }
});

test('spots text that needs translating', () => {
  assert.equal(needsTranslation(CAPTION), true);
  assert.equal(needsTranslation('Борщ'), true);
  assert.equal(needsTranslation('Crème brûlée with ½ cup sugar'), false);
});

test('writes a site recipe out as text for translating', () => {
  const draft = draftFromAi(ANSWER)!;
  assert.equal(
    draftAsText(draft),
    [
      'Tomato Omelette (Omlet)',
      'Serves 2',
      'Ingredients:',
      '3 eggs',
      '2 tomatoes, chopped',
      '1 tbsp butter',
      'salt',
      'pepper',
      'Method:',
      '1. Chop the tomatoes and fry them in the butter.',
      '2. Add the eggs and stir until set.',
      'Translated from Persian.',
    ].join('\n'),
  );
});
