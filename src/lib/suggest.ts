import { normalizeWords } from './pantry';
import type { Recipe } from './recipe';

export type CookedLike = { recipeId: string; cookedAt: number };

export type Suggestion = {
  recipe: Recipe;
  /** The liked recipe it has the most in common with. */
  similarTo: Recipe;
  score: number;
};

const DAY_MS = 86_400_000;
/** Recipes cooked more recently than this aren't suggested again. */
export const RECENT_DAYS = 14;

/** Tags, category and main ingredient words: what two recipes can have in common. */
function features(r: Recipe): Set<string> {
  const f = new Set<string>();
  for (const t of r.tags) f.add(`tag:${t}`);
  if (r.category) f.add(`cat:${r.category}`);
  for (const ing of r.ingredients) {
    const name = normalizeWords(ing.name).join(' ');
    if (name) f.add(`ing:${name}`);
  }
  return f;
}

/** How much you seem to like a recipe: stars, favorite, and how often you've cooked it. */
export function likeWeight(r: Recipe, timesCooked: number): number {
  let w = 0;
  if (r.rating !== undefined) w += r.rating >= 4 ? r.rating - 3 : 0; // 4 stars -> 1, 5 stars -> 2
  if (r.favorite) w += 1;
  w += Math.min(timesCooked, 4) * 0.5;
  return w;
}

/**
 * Recipes you haven't cooked lately that are like the ones you rate highly, favorite or cook a lot.
 * Needs at least one liked recipe. Recipes rated 1–2 stars are never suggested, and neither are ones
 * you already rated 4–5 stars or favorited.
 */
export function suggestForYou(
  recipes: Recipe[],
  cooked: CookedLike[],
  now = Date.now(),
  limit = 5,
): Suggestion[] {
  const counts = new Map<string, number>();
  const lastCooked = new Map<string, number>();
  for (const e of cooked) {
    counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1);
    lastCooked.set(e.recipeId, Math.max(lastCooked.get(e.recipeId) ?? 0, e.cookedAt));
  }

  const liked = recipes
    .map((r) => ({ recipe: r, weight: likeWeight(r, counts.get(r.id) ?? 0), feats: features(r) }))
    .filter((l) => l.weight > 0);
  if (!liked.length) return [];

  const suggestions: Suggestion[] = [];
  for (const r of recipes) {
    // Not ones you rated low, and not ones you already know you love (this is for discovering).
    if (r.rating !== undefined && (r.rating <= 2 || r.rating >= 4)) continue;
    if (r.favorite) continue;
    const last = lastCooked.get(r.id);
    if (last !== undefined && now - last < RECENT_DAYS * DAY_MS) continue;
    const feats = features(r);
    if (!feats.size) continue;
    let score = 0;
    let best: { recipe: Recipe; shared: number } | undefined;
    for (const l of liked) {
      if (l.recipe.id === r.id) continue;
      let shared = 0;
      for (const f of feats) if (l.feats.has(f)) shared++;
      if (!shared) continue;
      // Overlap relative to size, so long ingredient lists don't win just by being long.
      score += (l.weight * shared) / Math.sqrt(feats.size * l.feats.size);
      if (
        !best ||
        shared * l.weight > best.shared * likeWeight(best.recipe, counts.get(best.recipe.id) ?? 0)
      ) {
        best = { recipe: l.recipe, shared };
      }
    }
    if (best && score > 0) suggestions.push({ recipe: r, similarTo: best.recipe, score });
  }
  return suggestions.sort((a, b) => b.score - a.score).slice(0, limit);
}
