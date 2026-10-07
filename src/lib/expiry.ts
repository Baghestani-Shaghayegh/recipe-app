import { addDays, dateKey } from './plan';
import { pantryHas } from './pantry';
import type { Recipe } from './recipe';

/** Best-before dates by pantry item, as local dates like "2026-10-07". */
export type Expiry = Record<string, string>;

export const EXPIRY_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
] as const;

/** Items that expire within this many days (or already have) count as "use it up". */
export const USE_SOON_DAYS = 3;

export function expiryIn(days: number, today = new Date()): string {
  return dateKey(addDays(today, days));
}

/** Whole days from today until the date (negative once it has passed). */
export function daysLeft(day: string, today = new Date()): number {
  const [y, m, d] = day.split('-').map(Number);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000);
}

export function describeExpiry(left: number): string {
  if (left < 0) return left === -1 ? 'Expired yesterday' : `Expired ${-left} days ago`;
  if (left === 0) return 'Expires today';
  if (left === 1) return 'Expires tomorrow';
  return `Expires in ${left} days`;
}

export type ExpiringItem = { item: string; daysLeft: number };

/** Pantry items due within `withinDays`, soonest (or longest expired) first. */
export function expiringItems(
  pantry: string[],
  expiry: Expiry,
  today = new Date(),
  withinDays = USE_SOON_DAYS,
): ExpiringItem[] {
  return pantry
    .filter((item) => expiry[item] !== undefined)
    .map((item) => ({ item, daysLeft: daysLeft(expiry[item], today) }))
    .filter((e) => e.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.item.localeCompare(b.item));
}

export type UseItUpMatch = { recipe: Recipe; uses: ExpiringItem[] };

/** Recipes that use expiring items, the ones using the most (and the soonest to go) first. */
export function recipesToUseUp(recipes: Recipe[], expiring: ExpiringItem[]): UseItUpMatch[] {
  if (!expiring.length) return [];
  return recipes
    .map((recipe) => ({
      recipe,
      uses: expiring.filter((e) => recipe.ingredients.some((ing) => pantryHas([e.item], ing.name))),
    }))
    .filter((m) => m.uses.length > 0)
    .sort(
      (a, b) =>
        b.uses.length - a.uses.length ||
        Math.min(...a.uses.map((u) => u.daysLeft)) - Math.min(...b.uses.map((u) => u.daysLeft)),
    );
}
