import { createContext, useCallback, useContext, useMemo } from 'react';

import { addToPlan, removeFromPlan, type MealPlan } from '@/lib/plan';
import type { Goals } from '@/lib/plan-nutrition';

import { usePersistedState } from './persisted';

type PlanContextValue = {
  loaded: boolean;
  plan: MealPlan;
  addToDay: (day: string, recipeId: string) => void;
  removeFromDay: (day: string, recipeId: string) => void;
  goals: Goals;
  setGoals: (goals: Goals) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/** The weekly meal plan: which recipes are planned on which day. */
export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan, loaded] = usePersistedState<MealPlan>('plan.v1', () => ({}));

  const [goals, setGoals, goalsLoaded] = usePersistedState<Goals>('goals.v1', () => ({}));

  const addToDay = useCallback(
    (day: string, recipeId: string) => setPlan((prev) => addToPlan(prev, day, recipeId)),
    [setPlan],
  );
  const removeFromDay = useCallback(
    (day: string, recipeId: string) => setPlan((prev) => removeFromPlan(prev, day, recipeId)),
    [setPlan],
  );

  const value = useMemo(
    () => ({
      loaded: loaded && goalsLoaded,
      plan,
      addToDay,
      removeFromDay,
      goals,
      setGoals,
    }),
    [loaded, goalsLoaded, plan, addToDay, removeFromDay, goals, setGoals],
  );
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}
