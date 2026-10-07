import { microFor } from './foods-micro';
import { FOODS, type Food } from './foods';
import type { Ingredient } from './ingredients';
import { containsPhrase, isStaple, normalizeWords } from './pantry';
import type { Recipe } from './recipe';

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const ML_PER: Record<string, number> = { tsp: 4.93, tbsp: 14.79, cup: 236.6, ml: 1, l: 1000 };
const G_PER: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
const PINCH_G = 0.4;

const INDEX = FOODS.flatMap((food) => food.names.map((n) => ({ words: normalizeWords(n), food })));

/** The food whose name best matches the ingredient (longest matching name wins). */
export function findFood(ingredientName: string): Food | undefined {
  const words = normalizeWords(ingredientName);
  let best: { words: string[]; food: Food } | undefined;
  for (const entry of INDEX) {
    if (containsPhrase(words, entry.words) && (!best || entry.words.length > best.words.length)) {
      best = entry;
    }
  }
  return best?.food;
}

/** Converts an amount + unit of a food to grams, or undefined if we can't tell. */
export function toGrams(food: Food, amount: number, unit: string | undefined): number | undefined {
  if (unit && G_PER[unit]) return amount * G_PER[unit];
  if (unit && ML_PER[unit]) return amount * ML_PER[unit] * ((food.cup ?? 236.6) / 236.6);
  if (unit === 'pinch') return amount * PINCH_G;
  if (unit === 'can') return food.can !== undefined ? amount * food.can : undefined;
  if (unit === 'bunch') return food.bunch !== undefined ? amount * food.bunch : undefined;
  // No unit, or a counting unit: "3 eggs", "2 cloves garlic", "1 slice bread".
  return food.each !== undefined ? amount * food.each : undefined;
}

export type IngredientNutrition = {
  ingredient: Ingredient;
  food?: Food;
  grams?: number;
  nutrients?: Nutrients;
  /** Why it wasn't counted. "skipped" = salt/pepper/oil "to taste": too small or unknown, not worth a warning. */
  problem?: 'unknown-food' | 'no-amount' | 'unknown-size' | 'skipped';
};

function scale(food: Food, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: food.kcal * f,
    protein: food.protein * f,
    carbs: food.carbs * f,
    fat: food.fat * f,
  };
}

function add(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function divide(n: Nutrients, by: number): Nutrients {
  return { kcal: n.kcal / by, protein: n.protein / by, carbs: n.carbs / by, fat: n.fat / by };
}

export function ingredientNutrition(ingredient: Ingredient): IngredientNutrition {
  if (ingredient.amount === undefined) {
    return { ingredient, problem: isStaple(ingredient.name) ? 'skipped' : 'no-amount' };
  }
  const food = findFood(ingredient.name);
  if (!food) return { ingredient, problem: 'unknown-food' };
  const grams = toGrams(food, ingredient.amount, ingredient.unit);
  if (grams === undefined) return { ingredient, food, problem: 'unknown-size' };
  return { ingredient, food, grams, nutrients: scale(food, grams) };
}

export type NutritionEstimate = {
  total: Nutrients;
  perServing: Nutrients;
  servings: number;
  lines: IngredientNutrition[];
  /** Ingredients that couldn't be counted (excluding skipped staples). */
  notCounted: IngredientNutrition[];
  countedCount: number;
};

export function estimateNutrition(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
): NutritionEstimate {
  const lines = recipe.ingredients.map(ingredientNutrition);
  const total = lines.reduce((sum, l) => (l.nutrients ? add(sum, l.nutrients) : sum), ZERO);
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
  return {
    total,
    perServing: divide(total, servings),
    servings,
    lines,
    notCounted: lines.filter((l) => l.problem && l.problem !== 'skipped'),
    countedCount: lines.filter((l) => l.nutrients).length,
  };
}

/** Per-serving numbers to show: the user's own if entered, otherwise the estimate (if any). */
export function servingNutrition(
  recipe: Pick<Recipe, 'ingredients' | 'servings' | 'nutrition'>,
): { values: Nutrients; source: 'manual' | 'estimate' } | undefined {
  if (recipe.nutrition) return { values: recipe.nutrition, source: 'manual' };
  const est = estimateNutrition(recipe);
  return est.countedCount ? { values: est.perServing, source: 'estimate' } : undefined;
}

export type Extras = { fiber: number; sugar: number; sodium: number };

/**
 * Fiber (g), sugar (g) and sodium (mg) per serving, added up from the ingredients that were counted
 * in the main estimate. Undefined if nothing could be counted.
 */
export function estimateExtras(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
): Extras | undefined {
  const est = estimateNutrition(recipe);
  if (!est.countedCount) return undefined;
  const total = { fiber: 0, sugar: 0, sodium: 0 };
  for (const l of est.lines) {
    const micro = l.food && l.grams !== undefined ? microFor(l.food) : undefined;
    if (!micro || l.grams === undefined) continue;
    total.fiber += (micro.fiber * l.grams) / 100;
    total.sugar += (micro.sugar * l.grams) / 100;
    total.sodium += (micro.sodium * l.grams) / 100;
  }
  return {
    fiber: total.fiber / est.servings,
    sugar: total.sugar / est.servings,
    sodium: total.sodium / est.servings,
  };
}
