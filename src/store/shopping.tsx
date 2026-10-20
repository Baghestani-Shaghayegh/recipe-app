import { createContext, useCallback, useContext, useMemo } from 'react';

import type { StoreSection } from '@/lib/foods';
import type { PlannedShop } from '@/lib/shopping';

import { usePersistedState } from './persisted';

/**
 * Something added to the shopping list by hand ("paper towels"). Lists from an earlier version
 * may also hold ingredients from the meal plan, with an amount, store section and recipes.
 */
export type ShoppingExtra = {
  id: string;
  name: string;
  quantity?: string;
  section?: StoreSection;
  recipes?: string[];
};

type ShoppingContextValue = {
  loaded: boolean;
  /** Keys of ticked items: generated items use their key, extras use `extra:<id>`. */
  checked: string[];
  isChecked: (key: string) => boolean;
  toggleChecked: (key: string) => void;
  extras: ShoppingExtra[];
  /** Adds items from text like "paper towels, coffee". */
  addExtras: (text: string) => void;
  removeExtra: (id: string) => void;
  /** Meals from the plan whose ingredients are on the list. */
  planned: PlannedShop[];
  addPlanned: (meals: PlannedShop[]) => void;
  /** Takes a recipe from the plan off the list. */
  removePlanned: (recipeId: string) => void;
  /** Forgets the ticks and removes ticked extras (after shopping). */
  clearChecked: () => void;
};

export const extraKey = (id: string) => `extra:${id}`;

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [checked, setChecked, checkedLoaded] = usePersistedState<string[]>(
    'shoppingChecked.v1',
    () => [],
  );
  const [extras, setExtras, extrasLoaded] = usePersistedState<ShoppingExtra[]>(
    'shoppingExtras.v1',
    () => [],
  );

  const [planned, setPlanned, plannedLoaded] = usePersistedState<PlannedShop[]>(
    'shoppingPlanned.v1',
    () => [],
  );

  const isChecked = useCallback((key: string) => checked.includes(key), [checked]);

  const toggleChecked = useCallback(
    (key: string) =>
      setChecked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])),
    [setChecked],
  );

  const addExtras = useCallback(
    (text: string) => {
      const names = text
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!names.length) return;
      const now = Date.now().toString(36);
      setExtras((prev) => [
        ...prev,
        ...names.map((name, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name,
        })),
      ]);
    },
    [setExtras],
  );

  const addPlanned = useCallback(
    (meals: PlannedShop[]) => setPlanned((prev) => [...prev, ...meals]),
    [setPlanned],
  );
  const removePlanned = useCallback(
    (recipeId: string) => setPlanned((prev) => prev.filter((p) => p.recipeId !== recipeId)),
    [setPlanned],
  );

  const removeExtra = useCallback(
    (id: string) => {
      setExtras((prev) => prev.filter((e) => e.id !== id));
      setChecked((prev) => prev.filter((k) => k !== extraKey(id)));
    },
    [setExtras, setChecked],
  );

  const clearChecked = useCallback(() => {
    setExtras((prev) => prev.filter((e) => !checked.includes(extraKey(e.id))));
    setChecked([]);
  }, [checked, setExtras, setChecked]);

  const value = useMemo(
    () => ({
      loaded: checkedLoaded && extrasLoaded && plannedLoaded,
      checked,
      isChecked,
      toggleChecked,
      extras,
      addExtras,
      removeExtra,
      planned,
      addPlanned,
      removePlanned,
      clearChecked,
    }),
    [
      checkedLoaded,
      extrasLoaded,
      plannedLoaded,
      checked,
      isChecked,
      toggleChecked,
      extras,
      addExtras,
      removeExtra,
      planned,
      addPlanned,
      removePlanned,
      clearChecked,
    ],
  );

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping(): ShoppingContextValue {
  const ctx = useContext(ShoppingContext);
  if (!ctx) throw new Error('useShopping must be used inside <ShoppingProvider>');
  return ctx;
}
