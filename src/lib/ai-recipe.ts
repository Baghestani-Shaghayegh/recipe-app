/**
 * The smart recipe reader: sends recipe text in any language to the parse-recipe Supabase
 * function, which uses Claude to translate it to English and sort it into name, ingredients,
 * steps and times. When it isn't set up, is offline or fails, the app's own reader
 * (recipeDraftFromText) is used instead, so importing never gets stuck.
 */
import { parseIngredientList } from './ingredients';
import { CATEGORIES, type Category, type Recipe } from './recipe';
import { recipeDraftFromText } from './recipe-text';
import type { SupabaseConfig } from './supabase';

export type RecipeDraft = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>;
export type DraftExtra = { sourceUrl?: string; photoUri?: string; author?: string; site?: string };

/** What the parse-recipe function answers with. */
export type AiRecipe = {
  isRecipe: boolean;
  language: string;
  title: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  category: string;
  ingredients: string[];
  steps: string[];
  notes: string;
};

const TIMEOUT_MS = 45_000;
const MAX_CHARS = 12_000;

const positive = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;

/** Turns the function's answer into a draft, or undefined when it found no recipe. */
export function draftFromAi(ai: AiRecipe, extra: DraftExtra = {}): RecipeDraft | undefined {
  const ingredients = (ai.ingredients ?? []).map((s) => s.trim()).filter(Boolean);
  const steps = (ai.steps ?? []).map((s) => s.trim()).filter(Boolean);
  if (!ai.isRecipe || (!ingredients.length && !steps.length)) return undefined;
  const translated = ai.language && !/^english$/i.test(ai.language.trim());
  const notes = [
    extra.author ? `From @${extra.author} on ${extra.site ?? 'Instagram'}.` : undefined,
    ai.notes?.trim() || undefined,
    translated ? `Translated from ${ai.language.trim()}.` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    title: ai.title?.trim() || (extra.author ? `Recipe from @${extra.author}` : 'Imported recipe'),
    photoUri: extra.photoUri,
    category: (CATEGORIES as readonly string[]).includes(ai.category)
      ? (ai.category as Category)
      : undefined,
    tags: [],
    servings: positive(ai.servings),
    prepMinutes: positive(ai.prepMinutes),
    cookMinutes: positive(ai.cookMinutes),
    ingredients: parseIngredientList(ingredients.join('\n')),
    steps,
    notes: notes || undefined,
    sourceUrl: extra.sourceUrl,
  };
}

/** Asks the parse-recipe function to read the text. Throws when it can't. */
export async function readWithAi(
  text: string,
  config: SupabaseConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AiRecipe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.url}/functions/v1/parse-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({ text: text.slice(0, MAX_CHARS) }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { recipe?: AiRecipe; error?: string };
    if (!res.ok || !body.recipe) throw new Error(body.error ?? `Recipe reader error ${res.status}`);
    return body.recipe;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The best draft for some recipe text: the smart reader when it's set up and works, otherwise
 * the app's own reader.
 */
export async function smartDraftFromText(
  text: string,
  extra: DraftExtra,
  config: SupabaseConfig | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<RecipeDraft> {
  if (config && text.trim()) {
    try {
      const draft = draftFromAi(await readWithAi(text, config, fetchImpl), extra);
      if (draft) return draft;
    } catch {
      // Offline, not deployed, or the reader failed: fall back below.
    }
  }
  return recipeDraftFromText(text, extra);
}

/** Text in a script other than Latin (Persian, Arabic, Cyrillic, …), so it needs translating. */
export const needsTranslation = (text: string) =>
  /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿ऀ-෿฀-๿぀-ヿ㐀-鿿가-힯]/.test(text);

/** A saved-site recipe written out as text, so the smart reader can translate it. */
export function draftAsText(draft: RecipeDraft): string {
  return [
    draft.title,
    draft.servings ? `Serves ${draft.servings}` : '',
    'Ingredients:',
    ...draft.ingredients.map((i) => i.text),
    'Method:',
    ...draft.steps.map((s, n) => `${n + 1}. ${s}`),
    draft.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}
