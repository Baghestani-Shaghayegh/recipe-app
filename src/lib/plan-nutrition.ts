import { servingNutrition, ZERO, type Nutrients } from './nutrition';
import type { MealPlan } from './plan';
import type { Recipe } from './recipe';

/** Daily targets. Either can be left out. */
export type Goals = { kcal?: number; protein?: number };

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
  for (const day of days) {
    for (const id of plan[day] ?? []) {
      const recipe = recipes.get(id);
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
