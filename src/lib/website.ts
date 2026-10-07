import { parseIngredientList } from './ingredients';
import { decodeEntities } from './instagram';
import { CATEGORIES, type Category, type Recipe } from './recipe';

/** Finds an http(s) link anywhere in the text (shared text often has extra words). */
export function parseWebUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!m) return undefined;
  try {
    return new URL(m[0].replace(/[.,;)\]]+$/, '')).toString();
  } catch {
    return undefined;
  }
}

/** "PT1H30M" -> 90, "P0DT45M" -> 45. Undefined if it isn't an ISO 8601 duration or is zero. */
export function parseIsoDuration(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.trim().match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/i);
  if (!m) return undefined;
  const minutes = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return minutes > 0 ? minutes : undefined;
}

type Json = unknown;
type JsonObject = Record<string, Json>;

const asArray = (v: Json): Json[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
const isObject = (v: Json): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Plain text from a JSON value that may contain HTML tags and entities. */
function clean(value: Json): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = decodeEntities(String(value).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
  return text || undefined;
}

function hasType(node: JsonObject, type: string): boolean {
  return asArray(node['@type']).some((t) => typeof t === 'string' && t.toLowerCase() === type);
}

/** Looks through <script type="application/ld+json"> blocks (including @graph and arrays) for a Recipe. */
export function findRecipeNode(html: string): JsonObject | undefined {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const s of scripts) {
    let data: Json;
    try {
      data = JSON.parse(s[1].trim());
    } catch {
      continue;
    }
    const queue: Json[] = [data];
    while (queue.length) {
      const node = queue.shift();
      if (Array.isArray(node)) queue.push(...node);
      else if (isObject(node)) {
        if (hasType(node, 'recipe')) return node;
        queue.push(...asArray(node['@graph']));
      }
    }
  }
  return undefined;
}

function instructionSteps(value: Json): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map(clean)
      .filter((s): s is string => !!s);
  }
  const steps: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string') {
      const t = clean(item);
      if (t) steps.push(t);
    } else if (isObject(item)) {
      if (item.itemListElement !== undefined) steps.push(...instructionSteps(item.itemListElement));
      else {
        const t = clean(item.text ?? item.name);
        if (t) steps.push(t);
      }
    }
  }
  return steps;
}

/** "4 servings", ["6", "6 servings"], 4 -> the first number found. */
function servingsFrom(value: Json): number | undefined {
  for (const v of asArray(value)) {
    const m = String(v).match(/\d+/);
    if (m && Number(m[0]) > 0) return Number(m[0]);
  }
  return undefined;
}

function imageFrom(value: Json): string | undefined {
  for (const v of asArray(value)) {
    if (typeof v === 'string' && /^https?:/i.test(v)) return v;
    if (isObject(v) && typeof v.url === 'string' && /^https?:/i.test(v.url)) return v.url;
  }
  return undefined;
}

function listFrom(value: Json): string[] {
  return asArray(value)
    .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const CATEGORY_RULES: [RegExp, Category][] = [
  [/breakfast|brunch/, 'Breakfast'],
  [/dessert|cake|cookie|sweet/, 'Dessert'],
  [/drink|beverage|cocktail|smoothie/, 'Drinks'],
  [/snack|appetizer|starter/, 'Snack'],
  [/lunch/, 'Lunch'],
  [/dinner|main/, 'Dinner'],
];

function categoryFrom(node: JsonObject): Category | undefined {
  const words = [...listFrom(node.recipeCategory), ...listFrom(node.keywords)].join(' ');
  const found = CATEGORY_RULES.find(([re]) => re.test(words))?.[1];
  return found && CATEGORIES.includes(found) ? found : undefined;
}

export type WebsiteRecipe = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & { imageUrl?: string };

/** Turns a page's schema.org Recipe data into a recipe draft, or undefined if the page has none. */
export function extractRecipeFromHtml(html: string, url: string): WebsiteRecipe | undefined {
  const node = findRecipeNode(html);
  if (!node) return undefined;
  const title = clean(node.name);
  const ingredients = parseIngredientList(
    asArray(node.recipeIngredient ?? node.ingredients)
      .map(clean)
      .filter((s): s is string => !!s)
      .join('\n'),
  );
  const steps = instructionSteps(node.recipeInstructions);
  if (!title || (!ingredients.length && !steps.length)) return undefined;

  const prep = parseIsoDuration(node.prepTime);
  const cook = parseIsoDuration(node.cookTime);
  const total = parseIsoDuration(node.totalTime);
  // Some sites only give a total time; keep what's left after prep as the cook time.
  const cookMinutes =
    cook ?? (total !== undefined && total > (prep ?? 0) ? total - (prep ?? 0) : undefined);

  return {
    title,
    category: categoryFrom(node),
    tags: [...new Set(listFrom(node.keywords))].slice(0, 6),
    servings: servingsFrom(node.recipeYield),
    prepMinutes: prep,
    cookMinutes,
    ingredients,
    steps,
    notes: clean(node.description),
    sourceUrl: url,
    imageUrl: imageFrom(node.image),
  };
}

export class WebsiteError extends Error {
  readonly reason: 'not-a-link' | 'network' | 'no-recipe';

  constructor(message: string, reason: WebsiteError['reason']) {
    super(message);
    this.reason = reason;
  }
}

/** Loads a recipe page and reads its recipe data. Works in the phone app; browsers block this (CORS). */
export async function fetchWebsiteRecipe(
  link: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WebsiteRecipe> {
  const url = parseWebUrl(link);
  if (!url) throw new WebsiteError('That doesn’t look like a web link.', 'not-a-link');
  let html: string;
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'text/html' } });
    if (!res.ok) throw new Error(String(res.status));
    html = await res.text();
  } catch {
    throw new WebsiteError(
      'Couldn’t open that page. Check the link and your connection.',
      'network',
    );
  }
  const recipe = extractRecipeFromHtml(html, url);
  if (!recipe) throw new WebsiteError('Couldn’t find a recipe on that page.', 'no-recipe');
  return recipe;
}
