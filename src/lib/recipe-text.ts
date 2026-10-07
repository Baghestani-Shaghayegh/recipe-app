import { parseIngredientLine, parseIngredientList } from './ingredients';
import type { Category, Recipe } from './recipe';

/** What we could read out of free text like an Instagram caption. Everything is optional. */
export type ParsedRecipeText = {
  title?: string;
  ingredients: string[];
  steps: string[];
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
  category?: Category;
};

const INGREDIENT_HEADER =
  /^(ingredients?|you(?:'|’)?ll need|you need|what you(?:'|’)?ll need|what you need|shopping list)\b/i;
const STEP_HEADER =
  /^(instructions?|method|directions?|steps?|how to make(?: it)?|how to|preparation|prep|recipe steps)\b\s*[:：-]?\s*$/i;
// Lines that are about the post, not the recipe.
const PROMO =
  /\b(follow|save (?:this|it|for later)|share (?:this|with)|link in (?:my )?bio|tag (?:a|your)|comment|like (?:this|if)|subscribe|dm me|giveaway|full recipe)\b/i;
// Hashtags that say nothing about the dish.
const GENERIC_TAGS = new Set([
  'recipe',
  'recipes',
  'food',
  'foodie',
  'foodies',
  'instafood',
  'foodstagram',
  'foodporn',
  'yum',
  'yummy',
  'delicious',
  'reels',
  'reel',
  'reelsinstagram',
  'explore',
  'explorepage',
  'fyp',
  'foryou',
  'viral',
  'trending',
  'cooking',
  'homecooking',
  'homemade',
  'easyrecipe',
  'easyrecipes',
  'foodblogger',
  'instagood',
  'tasty',
  'cook',
  'chef',
  'foodlover',
  'eeeeeats',
]);
const MAX_TAGS = 5;

const KEYCAP = /^(\d{1,2})️?⃣\s*/u;
const LEADING_JUNK = /^[\s\p{Extended_Pictographic}️‍•·▪▫◦‣⁃●○■□►▶︎→✓✔☑︎*>–—-]+/u;
const TRAILING_JUNK = /[\s\p{Extended_Pictographic}️‍]+$/u;
const STEP_NUMBER = /^(?:step\s*)?(\d{1,2})\s*[.):\-–]\s*|^step\s*(\d{1,2})\s+/i;

function cleanLine(line: string): string {
  return line.replace(KEYCAP, '$1. ').replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '').trim();
}

function minutesFrom(amount: string, unit: string): number {
  const n = Number(amount);
  return /^h/i.test(unit) ? Math.round(n * 60) : Math.round(n);
}

const TIME = String.raw`(\d+(?:\.\d+)?)\s*(minutes?|mins?|m\b|hours?|hrs?|h\b)`;

function findTime(text: string, label: RegExp): number | undefined {
  const m = text.match(new RegExp(label.source + String.raw`[^\d\n]{0,12}` + TIME, 'i'));
  return m ? minutesFrom(m[1], m[2]) : undefined;
}

function findServings(text: string): number | undefined {
  const m =
    text.match(/\b(?:serves|servings?|makes|yield|portions?)\s*[:\-]?\s*(\d{1,2})\b/i) ??
    text.match(/\b(\d{1,2})\s*(?:servings|portions|people)\b/i);
  return m ? Number(m[1]) : undefined;
}

function guessCategory(text: string): Category | undefined {
  const t = text.toLowerCase();
  if (/\b(cocktail|mocktail|latte|smoothie|lemonade|juice|drink|tea|coffee|matcha)\b/.test(t))
    return 'Drinks';
  if (
    /\b(cake|cookies?|brownies?|dessert|pie|ice cream|pudding|cheesecake|tart|muffins?|sweets?)\b/.test(
      t,
    )
  )
    return 'Dessert';
  if (
    /\b(breakfast|pancakes?|waffles?|oatmeal|overnight oats|granola|french toast|brunch)\b/.test(t)
  )
    return 'Breakfast';
  if (/\b(snacks?|bites|dip|hummus|energy balls?)\b/.test(t)) return 'Snack';
  if (/\b(dinner|supper)\b/.test(t)) return 'Dinner';
  if (/\b(lunch|salad|sandwich|wrap)\b/.test(t)) return 'Lunch';
  return undefined;
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, pre, ch) => pre + ch.toUpperCase());
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > 90) return false;
  const ing = parseIngredientLine(line);
  return ing.amount !== undefined || /^(a |an )?(pinch|handful|dash|splash|bunch) of\b/i.test(line);
}

/** Splits a paragraph into sentences, for captions that write all the steps on one line. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Reads a recipe out of free text. Works best when the text has "Ingredients" / "Method"
 * headings, but also handles plain lists: lines that start with an amount become ingredients,
 * numbered lines become steps.
 */
export function parseRecipeText(raw: string): ParsedRecipeText {
  const text = raw.replace(/\r\n?/g, '\n');

  const tags: string[] = [];
  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const tag = m[1].toLowerCase();
    if (!GENERIC_TAGS.has(tag) && !tags.includes(tag) && tags.length < MAX_TAGS) tags.push(tag);
  }

  const lines = text
    .split('\n')
    .map((l) => cleanLine(l.replace(/#[\p{L}\p{N}_]+/gu, '')))
    .filter((l) => l && !(l.length < 120 && PROMO.test(l)));

  let section: 'intro' | 'ingredients' | 'steps' = 'intro';
  let sawHeaders = false;
  const intro: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];

  for (const line of lines) {
    if (INGREDIENT_HEADER.test(line) && line.length < 60) {
      section = 'ingredients';
      sawHeaders = true;
      // "Ingredients: 2 eggs, 1 cup milk" on one line.
      const rest = line
        .replace(INGREDIENT_HEADER, '')
        .replace(/^[^:：]*[:：]\s*/, '')
        .trim();
      if (rest && looksLikeIngredient(rest)) ingredients.push(...rest.split(/,\s*/));
      continue;
    }
    if (STEP_HEADER.test(line)) {
      section = 'steps';
      sawHeaders = true;
      continue;
    }

    const numbered = line.match(STEP_NUMBER);
    if (section === 'ingredients') {
      // "For the sauce:" style sub-headings are skipped; a numbered sentence means steps started.
      if (/[:：]$/.test(line) && line.length < 40) continue;
      if (numbered && !looksLikeIngredient(line)) {
        section = 'steps';
      } else {
        ingredients.push(line);
        continue;
      }
    }
    if (section === 'steps') {
      if (/[:：]$/.test(line) && line.length < 40) continue;
      const step = line.replace(STEP_NUMBER, '').trim();
      if (step) steps.push(...(numbered || step.length < 160 ? [step] : splitSentences(step)));
      continue;
    }
    intro.push(line);
  }

  // No headings: sort intro lines by shape.
  if (!sawHeaders) {
    const rest: string[] = [];
    for (const line of intro) {
      if (STEP_NUMBER.test(line) && !looksLikeIngredient(line)) {
        steps.push(line.replace(STEP_NUMBER, '').trim());
      } else if (looksLikeIngredient(line) && !steps.length) {
        ingredients.push(line);
      } else {
        rest.push(line);
      }
    }
    intro.splice(0, intro.length, ...rest);
  }

  const firstIntro = intro.find((l) => l.length <= 80 && !/^(serves|prep|cook|total)\b/i.test(l));
  const title = firstIntro
    ?.replace(/[!.:]+$/, '')
    .replace(/\s*\|.*$/, '')
    .trim();
  const titleText = title ? titleCase(title) : undefined;

  const prepMinutes = findTime(text, /\bprep(?:aration)?(?:\s*time)?/);
  let cookMinutes = findTime(text, /\b(?:cook(?:ing)?|bake|baking)(?:\s*time)?/);
  if (prepMinutes === undefined && cookMinutes === undefined) {
    cookMinutes =
      findTime(text, /\b(?:total(?:\s*time)?|ready in|takes|in just|in only|in)/) ??
      (titleText?.match(/(\d+)[\s-]*(minute|min)/i)
        ? Number(titleText.match(/(\d+)/)![1])
        : undefined);
  }

  return {
    title: titleText,
    ingredients: ingredients.map((i) => i.trim()).filter(Boolean),
    steps,
    servings: findServings(text),
    prepMinutes,
    cookMinutes,
    tags,
    category: guessCategory(`${titleText ?? ''} ${tags.join(' ')}`),
  };
}

/**
 * Turns caption text into a recipe draft for the user to review.
 * If the ingredients or steps couldn't be found, the whole text goes into the notes so nothing is lost.
 */
export function recipeDraftFromText(
  text: string,
  extra: { sourceUrl?: string; photoUri?: string; author?: string; site?: string } = {},
): Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> {
  const p = parseRecipeText(text);
  const notes = [
    extra.author ? `From @${extra.author} on ${extra.site ?? 'Instagram'}.` : undefined,
    !p.ingredients.length || !p.steps.length ? `Original text:\n${text.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    title: p.title ?? (extra.author ? `Recipe from @${extra.author}` : 'Imported recipe'),
    photoUri: extra.photoUri,
    category: p.category,
    tags: p.tags,
    servings: p.servings,
    prepMinutes: p.prepMinutes,
    cookMinutes: p.cookMinutes,
    ingredients: parseIngredientList(p.ingredients.join('\n')),
    steps: p.steps,
    notes: notes || undefined,
    sourceUrl: extra.sourceUrl,
  };
}
