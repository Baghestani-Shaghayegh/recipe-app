import type { RecipeInput } from './recipes';

// Hands a ready-made recipe (e.g. from an Instagram import) to the edit form for review.
// Kept in memory only, and only the latest one.
let latest: { key: string; draft: RecipeInput } | undefined;

/** Stores the draft and returns a key to pass to the edit screen. */
export function setRecipeDraft(draft: RecipeInput): string {
  const key = Date.now().toString(36);
  latest = { key, draft };
  return key;
}

export function getRecipeDraft(key: string): RecipeInput | undefined {
  return latest?.key === key ? latest.draft : undefined;
}
