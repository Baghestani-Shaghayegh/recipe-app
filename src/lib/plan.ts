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

/** One meal of one day, e.g. "2026-10-22:lunch". */
export const slotKey = (day: string, meal: Meal) => `${day}:${meal}`;

/**
 * Meal prep: a recipe cooked once (on `cookDay`'s `cookMeal`) in a big batch and eaten again on
 * the `eats` meals. Each meal, the cooking one included, uses one serving per person.
 */
export type Batch = {
  id: string;
  recipeId: string;
  cookDay: string;
  cookMeal: Meal;
  servings: number;
  people: number;
  /** The leftover meals. */
  eats: { day: string; meal: Meal }[];
  /** Days after the cooking day it keeps in the fridge (see keepDaysFor); 3 when missing. */
  keepDays?: number;
};

/** Servings the planned meals use, and what's left (below zero when there isn't enough). */
export function batchUse(
  batch: Pick<Batch, 'servings' | 'people'> & { eats: readonly unknown[] },
): {
  used: number;
  left: number;
} {
  const used = batch.people * (1 + batch.eats.length);
  return { used, left: batch.servings - used };
}

/** The batch cooked for this meal, if it's a meal-prep cooking meal. */
export function cookingBatch(
  batches: Batch[],
  plan: MealPlan,
  day: string,
  meal: Meal,
): Batch | undefined {
  return batches.find(
    (b) => b.cookDay === day && b.cookMeal === meal && plan[day]?.[meal] === b.recipeId,
  );
}

/** The batch this meal is leftovers from, if any. */
export function leftoverBatch(
  batches: Batch[],
  plan: MealPlan,
  day: string,
  meal: Meal,
): Batch | undefined {
  return batches.find(
    (b) => plan[day]?.[meal] === b.recipeId && b.eats.some((e) => e.day === day && e.meal === meal),
  );
}

/**
 * Saves a batch (new or changed): its leftover meals are planned, and meals it no longer covers
 * are cleared. Meals that already hold another recipe are left alone.
 */
export function saveBatch(
  plan: MealPlan,
  batches: Batch[],
  batch: Batch,
): { plan: MealPlan; batches: Batch[] } {
  const before = batches.find((b) => b.id === batch.id);
  const keep = new Set(batch.eats.map((e) => slotKey(e.day, e.meal)));
  let next = setMeal(plan, batch.cookDay, batch.cookMeal, batch.recipeId);
  for (const e of before?.eats ?? []) {
    if (!keep.has(slotKey(e.day, e.meal)) && next[e.day]?.[e.meal] === before!.recipeId) {
      next = setMeal(next, e.day, e.meal, undefined);
    }
  }
  const eats = batch.eats.filter((e) => {
    const there = next[e.day]?.[e.meal];
    return !there || there === batch.recipeId;
  });
  for (const e of eats) next = setMeal(next, e.day, e.meal, batch.recipeId);
  return {
    plan: next,
    batches: [...batches.filter((b) => b.id !== batch.id), { ...batch, eats }],
  };
}

/**
 * The batch ran out (eaten sooner, or it went off): its leftover meals from `today` on are
 * cleared so something else can be planned, and the batch is forgotten.
 */
export function finishBatch(
  plan: MealPlan,
  batches: Batch[],
  id: string,
  today: string,
): { plan: MealPlan; batches: Batch[] } {
  const batch = batches.find((b) => b.id === id);
  if (!batch) return { plan, batches };
  let next = plan;
  for (const e of batch.eats) {
    if (e.day >= today && next[e.day]?.[e.meal] === batch.recipeId) {
      next = setMeal(next, e.day, e.meal, undefined);
    }
  }
  return { plan: next, batches: batches.filter((b) => b.id !== id) };
}

/**
 * After one meal is changed by hand: it's no longer a batch's leftovers, and a batch whose
 * cooking meal changed to another recipe (or was cleared) goes, along with its leftover meals.
 */
export function afterMealChange(
  plan: MealPlan,
  batches: Batch[],
  day: string,
  meal: Meal,
): { plan: MealPlan; batches: Batch[] } {
  let next = plan;
  const kept: Batch[] = [];
  for (const b of batches) {
    if (b.cookDay === day && b.cookMeal === meal && plan[day]?.[meal] !== b.recipeId) {
      for (const e of b.eats) {
        if (next[e.day]?.[e.meal] === b.recipeId) next = setMeal(next, e.day, e.meal, undefined);
      }
      continue;
    }
    kept.push({ ...b, eats: b.eats.filter((e) => !(e.day === day && e.meal === meal)) });
  }
  return { plan: next, batches: kept };
}

/** How many days after cooking the meal prep grid and leftovers reach. */
export const BATCH_DAYS = 7;

/**
 * How long cooked food keeps in the fridge (at 4 °C or below, cooled and covered within two
 * hours), in days after the cooking day. Most leftovers: 3–4 days (USDA/FSIS), so 3. Cooked
 * rice: within a day (UK NHS/FSA), so 1. People can change it for each batch.
 */
export function keepDaysFor(recipe: { title: string; ingredients: { name: string }[] }): number {
  const words = [recipe.title, ...recipe.ingredients.map((i) => i.name)].join(' ').toLowerCase();
  return /\brice\b|\bbiryani\b|\bpilaf\b|\bpilau\b|\bpolo\b|\brisotto\b|\bpaella\b|\bsushi\b/.test(
    words,
  )
    ? 1
    : 3;
}

/** The last day a batch is good for. */
export const goodUntil = (batch: Pick<Batch, 'cookDay' | 'keepDays'>) =>
  dateKey(addDays(fromDateKey(batch.cookDay), batch.keepDays ?? 3));

/** True when eating from the batch on `day` would be after it's good. */
export const pastGood = (batch: Pick<Batch, 'cookDay' | 'keepDays'>, day: string) =>
  day > goodUntil(batch);

/**
 * Batches in the fridge on `day`: cooked that day or before, and still good (or still planned
 * to be eaten, so it shows until then).
 */
export function fridgeBatches(batches: Batch[], plan: MealPlan, day: string): Batch[] {
  return batches
    .filter(
      (b) =>
        plan[b.cookDay]?.[b.cookMeal] === b.recipeId &&
        b.cookDay <= day &&
        (day <= goodUntil(b) || b.eats.some((e) => e.day >= day)),
    )
    .sort((a, b) => goodUntil(a).localeCompare(goodUntil(b)));
}

/**
 * Batches a meal can be eaten from: cooked before it (same day counts if it's a later meal),
 * within the week after, with enough left for another meal; the one to eat first comes first.
 * Ones past their good-until day are included (the screen asks first).
 */
export function batchesFor(batches: Batch[], plan: MealPlan, day: string, meal: Meal): Batch[] {
  return batches
    .filter((b) => {
      if (plan[b.cookDay]?.[b.cookMeal] !== b.recipeId) return false;
      const after =
        b.cookDay < day || (b.cookDay === day && MEALS.indexOf(b.cookMeal) < MEALS.indexOf(meal));
      const soon = day <= dateKey(addDays(fromDateKey(b.cookDay), BATCH_DAYS - 1));
      const already = b.eats.some((e) => e.day === day && e.meal === meal);
      return after && soon && !already && batchUse(b).left >= b.people;
    })
    .sort((a, b) => goodUntil(a).localeCompare(goodUntil(b)));
}

/** Eats one more meal from a batch. */
export function eatFromBatch(batch: Batch, day: string, meal: Meal): Batch {
  return { ...batch, eats: [...batch.eats, { day, meal }] };
}
