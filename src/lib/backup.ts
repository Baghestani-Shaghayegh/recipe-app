import type { Recipe } from './recipe';

const BACKUP_VERSION = 1;

export type Backup = { recipes: Recipe[]; pantry: string[] };

/** All recipes and the pantry as one block of text that can be copied and stored anywhere. */
export function createBackup(data: Backup, now = new Date()): string {
  return JSON.stringify({
    app: 'recipe-box',
    version: BACKUP_VERSION,
    savedAt: now.toISOString(),
    ...data,
  });
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

function isRecipe(v: unknown): v is Recipe {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    isStringArray(r.tags) &&
    isStringArray(r.steps) &&
    Array.isArray(r.ingredients) &&
    r.ingredients.every(
      (i) =>
        typeof i === 'object' && i !== null && typeof (i as { text?: unknown }).text === 'string',
    )
  );
}

export type ParsedBackup = { ok: true; data: Backup } | { ok: false; error: string };

/** Reads text made by createBackup. Recipes that don't look right are skipped, not guessed at. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: 'That doesn’t look like a backup. Paste the whole copied text.' };
  }
  const obj = json as { app?: unknown; version?: unknown; recipes?: unknown; pantry?: unknown };
  if (
    typeof obj !== 'object' ||
    obj === null ||
    obj.app !== 'recipe-box' ||
    !Array.isArray(obj.recipes)
  ) {
    return { ok: false, error: 'That doesn’t look like a backup from this app.' };
  }
  if (obj.version !== BACKUP_VERSION) {
    return { ok: false, error: 'That backup was made by a different version of the app.' };
  }
  return {
    ok: true,
    data: {
      recipes: obj.recipes.filter(isRecipe),
      pantry: isStringArray(obj.pantry) ? obj.pantry : [],
    },
  };
}

/** Adds backed-up recipes that aren't already here (same id), keeping what you have. */
export function mergeRecipes(
  existing: Recipe[],
  incoming: Recipe[],
): { merged: Recipe[]; added: number } {
  const have = new Set(existing.map((r) => r.id));
  const fresh = incoming.filter(
    (r, i) => !have.has(r.id) && incoming.findIndex((o) => o.id === r.id) === i,
  );
  return { merged: [...existing, ...fresh], added: fresh.length };
}
