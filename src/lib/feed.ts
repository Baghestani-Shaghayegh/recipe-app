import type { DietId } from './diet';
import { matchRecipe } from './pantry';
import { filterRecipes, type Category, type Recipe } from './recipe';

/** The part of a recipe that's published with a post (no photo, rating, favorite or dates). */
export type PostRecipe = Pick<
  Recipe,
  | 'title'
  | 'category'
  | 'tags'
  | 'servings'
  | 'prepMinutes'
  | 'cookMinutes'
  | 'ingredients'
  | 'steps'
  | 'notes'
  | 'nutrition'
>;

export type FeedPost = {
  id: string;
  authorId: string;
  username: string;
  recipe: PostRecipe;
  videoUrl: string;
  posterUrl?: string;
  likeCount: number;
  saveCount: number;
  createdAt: number;
};

export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

/** What's missing before a recipe can be posted. Empty when it's ready. */
export function postProblems(recipe: Pick<Recipe, 'title' | 'ingredients' | 'steps'>): string[] {
  const problems: string[] = [];
  if (!recipe.title.trim()) problems.push('a name');
  if (!recipe.ingredients.length) problems.push('ingredients');
  if (!recipe.steps.some((s) => s.trim())) problems.push('steps');
  return problems;
}

export function toPostRecipe(r: Recipe): PostRecipe {
  return {
    title: r.title.trim(),
    category: r.category,
    tags: r.tags,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    ingredients: r.ingredients,
    steps: r.steps.filter((s) => s.trim()),
    notes: r.notes,
    nutrition: r.nutrition,
  };
}

/** A post's recipe as a new recipe in your own box, credited to whoever posted it. */
export function recipeFromPost(post: Pick<FeedPost, 'recipe' | 'username'>) {
  const r = post.recipe;
  const credit = `From @${post.username} on Discover.`;
  return {
    title: r.title,
    category: r.category,
    tags: r.tags ?? [],
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    notes: r.notes ? `${credit}\n\n${r.notes}` : credit,
    nutrition: r.nutrition,
  };
}

/** "Ana Cooks!" -> "ana_cooks"; returns why it's not allowed, or undefined if it's fine. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '_').replace(/^@/, '');
}

export function usernameProblem(username: string): string | undefined {
  if (username.length < 3) return 'Use at least 3 characters.';
  if (username.length > 24) return 'Use at most 24 characters.';
  if (!/^[a-z0-9_.]+$/.test(username)) return 'Use only letters, numbers, _ and .';
  return undefined;
}

/** Where a post's file goes in storage: inside the uploader's own folder. */
export function mediaPath(userId: string, ext: string, now = Date.now()): string {
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  return `${userId}/${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
}

export function fileExtension(uri: string, mimeType?: string): string {
  const fromMime = mimeType?.split('/')[1]?.replace('quicktime', 'mov');
  const fromUri = uri.split('?')[0].match(/\.([a-z0-9]{2,4})$/i)?.[1];
  return (fromUri ?? fromMime ?? 'mp4').toLowerCase();
}

export function videoMimeType(ext: string): string {
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
}

export type FeedFilters = {
  category?: Category;
  maxMinutes?: number;
  diets?: DietId[];
  /** Only recipes you have every ingredient for (needs a pantry). */
  canMake?: boolean;
};

function asRecipe(p: FeedPost): Recipe {
  return {
    ...p.recipe,
    id: p.id,
    tags: p.recipe.tags ?? [],
    ingredients: p.recipe.ingredients ?? [],
    steps: p.recipe.steps ?? [],
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  };
}

export function filterFeed(posts: FeedPost[], f: FeedFilters, pantry: string[]): FeedPost[] {
  const keep = new Set(
    filterRecipes(posts.map(asRecipe), {
      query: '',
      tags: [],
      category: f.category,
      maxMinutes: f.maxMinutes,
      diets: f.diets,
    }).map((r) => r.id),
  );
  return posts.filter((p) => {
    if (!keep.has(p.id)) return false;
    if (f.canMake) {
      const m = matchRecipe(asRecipe(p), pantry);
      if (m.missing.length > 0 || m.have.length === 0) return false;
    }
    return true;
  });
}

export function hasFilters(f: FeedFilters): boolean {
  return !!(f.category || f.maxMinutes !== undefined || f.diets?.length || f.canMake);
}

/** 1234 -> "1.2K". */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 100) / 10}K`.replace('.0K', 'K');
  return `${Math.round(n / 100_000) / 10}M`.replace('.0M', 'M');
}
