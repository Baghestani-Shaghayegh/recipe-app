import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * useState that is loaded from and saved to device storage.
 * `initial` is used only when nothing has been saved under `key` yet.
 */
export function usePersistedState<T>(
  key: string,
  initial: () => T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((json) => {
        if (json !== null) setValue(JSON.parse(json) as T);
      })
      .catch((e) => console.warn(`Could not load ${key}`, e))
      .finally(() => setLoaded(true));
  }, [key]);

  // Save after every change, but never before the first load (it would wipe saved data).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) =>
      console.warn(`Could not save ${key}`, e),
    );
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}
