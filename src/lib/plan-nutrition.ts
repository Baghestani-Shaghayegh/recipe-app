import { servingNutrition, ZERO, type Nutrients } from './nutrition';
import { plannedMeals, type MealPlan } from './plan';
import type { Recipe } from './recipe';

/** Daily targets. Any can be left out. */
export type Goals = { kcal?: number; protein?: number; fat?: number };

/** Typical daily amounts, used for any goal that isn't set (fat is the usual daily value). */
export const TYPICAL_GOALS: Required<Goals> = { kcal: 2000, protein: 100, fat: 78 };

/** The goals with typical amounts filled in where none is set. */
export function dailyGoals(goals: Goals): Required<Goals> {
  return {
    kcal: goals.kcal || TYPICAL_GOALS.kcal,
    protein: goals.protein || TYPICAL_GOALS.protein,
    fat: goals.fat || TYPICAL_GOALS.fat,
  };
}

export type DayNutrition = {
  /** Adds up one serving of each planned recipe. */
  total: Nutrients;
  /** Planned recipes with no nutrition data (no ingredient amounts and nothing typed in). */
  unknown: number;
};

/** One serving of every recipe planned on the given days. Days without plans add nothing. */
export function planNutrition(
  plan: MealPlan,
  days: string[],
  recipes: Map<string, Recipe>,
): DayNutrition {
  const total = { ...ZERO };
  let unknown = 0;
  for (const { recipeId } of plannedMeals(plan, days)) {
    const recipe = recipes.get(recipeId);
    if (!recipe) continue;
    const n = servingNutrition(recipe);
    if (!n) {
      unknown++;
      continue;
    }
    total.kcal += n.values.kcal;
    total.protein += n.values.protein;
    total.carbs += n.values.carbs;
    total.fat += n.values.fat;
  }
  return { total, unknown };
}

/** "1,500" or "1500 kcal" -> 1500. Empty text clears the goal; junk and zero are undefined too. */
export function parseGoal(text: string): number | undefined {
  const n = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/** How far along a goal a total is, 0 to more than 1. Undefined without a goal. */
export function goalProgress(total: number, goal: number | undefined): number | undefined {
  return goal ? total / goal : undefined;
}
