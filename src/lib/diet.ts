import { servingNutrition } from './nutrition';
import type { Recipe } from './recipe';

export const DIETS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'nut-free', label: 'Nut-free' },
  { id: 'high-protein', label: 'High-protein' },
] as const;
export type DietId = (typeof DIETS)[number]['id'];

/** Grams of protein per serving for the "high-protein" filter. */
export const HIGH_PROTEIN_GRAMS = 25;

type Trait = 'meat' | 'fish' | 'dairy' | 'egg' | 'honey' | 'gluten' | 'nuts';

const WORDS: Record<Trait, string[]> = {
  meat: [
    'chicken',
    'beef',
    'pork',
    'lamb',
    'turkey',
    'duck',
    'bacon',
    'ham',
    'sausage',
    'sausages',
    'salami',
    'prosciutto',
    'mince',
    'veal',
    'steak',
    'ribs',
    'chorizo',
    'pepperoni',
    'goat',
    'gelatin',
    'gelatine',
    'lard',
    'meat',
    'meatballs',
    'venison',
  ],
  fish: [
    'fish',
    'salmon',
    'tuna',
    'cod',
    'shrimp',
    'shrimps',
    'prawn',
    'prawns',
    'anchovy',
    'anchovies',
    'sardine',
    'sardines',
    'mackerel',
    'trout',
    'tilapia',
    'crab',
    'lobster',
    'squid',
    'calamari',
    'scallop',
    'scallops',
    'mussel',
    'mussels',
    'clam',
    'clams',
    'oyster',
    'oysters',
    'haddock',
    'seafood',
  ],
  dairy: [
    'milk',
    'butter',
    'ghee',
    'cream',
    'cheese',
    'cheddar',
    'mozzarella',
    'parmesan',
    'feta',
    'ricotta',
    'yogurt',
    'yoghurt',
    'paneer',
    'mascarpone',
    'buttermilk',
    'whey',
    'custard',
    'halloumi',
    'kefir',
    'gouda',
    'brie',
  ],
  egg: ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue'],
  honey: ['honey'],
  gluten: [
    'wheat',
    'flour',
    'bread',
    'breadcrumb',
    'breadcrumbs',
    'pasta',
    'spaghetti',
    'noodle',
    'noodles',
    'couscous',
    'bulgur',
    'semolina',
    'barley',
    'rye',
    'seitan',
    'tortilla',
    'tortillas',
    'pita',
    'bun',
    'buns',
    'cracker',
    'crackers',
    'biscuit',
    'biscuits',
    'beer',
    'cake',
    'pastry',
    'dough',
    'farro',
    'orzo',
    'lasagna',
    'lasagne',
    'macaroni',
    'panko',
    'croutons',
    'pizza',
    'baguette',
    'naan',
  ],
  nuts: [
    'almond',
    'almonds',
    'walnut',
    'walnuts',
    'pecan',
    'pecans',
    'cashew',
    'cashews',
    'pistachio',
    'pistachios',
    'hazelnut',
    'hazelnuts',
    'peanut',
    'peanuts',
    'macadamia',
    'nut',
    'nuts',
    'praline',
    'marzipan',
    'nutella',
  ],
};

// Phrases that contain a trigger word but don't mean what it suggests ("coconut milk" has no dairy).
const NOT_THE_REAL_THING: [RegExp, Trait][] = [
  [
    /\b(?:coconut|almond|oat|soy|soya|rice|cashew|hazelnut) (?:milk|cream|butter|yogh?urt)\b/g,
    'dairy',
  ],
  [/\b(?:cocoa|shea|peanut|nut|almond|cashew) butter\b/g, 'dairy'],
  [/\bcream of tartar\b/g, 'dairy'],
  [/\bice cream\b/g, 'egg'],
  [/\beggplants?\b/g, 'egg'],
  [/\b(?:butternut|nutmeg|coconut|chestnuts?|water chestnuts?|doughnuts?)\b/g, 'nuts'],
  [
    /\b(?:buckwheat|rice|corn|cornflour|corn ?starch|chickpea|gram|almond|coconut|tapioca|potato|cassava) flour\b/g,
    'gluten',
  ],
  [/\b(?:rice|glass|soba|buckwheat) noodles?\b/g, 'gluten'],
  [/\bgluten[- ]free\b[^,]*/g, 'gluten'],
  [/\b(?:rice|corn|gf) (?:pasta|tortillas?|bread|crackers?)\b/g, 'gluten'],
];

const WORD_SETS = Object.fromEntries(
  Object.entries(WORDS).map(([trait, words]) => [trait, new Set(words)]),
) as Record<Trait, Set<string>>;

/** Which of meat, fish, dairy, egg, honey, gluten and nuts an ingredient line seems to contain. */
export function ingredientTraits(text: string): Set<Trait> {
  const traits = new Set<Trait>();
  const lower = text.toLowerCase();
  const found = (trait: Trait, from: string) =>
    (from.match(/[a-z]+/g) ?? []).some((w) => WORD_SETS[trait].has(w));
  for (const trait of Object.keys(WORDS) as Trait[]) {
    let from = lower;
    for (const [re, t] of NOT_THE_REAL_THING) if (t === trait) from = from.replace(re, ' ');
    // Soy sauce is brewed with wheat.
    if (trait === 'gluten' && /\bsoy sauce\b/.test(lower) && !/gluten[- ]free|tamari/.test(lower)) {
      traits.add(trait);
    }
    if (found(trait, from)) traits.add(trait);
  }
  return traits;
}

/** What the whole ingredient list seems to contain. */
export function recipeTraits(recipe: Pick<Recipe, 'ingredients'>): Set<Trait> {
  const all = new Set<Trait>();
  for (const ing of recipe.ingredients) for (const t of ingredientTraits(ing.name)) all.add(t);
  return all;
}

/**
 * Whether a recipe fits a diet. A recipe tagged with the diet (e.g. "vegan") always counts;
 * otherwise the ingredient list is checked by keyword, so it can miss unusual ingredients.
 */
export function fitsDiet(recipe: Recipe, diet: DietId): boolean {
  if (recipe.tags.includes(diet)) return true;
  if (diet === 'high-protein') {
    const n = servingNutrition(recipe);
    return !!n && n.values.protein >= HIGH_PROTEIN_GRAMS;
  }
  if (!recipe.ingredients.length) return false;
  const t = recipeTraits(recipe);
  switch (diet) {
    case 'vegetarian':
      return !t.has('meat') && !t.has('fish');
    case 'vegan':
      return (
        !t.has('meat') && !t.has('fish') && !t.has('dairy') && !t.has('egg') && !t.has('honey')
      );
    case 'gluten-free':
      return !t.has('gluten');
    case 'dairy-free':
      return !t.has('dairy');
    case 'nut-free':
      return !t.has('nuts');
  }
}
