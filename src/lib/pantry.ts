import type { Ingredient } from './ingredients';
import type { Recipe } from './recipe';

// Words that describe how an ingredient is prepared, not what it is.
export const DESCRIPTORS = new Set([
  'fresh',
  'freshly',
  'chopped',
  'finely',
  'roughly',
  'diced',
  'minced',
  'sliced',
  'thinly',
  'grated',
  'shredded',
  'crushed',
  'ground',
  'dried',
  'large',
  'small',
  'medium',
  'ripe',
  'whole',
  'peeled',
  'softened',
  'melted',
  'cooked',
  'raw',
  'boneless',
  'skinless',
  'organic',
  'optional',
  'about',
  'a',
  'an',
  'some',
  'few',
  'handful',
  'of',
]);

// Things almost everyone has, so they never count as "missing".
const STAPLE_CORE = new Set(['salt', 'pepper', 'water', 'oil', 'ice']);
const STAPLE_EXTRA = new Set([
  'black',
  'sea',
  'kosher',
  'olive',
  'vegetable',
  'cooking',
  'neutral',
  'spray',
  'and',
  'or',
  'to',
  'taste',
  'for',
  'frying',
  'serving',
  'cold',
  'warm',
  'hot',
  'boiling',
]);

const SAME_PLURAL = new Set(['molasses', 'swiss', 'chips', 'grits', 'oats']);

function singular(word: string): string {
  if (SAME_PLURAL.has(word)) return word;
  if (word.endsWith('sses')) return word.slice(0, -2);
  if (word.length <= 3 || /(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** "2 Ripe Tomatoes, chopped (about 300 g)" name part -> ["tomato"]. */
export function normalizeWords(name: string, { keepPlurals = false } = {}): string[] {
  const main = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0];
  return main
    .replace(/[^a-zÀ-ɏ\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !DESCRIPTORS.has(w))
    .map((w) => (keepPlurals ? w : singular(w)));
}

export function isStaple(name: string): boolean {
  // Plurals are kept so "peppers" (bell peppers) isn't mistaken for "pepper".
  const words = normalizeWords(name, { keepPlurals: true });
  return (
    words.some((w) => STAPLE_CORE.has(w)) &&
    words.every((w) => STAPLE_CORE.has(w) || STAPLE_EXTRA.has(w))
  );
}

/** True if all of `needle` appears in `hay` as whole words in the same order. */
export function containsPhrase(hay: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((w, j) => hay[i + j] === w)) return true;
  }
  return false;
}

/**
 * Pantry "egg" covers "3 eggs"; pantry "lentils" covers "red lentils";
 * pantry "cheddar cheese" covers "cheese".
 */
export function pantryHas(pantry: string[], ingredientName: string): boolean {
  const ing = normalizeWords(ingredientName);
  return pantry.some((item) => {
    const p = normalizeWords(item);
    return containsPhrase(ing, p) || containsPhrase(p, ing);
  });
}

export type RecipeMatch = {
  recipe: Recipe;
  have: Ingredient[];
  missing: Ingredient[];
};

export function matchRecipe(recipe: Recipe, pantry: string[]): RecipeMatch {
  const have: Ingredient[] = [];
  const missing: Ingredient[] = [];
  for (const ing of recipe.ingredients) {
    if (isStaple(ing.name)) continue;
    (pantryHas(pantry, ing.name) ? have : missing).push(ing);
  }
  return { recipe, have, missing };
}

export const MAX_MISSING_TO_SUGGEST = 2;

/**
 * Splits recipes into ones you can make now and ones missing only 1–2 things.
 * Recipes with no (non-staple) ingredients are skipped since there's nothing to match.
 */
export function recommend(
  recipes: Recipe[],
  pantry: string[],
): { ready: RecipeMatch[]; almost: RecipeMatch[] } {
  const matches = recipes
    .map((r) => matchRecipe(r, pantry))
    .filter((m) => m.have.length + m.missing.length > 0);
  const byBest = (a: RecipeMatch, b: RecipeMatch) =>
    a.missing.length - b.missing.length || b.have.length - a.have.length;
  return {
    ready: matches.filter((m) => m.missing.length === 0).sort(byBest),
    almost: matches
      .filter(
        (m) =>
          m.missing.length > 0 && m.missing.length <= MAX_MISSING_TO_SUGGEST && m.have.length > 0,
      )
      .sort(byBest),
  };
}

/** "Eggs, milk , eggs" -> ["eggs", "milk"], skipping ones already in the pantry. */
export function newPantryItems(pantry: string[], text: string): string[] {
  const seen = new Set(pantry.map((p) => normalizeWords(p).join(' ')));
  const added: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const item = raw.trim().toLowerCase();
    const key = normalizeWords(item).join(' ');
    if (!item || !key || seen.has(key)) continue;
    seen.add(key);
    added.push(item);
  }
  return added;
}
