import type { Ingredient } from './ingredients';
import { formatAmount, withUnit } from './shopping';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;

/** How much to multiply amounts by to go from `from` servings to `to` servings. */
export function scaleFactor(from: number | undefined, to: number | undefined): number {
  if (!from || !to || from <= 0 || to <= 0) return 1;
  return to / from;
}

/**
 * The ingredient line to show at a different serving size, e.g. "1 1/2 cups flour" x2 -> "3 cups flour".
 * Lines without an amount ("salt to taste", "2-3 eggs") and a factor of 1 keep the original text.
 */
export function scaleIngredientText(ing: Ingredient, factor: number): string {
  if (ing.amount === undefined || factor === 1) return ing.text;
  const amount = ing.amount * factor;
  if (formatAmount(amount) === '0') return ing.text;
  return `${withUnit(amount, ing.unit)} ${ing.name}`;
}
