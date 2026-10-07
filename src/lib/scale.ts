import type { Ingredient } from './ingredients';
import { formatAmount, withUnit } from './shopping';
import { convertAmount, type UnitSystem } from './units';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;

/** How much to multiply amounts by to go from `from` servings to `to` servings. */
export function scaleFactor(from: number | undefined, to: number | undefined): number {
  if (!from || !to || from <= 0 || to <= 0) return 1;
  return to / from;
}

/**
 * The ingredient line to show at a different serving size and/or unit system,
 * e.g. "1 1/2 cups flour" x2 -> "3 cups flour", or "355 ml flour" in metric.
 * Lines without an amount ("salt to taste", "2-3 eggs") and nothing to change keep the original text.
 */
export function scaleIngredientText(
  ing: Ingredient,
  factor: number,
  system: UnitSystem = 'original',
): string {
  if (ing.amount === undefined || (factor === 1 && system === 'original')) return ing.text;
  const { amount, unit } = convertAmount(ing.amount * factor, ing.unit, system);
  if (formatAmount(amount) === '0') return ing.text;
  return `${withUnit(amount, unit)} ${ing.name}`;
}
