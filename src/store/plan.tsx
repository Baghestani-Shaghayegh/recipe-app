import { createContext, useCallback, useContext, useMemo } from 'react';

import {
  afterMealChange,
  finishBatch as finishPlanBatch,
  normalizePlan,
  saveBatch as savePlanBatch,
  setMeal as setPlanMeal,
  type Batch,
  type Meal,
  type MealPlan,
} from '@/lib/plan';
import type { Goals } from '@/lib/plan-nutrition';

import { usePersistedState } from './persisted';

type PlanContextValue = {
  loaded: boolean;
  plan: MealPlan;
  /** Plans a recipe for one meal, replacing what was there; undefined clears it. */
  setMeal: (day: string, meal: Meal, recipeId: string | undefined) => void;
  /** Meal prep batches: cooked once, eaten again on other meals. */
  batches: Batch[];
  saveBatch: (batch: Batch) => void;
  /** The batch ran out: its leftover meals from today on are freed up. */
  finishBatch: (id: string, today: string) => void;
  /** mealKey()s of planned meals whose ingredients are already on the shopping list. */
  shopped: string[];
  markShopped: (keys: string[]) => void;
  /** Forgets that a recipe's meals are on the shopping list, so Review offers them again. */
  unmarkShopped: (recipeId: string) => void;
  goals: Goals;
  setGoals: (goals: Goals) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/** The meal plan: which recipe is planned for breakfast, lunch and dinner on each day, and meal prep. */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  // Saved plans may be in the older shape (a list per day), so they're read through normalizePlan.
  const [savedPlan, setSavedPlan, loaded] = usePersistedState<unknown>('plan.v1', () => ({}));
  const plan = useMemo(() => normalizePlan(savedPlan), [savedPlan]);
  const [shopped, setShopped, shoppedLoaded] = usePersistedState<string[]>(
    'planShopped.v1',
    () => [],
  );
  const [goals, setGoals, goalsLoaded] = usePersistedState<Goals>('goals.v1', () => ({}));

  const [batches, setBatches, batchesLoaded] = usePersistedState<Batch[]>('batches.v1', () => []);

  // The plan and the batches change together, so these work from the current values of both.
  const setMeal = useCallback(
    (day: string, meal: Meal, recipeId: string | undefined) => {
      const next = afterMealChange(setPlanMeal(plan, day, meal, recipeId), batches, day, meal);
      setSavedPlan(next.plan);
      setBatches(next.batches);
    },
    [plan, batches, setSavedPlan, setBatches],
  );

  const saveBatch = useCallback(
    (batch: Batch) => {
      const next = savePlanBatch(plan, batches, batch);
      setSavedPlan(next.plan);
      setBatches(next.batches);
    },
    [plan, batches, setSavedPlan, setBatches],
  );

  const finishBatch = useCallback(
    (id: string, today: string) => {
      const next = finishPlanBatch(plan, batches, id, today);
      setSavedPlan(next.plan);
      setBatches(next.batches);
    },
    [plan, batches, setSavedPlan, setBatches],
  );

  const markShopped = useCallback(
    (keys: string[]) => setShopped((prev) => [...new Set([...prev, ...keys])]),
    [setShopped],
  );

  const unmarkShopped = useCallback(
    (recipeId: string) => setShopped((prev) => prev.filter((k) => !k.endsWith(`:${recipeId}`))),
    [setShopped],
  );

  const value = useMemo(
    () => ({
      loaded: loaded && batchesLoaded && shoppedLoaded && goalsLoaded,
      plan,
      setMeal,
      batches,
      saveBatch,
      finishBatch,
      shopped,
      markShopped,
      unmarkShopped,
      goals,
      setGoals,
    }),
    [
      loaded,
      batchesLoaded,
      shoppedLoaded,
      goalsLoaded,
      plan,
      setMeal,
      batches,
      saveBatch,
      finishBatch,
      shopped,
      markShopped,
      unmarkShopped,
      goals,
      setGoals,
    ],
  );
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}
