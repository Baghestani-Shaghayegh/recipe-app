import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extractRecipeFromHtml,
  fetchWebsiteRecipe,
  parseIsoDuration,
  parseWebUrl,
  type WebsiteError,
} from '../src/lib/website.ts';

const page = (json: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;

const recipeNode = {
  '@type': 'Recipe',
  name: 'Lentil &amp; Rice Soup',
  image: ['https://example.com/soup.jpg'],
  recipeYield: ['4', '4 servings'],
  prepTime: 'PT15M',
  cookTime: 'PT1H',
  keywords: 'Vegetarian, Soup',
  recipeCategory: 'Dinner',
  description: 'Warming <b>soup</b>.',
  recipeIngredient: ['1 cup red lentils', '2 tbsp olive oil', '1 onion, diced'],
  recipeInstructions: [
    { '@type': 'HowToStep', text: 'Saute the onion.' },
    {
      '@type': 'HowToSection',
      name: 'Simmer',
      itemListElement: [{ '@type': 'HowToStep', text: 'Add lentils and water.' }],
    },
    'Serve hot.',
  ],
};

test('parseWebUrl finds a link in shared text', () => {
  assert.equal(parseWebUrl('Try this https://example.com/soup, yum'), 'https://example.com/soup');
  assert.equal(parseWebUrl('no link here'), undefined);
});

test('parseIsoDuration', () => {
  assert.equal(parseIsoDuration('PT1H30M'), 90);
  assert.equal(parseIsoDuration('PT45M'), 45);
  assert.equal(parseIsoDuration('P0DT20M'), 20);
  assert.equal(parseIsoDuration('PT0S'), undefined);
  assert.equal(parseIsoDuration('soon'), undefined);
});

test('reads a recipe from JSON-LD', () => {
  const r = extractRecipeFromHtml(page(recipeNode), 'https://example.com/soup')!;
  assert.equal(r.title, 'Lentil & Rice Soup');
  assert.equal(r.servings, 4);
  assert.equal(r.prepMinutes, 15);
  assert.equal(r.cookMinutes, 60);
  assert.equal(r.category, 'Dinner');
  assert.deepEqual(r.tags, ['vegetarian', 'soup']);
  assert.deepEqual(
    r.ingredients.map((i) => [i.amount, i.unit, i.name]),
    [
      [1, 'cup', 'red lentils'],
      [2, 'tbsp', 'olive oil'],
      [1, undefined, 'onion, diced'],
    ],
  );
  assert.deepEqual(r.steps, ['Saute the onion.', 'Add lentils and water.', 'Serve hot.']);
  assert.equal(r.notes, 'Warming soup.');
  assert.equal(r.imageUrl, 'https://example.com/soup.jpg');
  assert.equal(r.sourceUrl, 'https://example.com/soup');
});

test('finds the recipe inside @graph and arrays', () => {
  const graph = page({ '@graph': [{ '@type': 'WebSite' }, recipeNode] });
  assert.equal(extractRecipeFromHtml(graph, 'u')?.title, 'Lentil & Rice Soup');
  assert.equal(extractRecipeFromHtml(page([recipeNode]), 'u')?.steps.length, 3);
});

test('total time only becomes the cook time', () => {
  const node = { ...recipeNode, prepTime: undefined, cookTime: undefined, totalTime: 'PT40M' };
  const r = extractRecipeFromHtml(page(node), 'u')!;
  assert.equal(r.prepMinutes, undefined);
  assert.equal(r.cookMinutes, 40);
});

test('pages without a usable recipe return undefined', () => {
  assert.equal(extractRecipeFromHtml('<html></html>', 'u'), undefined);
  assert.equal(extractRecipeFromHtml(page({ '@type': 'Article' }), 'u'), undefined);
  const broken = '<script type="application/ld+json">{bad</script>';
  assert.equal(extractRecipeFromHtml(broken, 'u'), undefined);
});

test('fetchWebsiteRecipe reports what went wrong', async () => {
  const ok = (async () => new Response(page(recipeNode))) as typeof fetch;
  assert.equal((await fetchWebsiteRecipe('https://example.com/a', ok)).title, 'Lentil & Rice Soup');

  const reason = (r: string) => (e: WebsiteError) => e.reason === r;
  const empty = (async () => new Response('<html></html>')) as typeof fetch;
  await assert.rejects(fetchWebsiteRecipe('https://example.com/a', empty), reason('no-recipe'));
  const down = (async () => new Response('nope', { status: 500 })) as typeof fetch;
  await assert.rejects(fetchWebsiteRecipe('https://example.com/a', down), reason('network'));
  await assert.rejects(fetchWebsiteRecipe('not a link'), reason('not-a-link'));
});
