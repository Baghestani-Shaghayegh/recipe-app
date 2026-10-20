import { createContext, useCallback, useContext, useMemo } from 'react';

import { normalizePlan, setMeal as setPlanMeal, type Meal, type MealPlan } from '@/lib/plan';
import type { Goals } from '@/lib/plan-nutrition';

import { usePersistedState } from './persisted';

type PlanContextValue = {
  loaded: boolean;
  plan: MealPlan;
  /** Plans a recipe for one meal, replacing what was there; undefined clears it. */
  setMeal: (day: string, meal: Meal, recipeId: string | undefined) => void;
  /** mealKey()s of planned meals whose ingredients are already on the shopping list. */
  shopped: string[];
  markShopped: (keys: string[]) => void;
  /** Forgets that a recipe's meals are on the shopping list, so Review offers them again. */
  unmarkShopped: (recipeId: string) => void;
  goals: Goals;
  setGoals: (goals: Goals) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/** The meal plan: which recipe is planned for breakfast, lunch and dinner on each day. */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  // Saved plans may be in the older shape (a list per day), so they're read through normalizePlan.
  const [savedPlan, setSavedPlan, loaded] = usePersistedState<unknown>('plan.v1', () => ({}));
  const plan = useMemo(() => normalizePlan(savedPlan), [savedPlan]);
  const [shopped, setShopped, shoppedLoaded] = usePersistedState<string[]>(
    'planShopped.v1',
    () => [],
  );
  const [goals, setGoals, goalsLoaded] = usePersistedState<Goals>('goals.v1', () => ({}));

  const setMeal = useCallback(
    (day: string, meal: Meal, recipeId: string | undefined) =>
      setSavedPlan((prev: unknown) => setPlanMeal(normalizePlan(prev), day, meal, recipeId)),
    [setSavedPlan],
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
      loaded: loaded && shoppedLoaded && goalsLoaded,
      plan,
      setMeal,
      shopped,
      markShopped,
      unmarkShopped,
      goals,
      setGoals,
    }),
    [
      loaded,
      shoppedLoaded,
      goalsLoaded,
      plan,
      setMeal,
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
