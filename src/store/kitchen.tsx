import { createContext, useCallback, useContext, useMemo } from 'react';

import type { Expiry } from '@/lib/expiry';
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
  /** Best-before dates by pantry item. */
  expiry: Expiry;
  /** Sets the date ("2026-10-07") for a pantry item, or clears it with undefined. */
  setExpiry: (item: string, day: string | undefined) => void;

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
  const [expiry, setExpiryState, expiryLoaded] = usePersistedState<Expiry>('expiry.v1', () => ({}));
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

  const setExpiry = useCallback(
    (item: string, day: string | undefined) =>
      setExpiryState((prev) => {
        const { [item]: _old, ...rest } = prev;
        return day ? { ...rest, [item]: day } : rest;
      }),
    [setExpiryState],
  );

  const removeFromPantry = useCallback(
    (item: string) => {
      setPantry((prev) => prev.filter((p) => p !== item));
      setExpiry(item, undefined);
    },
    [setPantry, setExpiry],
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
      loaded: pantryLoaded && nextLoaded && cookedLoaded && expiryLoaded,
      pantry,
      addToPantry,
      removeFromPantry,
      expiry,
      setExpiry,
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
      expiryLoaded,
      pantry,
      addToPantry,
      removeFromPantry,
      expiry,
      setExpiry,
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
