import type { StoreSection } from './foods';
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

function withUnit(amount: number, unit: string | undefined): string {
  if (!unit) return formatAmount(amount);
  const u = amount > 1 && PLURAL_UNITS[unit] ? PLURAL_UNITS[unit] : unit;
  return `${formatAmount(amount)} ${u}`;
}

/** "chopped parsley, washed (1 bunch) to garnish" -> "parsley". */
export function shoppingName(name: string): string {
  const words = name
    .split(',')[0]
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(to taste|to garnish|for garnish|for serving|to serve|optional)\b.*$/i, '')
    .trim()
    .split(/\s+/);
  while (words.length > 1 && DESCRIPTORS.has(words[0].toLowerCase())) words.shift();
  return words.join(' ').toLowerCase();
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
    const key = normalizeWords(name).join(' ') || name;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        names: [],
        parts: new Map(),
        recipes: [],
        section: findFood(name)?.section ?? 'Other',
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

  for (const r of recipes) for (const ing of r.ingredients) add(ing, r.title);

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
      return lines.length ? `${section}\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
