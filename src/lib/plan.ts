/** Planned recipe ids per day. Keys are local dates like "2026-10-07". */
export type MealPlan = Record<string, string[]>;

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  // Built from parts (not milliseconds) so daylight saving changes can't shift the date.
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** The Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Monday to Sunday of the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function addToPlan(plan: MealPlan, day: string, recipeId: string): MealPlan {
  const ids = plan[day] ?? [];
  return ids.includes(recipeId) ? plan : { ...plan, [day]: [...ids, recipeId] };
}

export function removeFromPlan(plan: MealPlan, day: string, recipeId: string): MealPlan {
  const ids = (plan[day] ?? []).filter((id) => id !== recipeId);
  const { [day]: _removed, ...rest } = plan;
  return ids.length ? { ...rest, [day]: ids } : rest;
}

/** Recipe ids planned for `fromDay` or later, in date order, each once. */
export function upcomingRecipeIds(plan: MealPlan, fromDay: string): string[] {
  const ids = Object.keys(plan)
    .filter((day) => day >= fromDay)
    .sort()
    .flatMap((day) => plan[day]);
  return [...new Set(ids)];
}
