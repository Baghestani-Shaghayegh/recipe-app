import { createContext, useCallback, useContext, useMemo } from 'react';

import { newPantryItems } from '@/lib/pantry';

import { usePersistedState } from './persisted';

export type MakeNextItem = { recipeId: string; addedAt: number };
export type CookedEntry = { recipeId: string; cookedAt: number };

type KitchenContextValue = {
  loaded: boolean;

  pantry: string[];
  /** Adds items from text like "eggs, milk". Returns how many were new. */
  addToPantry: (text: string) => number;
  removeFromPantry: (item: string) => void;

  makeNext: MakeNextItem[];
  isInMakeNext: (recipeId: string) => boolean;
  toggleMakeNext: (recipeId: string) => void;
  moveMakeNext: (recipeId: string, delta: -1 | 1) => void;

  cooked: CookedEntry[];
  /** Logs the recipe as cooked today and takes it off the make-next list. */
  markCooked: (recipeId: string) => void;
};

const KitchenContext = createContext<KitchenContextValue | null>(null);

/** Pantry, "make next" list and cooking history. */
export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const [pantry, setPantry, pantryLoaded] = usePersistedState<string[]>('pantry.v1', () => []);
  const [makeNext, setMakeNext, nextLoaded] = usePersistedState<MakeNextItem[]>(
    'makeNext.v1',
    () => [],
  );
  const [cooked, setCooked, cookedLoaded] = usePersistedState<CookedEntry[]>('cooked.v1', () => []);

  const addToPantry = useCallback(
    (text: string) => {
      const added = newPantryItems(pantry, text);
      if (added.length) setPantry((prev) => [...added, ...prev]);
      return added.length;
    },
    [pantry, setPantry],
  );

  const removeFromPantry = useCallback(
    (item: string) => setPantry((prev) => prev.filter((p) => p !== item)),
    [setPantry],
  );

  const isInMakeNext = useCallback(
    (recipeId: string) => makeNext.some((m) => m.recipeId === recipeId),
    [makeNext],
  );

  const toggleMakeNext = useCallback(
    (recipeId: string) =>
      setMakeNext((prev) =>
        prev.some((m) => m.recipeId === recipeId)
          ? prev.filter((m) => m.recipeId !== recipeId)
          : [...prev, { recipeId, addedAt: Date.now() }],
      ),
    [setMakeNext],
  );

  const moveMakeNext = useCallback(
    (recipeId: string, delta: -1 | 1) =>
      setMakeNext((prev) => {
        const from = prev.findIndex((m) => m.recipeId === recipeId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= prev.length) return prev;
        const next = [...prev];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      }),
    [setMakeNext],
  );

  const markCooked = useCallback(
    (recipeId: string) => {
      setCooked((prev) => [{ recipeId, cookedAt: Date.now() }, ...prev]);
      setMakeNext((prev) => prev.filter((m) => m.recipeId !== recipeId));
    },
    [setCooked, setMakeNext],
  );

  const value = useMemo(
    () => ({
      loaded: pantryLoaded && nextLoaded && cookedLoaded,
      pantry,
      addToPantry,
      removeFromPantry,
      makeNext,
      isInMakeNext,
      toggleMakeNext,
      moveMakeNext,
      cooked,
      markCooked,
    }),
    [
      pantryLoaded,
      nextLoaded,
      cookedLoaded,
      pantry,
      addToPantry,
      removeFromPantry,
      makeNext,
      isInMakeNext,
      toggleMakeNext,
      moveMakeNext,
      cooked,
      markCooked,
    ],
  );

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen(): KitchenContextValue {
  const ctx = useContext(KitchenContext);
  if (!ctx) throw new Error('useKitchen must be used inside <KitchenProvider>');
  return ctx;
}
