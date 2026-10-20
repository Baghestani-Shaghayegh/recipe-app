/** The meals a day can have, in the order they're shown. */
export const MEALS = ['breakfast', 'lunch', 'dinner'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/** The recipe planned for each meal of one day. */
export type DayPlan = Partial<Record<Meal, string>>;

/** Planned meals per day. Keys are local dates like "2026-10-07". */
export type MealPlan = Record<string, DayPlan>;

/** One planned meal. */
export type PlannedMeal = { day: string; meal: Meal; recipeId: string };

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-07" -> that day at midnight, local time. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
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

/**
 * A saved plan in today's shape. Plans from before meals had slots (a list of recipe ids per
 * day) are spread over breakfast, lunch and dinner in order; anything past dinner is dropped.
 */
export function normalizePlan(raw: unknown): MealPlan {
  if (!raw || typeof raw !== 'object') return {};
  const plan: MealPlan = {};
  for (const [day, value] of Object.entries(raw as Record<string, unknown>)) {
    const dayPlan: DayPlan = {};
    if (Array.isArray(value)) {
      value
        .filter((id): id is string => typeof id === 'string')
        .slice(0, MEALS.length)
        .forEach((id, i) => (dayPlan[MEALS[i]] = id));
    } else if (value && typeof value === 'object') {
      for (const meal of MEALS) {
        const id = (value as Record<string, unknown>)[meal];
        if (typeof id === 'string') dayPlan[meal] = id;
      }
    }
    if (Object.keys(dayPlan).length) plan[day] = dayPlan;
  }
  return plan;
}

/** Plans `recipeId` for one meal (replacing what was there), or clears it when undefined. */
export function setMeal(
  plan: MealPlan,
  day: string,
  meal: Meal,
  recipeId: string | undefined,
): MealPlan {
  const { [meal]: _old, ...rest } = plan[day] ?? {};
  const dayPlan: DayPlan = recipeId ? { ...rest, [meal]: recipeId } : rest;
  const { [day]: _day, ...otherDays } = plan;
  return Object.keys(dayPlan).length ? { ...otherDays, [day]: dayPlan } : otherDays;
}

/** Every meal planned on the given days, in day and meal order. */
export function plannedMeals(plan: MealPlan, days: string[]): PlannedMeal[] {
  return days.flatMap((day) =>
    MEALS.flatMap((meal) => {
      const recipeId = plan[day]?.[meal];
      return recipeId ? [{ day, meal, recipeId }] : [];
    }),
  );
}

/** Names one planned meal, so it can be remembered as already on the shopping list. */
export const mealKey = (m: PlannedMeal) => `${m.day}:${m.meal}:${m.recipeId}`;

export type ShopRange = 'today' | 'next3' | 'week';

/**
 * The days of a week to shop for, from today on: just today, the next 3 days, or the rest of the
 * week. A week that hasn't started yet is shopped for as a whole; a past week has nothing left.
 */
export function shopRangeDays(week: string[], today: string, range: ShopRange): string[] {
  const left = week.filter((d) => d >= today);
  if (range === 'today') return left[0] === today ? [today] : [];
  if (range === 'next3') return left.slice(0, 3);
  return left;
}
