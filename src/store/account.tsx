import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  configFromEnv,
  createSupabase,
  shareLink,
  SupabaseError,
  type Household,
  type Session,
} from '@/lib/supabase';
import { markChanged, runSync, SYNC_KEYS, type SyncMeta } from '@/lib/sync';

import { applyPersisted, onPersistedChange, usePersistedState } from './persisted';

const config = configFromEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY,
});
const client = config ? createSupabase(config) : undefined;

const PUSH_DELAY_MS = 3000;
const metaKey = (scope: string) => `syncMeta.v1:${scope}`;

type SyncState = { syncing: boolean; message?: string; error?: boolean; lastSynced?: number };

type AccountContextValue = {
  /** False when the app was built without a Supabase project, so there's nothing to sign in to. */
  configured: boolean;
  loaded: boolean;
  session?: Session;
  household?: Household;
  sync: SyncState;
  signUp: (email: string, password: string) => Promise<string | undefined>;
  signIn: (email: string, password: string) => Promise<string | undefined>;
  signOut: () => void;
  syncNow: () => Promise<void>;
  createHousehold: () => Promise<string | undefined>;
  joinHousehold: (code: string) => Promise<string | undefined>;
  leaveHousehold: () => Promise<string | undefined>;
  /** Publishes the recipe and returns its link, or an error message. */
  shareRecipe: (recipe: unknown) => Promise<{ link?: string; error?: string }>;
  /** Reads a recipe from a shared link's id. Works without signing in. */
  fetchSharedRecipe: (id: string) => Promise<{ recipe?: unknown; error?: string }>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const messageOf = (e: unknown) =>
  e instanceof SupabaseError ? e.message : 'Something went wrong. Please try again.';

/** Sign-in, syncing with the account (or household), sharing. */
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession, sessionLoaded] = usePersistedState<Session | null>(
    'session.v1',
    () => null,
  );
  const [household, setHousehold, householdLoaded] = usePersistedState<Household | null>(
    'household.v1',
    () => null,
  );
  const [sync, setSync] = useState<SyncState>({ syncing: false });

  // Latest values for callbacks that outlive a render (timers, listeners).
  const live = useRef({ session, household });
  useEffect(() => {
    live.current = { session, household };
  }, [session, household]);

  // Sync steps run one at a time, so a change made during a sync isn't lost.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  const freshSession = useCallback(async (): Promise<Session | undefined> => {
    const current = live.current.session;
    if (!client || !current) return undefined;
    if (current.expiresAt - 60_000 > Date.now()) return current;
    const renewed = await client.refresh(current.refreshToken);
    live.current.session = renewed;
    setSession(renewed);
    return renewed;
  }, [setSession]);

  const readMeta = async (scope: string): Promise<SyncMeta> => {
    try {
      return JSON.parse((await AsyncStorage.getItem(metaKey(scope))) ?? '{}') as SyncMeta;
    } catch {
      return {};
    }
  };

  const syncNow = useCallback(
    () =>
      enqueue(async () => {
        if (!client || !live.current.session) return;
        setSync((s) => ({ ...s, syncing: true, message: undefined, error: false }));
        try {
          const s = await freshSession();
          if (!s) return;
          const scope = live.current.household?.id ?? s.userId;
          const started = await readMeta(scope);
          const result = await runSync({
            client,
            session: s,
            scope,
            meta: started,
            storage: {
              get: (k) => AsyncStorage.getItem(k),
              set: (k, json) => AsyncStorage.setItem(k, json),
            },
            onPulled: applyPersisted,
          });
          // Keep changes made while syncing.
          const now = await readMeta(scope);
          const final = { ...result.meta };
          for (const [k, m] of Object.entries(now)) {
            if (m.dirty && m.updatedAt > (started[k]?.updatedAt ?? 0)) final[k] = m;
          }
          await AsyncStorage.setItem(metaKey(scope), JSON.stringify(final));
          setSync({ syncing: false, lastSynced: Date.now() });
        } catch (e) {
          setSync((prev) => ({ ...prev, syncing: false, message: messageOf(e), error: true }));
        }
      }),
    [enqueue, freshSession],
  );

  // Remember what changed on this device, and send it shortly after.
  const pushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const off = onPersistedChange((key) => {
      if (!(SYNC_KEYS as readonly string[]).includes(key) || !live.current.session) return;
      void enqueue(async () => {
        const scope = live.current.household?.id ?? live.current.session?.userId;
        if (!scope) return;
        const meta = markChanged(await readMeta(scope), key);
        await AsyncStorage.setItem(metaKey(scope), JSON.stringify(meta));
      });
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
    });
    return () => {
      off();
      clearTimeout(pushTimer.current);
    };
  }, [enqueue, syncNow]);

  // Sync when the app opens (once signed in) and each time it comes back to the front.
  const userId = session?.userId;
  const householdId = household?.id;
  useEffect(() => {
    if (!sessionLoaded || !householdLoaded || !userId) return;
    void syncNow();
  }, [sessionLoaded, householdLoaded, userId, householdId, syncNow]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => sub.remove();
  }, [syncNow]);

  const startSession = useCallback(
    async (s: Session) => {
      live.current.session = s;
      setSession(s);
      try {
        setHousehold((await client?.myHousehold(s)) ?? null);
      } catch {
        // Keep going without the household; the next sync will tell.
      }
    },
    [setSession, setHousehold],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!client) return 'Sync isn’t set up in this build of the app.';
      try {
        const s = await client.signUp(email.trim(), password);
        if (!s) return 'Check your email to confirm your address, then sign in.';
        await startSession(s);
      } catch (e) {
        return messageOf(e);
      }
    },
    [startSession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!client) return 'Sync isn’t set up in this build of the app.';
      try {
        await startSession(await client.signIn(email.trim(), password));
      } catch (e) {
        return messageOf(e);
      }
    },
    [startSession],
  );

  const signOut = useCallback(() => {
    live.current.session = null;
    setSession(null);
    setHousehold(null);
    setSync({ syncing: false });
  }, [setSession, setHousehold]);

  const withSession = useCallback(
    async <T,>(task: (s: Session) => Promise<T>): Promise<{ value?: T; error?: string }> => {
      try {
        const s = await freshSession();
        if (!client || !s) return { error: 'Sign in first.' };
        return { value: await task(s) };
      } catch (e) {
        return { error: messageOf(e) };
      }
    },
    [freshSession],
  );

  const createHousehold = useCallback(async () => {
    const r = await withSession((s) => client!.createHousehold(s));
    if (r.value) setHousehold(r.value);
    return r.error;
  }, [withSession, setHousehold]);

  const joinHousehold = useCallback(
    async (code: string) => {
      const r = await withSession((s) => client!.joinHousehold(s, code));
      if (r.value) setHousehold(r.value);
      return r.error;
    },
    [withSession, setHousehold],
  );

  const leaveHousehold = useCallback(async () => {
    const r = await withSession((s) => client!.leaveHousehold(s));
    if (!r.error) setHousehold(null);
    return r.error;
  }, [withSession, setHousehold]);

  const shareRecipe = useCallback(
    async (recipe: unknown) => {
      const r = await withSession((s) => client!.shareRecipe(s, recipe));
      return r.value ? { link: shareLink(r.value) } : { error: r.error };
    },
    [withSession],
  );

  const fetchSharedRecipe = useCallback(async (id: string) => {
    if (!client) return { error: 'Sync isn’t set up in this build of the app.' };
    try {
      const recipe = await client.getSharedRecipe(id);
      return recipe ? { recipe } : { error: 'That link doesn’t work any more.' };
    } catch (e) {
      return { error: messageOf(e) };
    }
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      configured: !!client,
      loaded: sessionLoaded && householdLoaded,
      session: session ?? undefined,
      household: household ?? undefined,
      sync,
      signUp,
      signIn,
      signOut,
      syncNow,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      shareRecipe,
      fetchSharedRecipe,
    }),
    [
      sessionLoaded,
      householdLoaded,
      session,
      household,
      sync,
      signUp,
      signIn,
      signOut,
      syncNow,
      createHousehold,
      joinHousehold,
      leaveHousehold,
      shareRecipe,
      fetchSharedRecipe,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used inside <AccountProvider>');
  return ctx;
}
