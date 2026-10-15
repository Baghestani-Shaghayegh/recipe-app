import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanOcrText } from '../src/lib/ocr.ts';
import { parseRecipeText } from '../src/lib/recipe-text.ts';

test('joins sentences wrapped across lines, keeps list lines apart', () => {
  const text = cleanOcrText([
    "Grandma's Apple Cake",
    'Serves 8',
    'Ingredients',
    '2 cups flour',
    '1 cup sugar',
    'salt',
    '3 apples, peeled and sliced',
    'Method',
    '1. Heat the oven to 180°C and grease a round',
    'tin with butter.',
    '2. Mix the flour and sugar, then fold in the toma-',
    'toes... I mean apples.',
    '12',
  ]);
  assert.equal(
    text,
    [
      "Grandma's Apple Cake",
      'Serves 8',
      'Ingredients',
      '2 cups flour',
      '1 cup sugar',
      'salt',
      '3 apples, peeled and sliced',
      'Method',
      '1. Heat the oven to 180°C and grease a round tin with butter.',
      '2. Mix the flour and sugar, then fold in the tomatoes... I mean apples.',
    ].join('\n'),
  );
});

test('blocks with several lines (Android) and print punctuation', () => {
  assert.equal(
    cleanOcrText(['Ingredients\n2 eggs', '“Best” cake — easy']),
    'Ingredients\n2 eggs\n"Best" cake - easy',
  );
});

test('a cleaned photo reads as a recipe', () => {
  const r = parseRecipeText(
    cleanOcrText([
      'Banana Bread',
      'Ingredients:',
      '3 ripe bananas',
      '2 cups flour',
      'Method:',
      '1. Mash the bananas and mix everything together',
      'until just combined.',
      '2. Bake 1 hour.',
    ]),
  );
  assert.equal(r.title, 'Banana Bread');
  assert.deepEqual(r.ingredients, ['3 ripe bananas', '2 cups flour']);
  assert.deepEqual(r.steps, [
    'Mash the bananas and mix everything together until just combined.',
    'Bake 1 hour.',
  ]);
  assert.equal(r.category, 'Baking');
});

test('empty photo gives empty text', () => {
  assert.equal(cleanOcrText([]), '');
  assert.equal(cleanOcrText(['  ', '•']), '');
});
