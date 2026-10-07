import { formatMinutes, totalMinutes, type Recipe } from './recipe';
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
