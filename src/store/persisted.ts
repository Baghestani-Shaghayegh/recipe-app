import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

type JsonListener = (json: string) => void;
const externalListeners = new Map<string, Set<JsonListener>>();
const changeListeners = new Set<(key: string) => void>();

/** Tells the stores that `key` was changed outside them (e.g. by sync), so they reload it. */
export function applyPersisted(key: string, json: string): void {
  externalListeners.get(key)?.forEach((listener) => listener(json));
}

/** Calls back whenever a store saves a changed value under `key` (not for the first, unchanged save). */
export function onPersistedChange(listener: (key: string) => void): () => void {
  changeListeners.add(listener);
  return () => void changeListeners.delete(listener);
}

/**
 * useState that is loaded from and saved to device storage.
 * `initial` is used only when nothing has been saved under `key` yet.
 * Changes are announced through onPersistedChange so they can be synced.
 */
export function usePersistedState<T>(
  key: string,
  initial: () => T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [boot] = useState(() => {
    const v = initial();
    return { v, json: JSON.stringify(v) };
  });
  const [value, setValue] = useState<T>(boot.v);
  const [loaded, setLoaded] = useState(false);
  // The text last loaded or saved, to tell real changes from the first, unchanged save.
  const lastJson = useRef<string | null>(null);
  const stored = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((json) => {
        if (json !== null) {
          lastJson.current = json;
          stored.current = true;
          setValue(JSON.parse(json) as T);
        } else {
          lastJson.current = boot.json;
        }
      })
      .catch((e) => console.warn(`Could not load ${key}`, e))
      .finally(() => setLoaded(true));
  }, [key, boot]);

  // Data that arrives from sync replaces the current value.
  useEffect(() => {
    const listener: JsonListener = (json) => {
      lastJson.current = json;
      stored.current = true;
      setValue(JSON.parse(json) as T);
    };
    const set = externalListeners.get(key) ?? new Set();
    set.add(listener);
    externalListeners.set(key, set);
    return () => void set.delete(listener);
  }, [key]);

  // Save after every change, but never before the first load (it would wipe saved data).
  useEffect(() => {
    if (!loaded) return;
    const json = JSON.stringify(value);
    const changed = json !== lastJson.current;
    if (!changed && stored.current) return;
    lastJson.current = json;
    stored.current = true;
    AsyncStorage.setItem(key, json).catch((e) => console.warn(`Could not save ${key}`, e));
    if (changed) changeListeners.forEach((listener) => listener(key));
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}
