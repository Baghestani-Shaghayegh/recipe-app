import { createContext, useCallback, useContext, useMemo } from 'react';

import { usePersistedState } from './persisted';

/** Something added to the shopping list by hand, e.g. "paper towels". */
export type ShoppingExtra = { id: string; name: string };

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
      loaded: checkedLoaded && extrasLoaded,
      checked,
      isChecked,
      toggleChecked,
      extras,
      addExtras,
      removeExtra,
      clearChecked,
    }),
    [
      checkedLoaded,
      extrasLoaded,
      checked,
      isChecked,
      toggleChecked,
      extras,
      addExtras,
      removeExtra,
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
