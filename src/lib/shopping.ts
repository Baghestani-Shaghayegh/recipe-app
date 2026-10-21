import { guessSection, SECTION_LABELS, type StoreSection } from './foods';
import type { Ingredient } from './ingredients';
import { findFood } from './nutrition';
import { DESCRIPTORS, isStaple, normalizeWords, pantryHas } from './pantry';
import type { Recipe } from './recipe';

export type ShoppingItem = {
  /** Stable id for the item (its normalized name), used to remember ticks. */
  key: string;
  name: string;
  /** e.g. "5", "300 g", "1½ cups + 2 tbsp". Missing when no recipe gave an amount. */
  quantity?: string;
  section: StoreSection;
  /** Titles of the recipes that need it. */
  recipes: string[];
};

const MASS_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const VOLUME_ML: Record<string, number> = { tsp: 4.93, tbsp: 14.79, cup: 236.6, ml: 1, l: 1000 };
const PLURAL_UNITS: Record<string, string> = {
  cup: 'cups',
  clove: 'cloves',
  can: 'cans',
  slice: 'slices',
  bunch: 'bunches',
  pinch: 'pinches',
};

const FRACTIONS: [number, string][] = [
  [0.25, '¼'],
  [1 / 3, '⅓'],
  [0.5, '½'],
  [2 / 3, '⅔'],
  [0.75, '¾'],
];

/** 1.5 -> "1½", 0.25 -> "¼", 2.4 -> "2.4". */
export function formatAmount(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.01) return String(whole);
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.01) return `${whole || ''}${glyph}`;
  }
  return String(Math.round(n * 10) / 10);
}

export function withUnit(amount: number, unit: string | undefined): string {
  if (!unit) return formatAmount(amount);
  const u = amount > 1 && PLURAL_UNITS[unit] ? PLURAL_UNITS[unit] : unit;
  return `${formatAmount(amount)} ${u}`;
}

/** "chopped parsley, washed (1 bunch) to garnish" -> "parsley". */
export function shoppingName(name: string): string {
  // "broth (chicken)" or "stock (chicken or vegetable)": the kind goes in front.
  const base = name.match(/\b(broth|stock|bouillon)\b/i);
  const kind = base && name.match(/\(\s*([a-z]+)[^)]*\)/i);
  const named =
    base && kind && !name.toLowerCase().includes(`${kind[1]} ${base[1]}`.toLowerCase())
      ? name.replace(kind[0], ' ').replace(base[0], `${kind[1]} ${base[1]}`)
      : name;
  const words = named
    .split(',')[0]
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(to taste|to garnish|for garnish|for serving|to serve|optional)\b.*$/i, '')
    // "chicken broth per serving", "eggs, 2 per person": how much, not what.
    .replace(/\s*\b(?:per (?:serving|servings|person|portion)|each)\b.*$/i, '')
    // Amounts written after the name: "spring onions x 3", "eggs: 2", "chicken broth – 2 cups".
    .replace(/\s*(?:[x×:–-]\s*)?\d[\d\s.,/½¼¾⅓⅔-]*(?:[a-z]+)?$/i, '')
    .trim()
    .split(/\s+/);
  // Amounts, measures and how it's cooked in front: "2-3", "three", "3 stalks", "steamed".
  while (
    words.length > 1 &&
    (DESCRIPTORS.has(words[0].toLowerCase()) || LEADING.test(words[0]) || PREPARED.test(words[0]))
  ) {
    words.shift();
  }
  return words.join(' ').toLowerCase();
}

// How a food is cooked or a label on the pack, which isn't what you look for in the shop.
const PREPARED =
  /^(?:steamed|cooked|boiled|roasted|toasted|grilled|fried|baked|mashed|poached|saut[eé]ed|blanched|leftover|low-sodium|reduced-sodium|low-fat|homemade|store-bought|warm|cold|hot)$/i;

// Words in front of an ingredient that are an amount or a measure, not the food.
const LEADING = new RegExp(
  '^(?:[\\d½¼¾⅓⅔⅛.,/–-]+|x|×|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|' +
    'dozen|half|couple|several|' +
    'stalks?|sprigs?|bunch(?:es)?|heads?|cloves?|pieces?|slices?|cans?|tins?|jars?|packs?|' +
    'packets?|bags?|pinch(?:es)?|dash(?:es)?|cups?|tbsps?|tsps?|tablespoons?|teaspoons?|g|kg|' +
    'grams?|ml|l|litres?|liters?|oz|lbs?|pounds?|handfuls?)$',
  'i',
);

// Ingredients that say "and" but are one thing.
const ONE_THING = /\b(?:sweet and sour|mac(?:aroni)? and cheese|half and half|salt and vinegar)\b/i;

/**
 * The things to buy in one ingredient line: "parsley and chives" is two, "sweet and sour sauce"
 * is one.
 */
export function shoppingParts(name: string): string[] {
  const whole = shoppingName(name);
  if (ONE_THING.test(whole)) return [whole];
  const parts = whole
    .split(/\s+(?:and|&)\s+|\s*&\s*/)
    .map((p) => shoppingName(p))
    .filter(Boolean);
  return parts.length > 1 ? parts : [whole];
}

/** An ingredient line per thing to buy ("parsley and chives" becomes parsley, chives). */
function perThing(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.flatMap((ing) => {
    const parts = shoppingParts(ing.name);
    return parts.length > 1
      ? parts.map((name) => ({ ...ing, name, amount: undefined, unit: undefined }))
      : [ing];
  });
}

/** One key per ingredient on the list: "2 Ripe Tomatoes, chopped" and "tomato" share "tomato". */
export function shoppingKey(name: string): string {
  const short = shoppingName(name);
  return normalizeWords(short).join(' ') || short;
}

/** A meal from the plan whose ingredients are on the shopping list, minus the ones unticked. */
export type PlannedShop = { day: string; recipeId: string; skip: string[] };

/**
 * The recipes the shopping list is made from: every meal added from the plan that's today or
 * later (a recipe planned twice counts twice, without the ingredients unticked in the review),
 * then the Make next recipes that aren't already there from the plan.
 */
export function shoppingRecipes(
  makeNext: string[],
  planned: PlannedShop[],
  recipes: Map<string, Recipe>,
  today: string,
): Recipe[] {
  const fromPlan = planned
    .filter((p) => p.day >= today && recipes.has(p.recipeId))
    .map((p) => {
      const r = recipes.get(p.recipeId)!;
      return p.skip.length
        ? {
            ...r,
            ingredients: perThing(r.ingredients).filter(
              (i) => !p.skip.includes(shoppingKey(i.name)),
            ),
          }
        : r;
    });
  const planIds = new Set(fromPlan.map((r) => r.id));
  const fromNext = [...new Set(makeNext)]
    .filter((id) => !planIds.has(id))
    .map((id) => recipes.get(id))
    .filter((r): r is Recipe => !!r);
  return [...fromPlan, ...fromNext];
}

type Unit = 'mass' | 'volume' | 'count' | string;

function unitClass(unit: string | undefined): Unit {
  if (!unit || unit === 'piece') return 'count';
  if (MASS_G[unit]) return 'mass';
  if (VOLUME_ML[unit]) return 'volume';
  return unit; // clove, can, slice, bunch, pinch: only add up with the same unit
}

type Part = { units: Set<string | undefined>; amount: number; base: number };

function formatPart(cls: Unit, part: Part): string {
  if (part.units.size === 1) return withUnit(part.amount, [...part.units][0]);
  // Mixed units of the same kind: add up in grams or millilitres.
  if (cls === 'mass')
    return part.base >= 1000
      ? `${formatAmount(part.base / 1000)} kg`
      : `${Math.round(part.base)} g`;
  if (cls === 'volume')
    return part.base >= 1000
      ? `${formatAmount(part.base / 1000)} l`
      : `${Math.round(part.base)} ml`;
  return withUnit(part.amount, undefined);
}

type Group = {
  key: string;
  names: string[];
  parts: Map<Unit, Part>;
  recipes: string[];
  section: StoreSection;
  count: number;
};

/**
 * Everything the recipes need that isn't in the pantry, one line per ingredient,
 * with amounts added up. Staples (salt, pepper, oil, water) are left out.
 */
export function buildShoppingList(recipes: Recipe[], pantry: string[]): ShoppingItem[] {
  const groups = new Map<string, Group>();

  const add = (ing: Ingredient, recipeTitle: string) => {
    if (isStaple(ing.name) || pantryHas(pantry, ing.name)) return;
    const name = shoppingName(ing.name);
    const key = shoppingKey(ing.name);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        names: [],
        parts: new Map(),
        recipes: [],
        section: findFood(name)?.section ?? guessSection(name),
        count: 0,
      };
      groups.set(key, g);
    }
    if (!g.names.includes(name)) g.names.push(name);
    if (!g.recipes.includes(recipeTitle)) g.recipes.push(recipeTitle);
    if (ing.amount === undefined) return;

    const cls = unitClass(ing.unit);
    const part = g.parts.get(cls) ?? { units: new Set(), amount: 0, base: 0 };
    // Only use `amount` as-is while every entry has the same unit; `base` always adds up.
    part.units.add(ing.unit === 'piece' ? undefined : ing.unit);
    part.amount += ing.amount;
    part.base += ing.amount * (MASS_G[ing.unit ?? ''] ?? VOLUME_ML[ing.unit ?? ''] ?? 1);
    if (cls === 'count') g.count += ing.amount;
    g.parts.set(cls, part);
  };

  for (const r of recipes) for (const ing of perThing(r.ingredients)) add(ing, r.title);

  return [...groups.values()].map((g) => {
    // "1 onion" + "2 onions": prefer the plural spelling when buying more than one.
    const plural = g.names.find((n) => /s$/.test(n));
    const name = g.count > 1 && plural ? plural : g.names[0];
    const quantity = [...g.parts.entries()].map(([cls, part]) => formatPart(cls, part)).join(' + ');
    return {
      key: g.key,
      name,
      quantity: quantity || undefined,
      section: g.section,
      recipes: g.recipes,
    };
  });
}

/**
 * What some planned meals need: the shopping list (a recipe planned twice counts twice), and the
 * names of things they use that are already in the pantry.
 */
export function mealsShopping(
  recipes: Recipe[],
  pantry: string[],
): { items: ShoppingItem[]; have: string[] } {
  const have = new Map<string, string>();
  for (const r of recipes) {
    for (const ing of perThing(r.ingredients)) {
      if (isStaple(ing.name) || !pantryHas(pantry, ing.name)) continue;
      const key = shoppingKey(ing.name);
      if (!have.has(key)) have.set(key, shoppingName(ing.name));
    }
  }
  return { items: buildShoppingList(recipes, pantry), have: [...have.values()] };
}

/** Plain text for sharing or copying, grouped by section. */
export function shoppingListText(
  items: { name: string; quantity?: string; section: StoreSection }[],
  sections: readonly StoreSection[],
): string {
  return sections
    .map((section) => {
      const lines = items
        .filter((i) => i.section === section)
        .map((i) => `- ${i.quantity ? `${i.quantity} ` : ''}${i.name}`);
      return lines.length ? `${SECTION_LABELS[section]}\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
