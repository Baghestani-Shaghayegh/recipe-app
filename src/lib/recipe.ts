import { fitsDiet, type DietId } from './diet';
import type { Ingredient } from './ingredients';
import type { Nutrients } from './nutrition';

export const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drinks'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Recipe = {
  id: string;
  title: string;
  photoUri?: string;
  category?: Category;
  tags: string[];
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  sourceUrl?: string;
  /** Per-serving values typed in by the user; when missing, nutrition is estimated. */
  nutrition?: Nutrients;
  favorite?: boolean;
  /** Your own rating, 1 to 5 stars. */
  rating?: number;
  createdAt: number;
  updatedAt: number;
};

export const TIME_FILTERS = [
  { label: '≤ 15 min', maxMinutes: 15 },
  { label: '≤ 30 min', maxMinutes: 30 },
  { label: '≤ 1 hour', maxMinutes: 60 },
] as const;

export function totalMinutes(r: Pick<Recipe, 'prepMinutes' | 'cookMinutes'>): number | undefined {
  if (r.prepMinutes === undefined && r.cookMinutes === undefined) return undefined;
  return (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
}

export const MAX_RATING = 5;

/** Tapping the star you already gave clears the rating; any other star sets it. */
export function nextRating(current: number | undefined, tapped: number): number | undefined {
  return current === tapped ? undefined : tapped;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Spicy, quick ,vegetarian" -> ["spicy", "quick", "vegetarian"] (lowercase, no duplicates). */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

export type RecipeFilters = {
  query: string;
  category?: Category;
  maxMinutes?: number;
  tags: string[];
  favoritesOnly?: boolean;
  /** Every diet listed must fit. */
  diets?: DietId[];
};

/**
 * Search matches the title, ingredient names, and tags.
 * Recipes with no time set are hidden when a time filter is on.
 * All selected tags must be present.
 */
export function filterRecipes(recipes: Recipe[], f: RecipeFilters): Recipe[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return recipes.filter((r) => {
    if (f.favoritesOnly && !r.favorite) return false;
    if (f.diets?.some((d) => !fitsDiet(r, d))) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.maxMinutes !== undefined) {
      const t = totalMinutes(r);
      if (t === undefined || t > f.maxMinutes) return false;
    }
    if (f.tags.some((t) => !r.tags.includes(t))) return false;
    if (words.length) {
      const haystack = [r.title, ...r.ingredients.map((i) => i.name), ...r.tags]
        .join(' ')
        .toLowerCase();
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
}

/** Every tag used by any recipe, most used first. */
export function allTags(recipes: Recipe[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);
}
