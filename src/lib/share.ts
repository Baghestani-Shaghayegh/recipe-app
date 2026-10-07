import { CATEGORIES, formatMinutes, totalMinutes, type Recipe } from './recipe';
import { scaleIngredientText } from './scale';
import { convertTemperatures, type UnitSystem } from './units';

/**
 * A recipe as plain text for sending to a friend. It uses the "Ingredients" / "Method" headings
 * that the importer looks for, so a friend with this app can paste it into Import and get the
 * recipe back.
 */
export function recipeToText(
  recipe: Recipe,
  options: { factor?: number; servings?: number; units?: UnitSystem } = {},
): string {
  const { factor = 1, servings = recipe.servings, units = 'original' } = options;
  const total = totalMinutes(recipe);
  const facts = [
    servings !== undefined ? `Serves ${servings}` : undefined,
    recipe.prepMinutes !== undefined ? `Prep ${formatMinutes(recipe.prepMinutes)}` : undefined,
    recipe.cookMinutes !== undefined ? `Cook ${formatMinutes(recipe.cookMinutes)}` : undefined,
    total !== undefined && recipe.prepMinutes !== undefined && recipe.cookMinutes !== undefined
      ? `Total ${formatMinutes(total)}`
      : undefined,
  ].filter(Boolean);

  const blocks = [
    [recipe.title, facts.join(' · ')].filter(Boolean).join('\n'),
    recipe.ingredients.length
      ? `Ingredients:\n${recipe.ingredients.map((i) => `- ${scaleIngredientText(i, factor, units)}`).join('\n')}`
      : undefined,
    recipe.steps.length
      ? `Method:\n${recipe.steps.map((s, i) => `${i + 1}. ${convertTemperatures(s, units)}`).join('\n')}`
      : undefined,
    recipe.notes ? `Notes: ${recipe.notes}` : undefined,
    recipe.tags.length ? recipe.tags.map((t) => `#${t}`).join(' ') : undefined,
    recipe.sourceUrl ? `Source: ${recipe.sourceUrl}` : undefined,
  ];
  return blocks.filter(Boolean).join('\n\n');
}

/** What gets published for a shared link: the recipe without your private bits (photo, rating, favorite, ids). */
export function sharedPayload(recipe: Recipe) {
  return {
    title: recipe.title,
    category: recipe.category,
    tags: recipe.tags,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
    sourceUrl: recipe.sourceUrl,
    nutrition: recipe.nutrition,
  };
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const optionalNumber = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const optionalString = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** Reads a recipe fetched from a shared link into a draft for the edit form. Undefined if it isn't one. */
export function recipeFromShared(
  json: unknown,
): Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const r = json as Record<string, unknown>;
  if (typeof r.title !== 'string' || !r.title.trim() || !isStrings(r.steps) || !isStrings(r.tags)) {
    return undefined;
  }
  if (!Array.isArray(r.ingredients)) return undefined;
  const ingredients = r.ingredients.flatMap((i) => {
    if (typeof i !== 'object' || i === null) return [];
    const o = i as Record<string, unknown>;
    if (typeof o.text !== 'string' || typeof o.name !== 'string') return [];
    return [
      {
        text: o.text,
        name: o.name,
        amount: optionalNumber(o.amount),
        unit: optionalString(o.unit),
      },
    ];
  });
  const n = r.nutrition as Record<string, unknown> | undefined;
  const nutrition =
    n && [n.kcal, n.protein, n.carbs, n.fat].every((x) => typeof x === 'number')
      ? {
          kcal: n.kcal as number,
          protein: n.protein as number,
          carbs: n.carbs as number,
          fat: n.fat as number,
        }
      : undefined;
  return {
    title: r.title.trim(),
    category: CATEGORIES.find((c) => c === r.category),
    tags: r.tags,
    servings: optionalNumber(r.servings),
    prepMinutes: optionalNumber(r.prepMinutes),
    cookMinutes: optionalNumber(r.cookMinutes),
    ingredients,
    steps: r.steps,
    notes: optionalString(r.notes),
    sourceUrl: optionalString(r.sourceUrl),
    nutrition,
  };
}
