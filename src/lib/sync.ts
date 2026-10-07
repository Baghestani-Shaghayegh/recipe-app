import type { Recipe } from './recipe';
import type { RemoteRow, Session, SupabaseClient } from './supabase';

/** The pieces of app data that are synced: the same keys the stores save under on the device. */
export const SYNC_KEYS = [
  'recipes.v1',
  'pantry.v1',
  'expiry.v1',
  'makeNext.v1',
  'cooked.v1',
  'plan.v1',
  'goals.v1',
  'shoppingChecked.v1',
  'shoppingExtras.v1',
] as const;

/** When each key was last changed here (or last matched the server), and whether the server lacks that change. */
export type SyncMeta = Record<string, { updatedAt: number; dirty: boolean }>;

export type Storage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, json: string) => Promise<void>;
};

/** Recipes from both sides by id; the one edited most recently wins. Nothing is dropped. */
export function mergeRecipeLists(local: Recipe[], remote: Recipe[]): Recipe[] {
  const byId = new Map<string, Recipe>();
  for (const r of [...remote, ...local]) {
    const have = byId.get(r.id);
    if (!have || (r.updatedAt ?? 0) >= (have.updatedAt ?? 0)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export type SyncResult = {
  meta: SyncMeta;
  /** Keys whose local data was replaced by newer data from the server. */
  pulled: string[];
  pushed: string[];
};

/**
 * Two-way sync, one key at a time: the newer side wins. A key changed on this device but not yet
 * sent is sent; a key the server has newer is stored here (and `onPulled` tells the app to reload
 * it). The first time a device meets existing server data, recipes are merged rather than replaced,
 * so recipes made before signing in aren't lost.
 */
export async function runSync(args: {
  client: SupabaseClient;
  session: Session;
  scope: string;
  storage: Storage;
  meta: SyncMeta;
  now?: number;
  onPulled?: (key: string, json: string) => void;
}): Promise<SyncResult> {
  const { client, session, scope, storage, onPulled } = args;
  const now = args.now ?? Date.now();
  const meta: SyncMeta = { ...args.meta };
  const remote = new Map((await client.getData(session, scope)).map((r) => [r.key, r]));
  const pulled: string[] = [];
  const push: RemoteRow[] = [];

  for (const key of SYNC_KEYS) {
    const local = await storage.get(key);
    const r = remote.get(key);
    const m = meta[key];

    if (!r) {
      // Nothing on the server yet: send what we have (first sign-in, or a new household).
      if (local !== null) {
        const updatedAt = m?.updatedAt ?? now;
        push.push({ key, value: JSON.parse(local), updatedAt });
        meta[key] = { updatedAt, dirty: false };
      }
      continue;
    }

    if (!m && local !== null && key === 'recipes.v1') {
      // First meeting with this server data: keep recipes from both sides.
      const merged = mergeRecipeLists(JSON.parse(local) as Recipe[], r.value as Recipe[]);
      const json = JSON.stringify(merged);
      await storage.set(key, json);
      onPulled?.(key, json);
      push.push({ key, value: merged, updatedAt: now });
      meta[key] = { updatedAt: now, dirty: false };
      pulled.push(key);
    } else if (m?.dirty && m.updatedAt > r.updatedAt) {
      push.push({ key, value: JSON.parse(local ?? 'null'), updatedAt: m.updatedAt });
      meta[key] = { updatedAt: m.updatedAt, dirty: false };
    } else if (r.updatedAt > (m?.updatedAt ?? 0)) {
      const json = JSON.stringify(r.value);
      await storage.set(key, json);
      onPulled?.(key, json);
      meta[key] = { updatedAt: r.updatedAt, dirty: false };
      pulled.push(key);
    }
  }

  await client.putData(session, scope, push);
  return { meta, pulled, pushed: push.map((p) => p.key) };
}

/** Marks a key as changed here just now. */
export function markChanged(meta: SyncMeta, key: string, now = Date.now()): SyncMeta {
  return { ...meta, [key]: { updatedAt: now, dirty: true } };
}
