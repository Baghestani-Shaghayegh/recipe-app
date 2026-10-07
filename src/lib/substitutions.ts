import { normalizeWords } from './pantry';

type Entry = { names: string[]; swaps: string[] };

// Per 1 of the ingredient unless it says otherwise. Common kitchen swaps; results can differ a little.
const ENTRIES: Entry[] = [
  {
    names: ['buttermilk'],
    swaps: [
      '1 cup milk + 1 tbsp lemon juice or vinegar (rest 5 min)',
      'plain yogurt thinned with milk',
    ],
  },
  {
    names: ['egg'],
    swaps: [
      'baking: 1 tbsp ground flax + 3 tbsp water (rest 5 min)',
      'baking: ¼ cup applesauce or mashed banana',
      'baking: ¼ cup plain yogurt',
    ],
  },
  {
    names: ['butter'],
    swaps: [
      'margarine (same amount)',
      'olive or other oil (¾ of the amount)',
      'coconut oil (same amount)',
    ],
  },
  {
    names: ['milk'],
    swaps: ['oat, soy or almond milk (same amount)', '½ cup evaporated milk + ½ cup water per cup'],
  },
  {
    names: ['cream', 'heavy cream', 'whipping cream', 'double cream'],
    swaps: [
      '¾ cup milk + ¼ cup melted butter per cup',
      'coconut cream',
      'mascarpone thinned with milk',
    ],
  },
  { names: ['sour cream'], swaps: ['plain or Greek yogurt (same amount)'] },
  {
    names: ['yogurt', 'yoghurt'],
    swaps: ['sour cream (same amount)', 'buttermilk (a little thinner)'],
  },
  { names: ['cream cheese'], swaps: ['mascarpone', 'strained ricotta', 'thick Greek yogurt'] },
  { names: ['mozzarella'], swaps: ['provolone', 'young Gouda'] },
  { names: ['parmesan', 'parmigiano'], swaps: ['pecorino', 'grana padano'] },
  { names: ['ricotta'], swaps: ['cottage cheese (drained, blended if you like)'] },
  { names: ['mayonnaise', 'mayo'], swaps: ['Greek yogurt', 'sour cream'] },
  {
    names: ['baking powder'],
    swaps: [
      '¼ tsp baking soda + ½ tsp cream of tartar per 1 tsp',
      '¼ tsp baking soda + ½ cup buttermilk (cut other liquid)',
    ],
  },
  {
    names: ['baking soda', 'bicarbonate of soda'],
    swaps: ['3 tsp baking powder per 1 tsp (skip some of the salt)'],
  },
  {
    names: ['sugar', 'white sugar', 'caster sugar', 'granulated sugar'],
    swaps: [
      '¾ cup honey or maple syrup per cup (cut liquid a little)',
      'brown sugar (same amount)',
    ],
  },
  {
    names: ['brown sugar'],
    swaps: ['1 cup white sugar + 1 tbsp molasses', 'white sugar (same amount; less moist)'],
  },
  { names: ['honey'], swaps: ['maple syrup (same amount)', 'agave syrup'] },
  {
    names: ['cornstarch', 'corn starch', 'cornflour'],
    swaps: ['2 tbsp flour per 1 tbsp cornstarch', 'arrowroot or potato starch (same amount)'],
  },
  {
    names: ['flour', 'all-purpose flour', 'plain flour', 'all purpose flour'],
    swaps: ['gluten-free flour blend (1:1)', 'whole wheat flour (a little less)'],
  },
  {
    names: ['self-raising flour', 'self raising flour', 'self-rising flour'],
    swaps: ['1 cup flour + 1½ tsp baking powder + ¼ tsp salt'],
  },
  {
    names: ['lemon juice'],
    swaps: ['lime juice (same amount)', 'white wine vinegar (half the amount)'],
  },
  { names: ['lemon'], swaps: ['lime'] },
  { names: ['lime'], swaps: ['lemon'] },
  {
    names: ['vinegar', 'white vinegar', 'white wine vinegar'],
    swaps: ['lemon or lime juice (same amount)', 'apple cider vinegar'],
  },
  {
    names: ['white wine'],
    swaps: ['chicken or vegetable stock + a splash of vinegar', 'dry vermouth'],
  },
  {
    names: ['red wine'],
    swaps: ['beef or vegetable stock + a splash of vinegar', 'grape juice + a splash of vinegar'],
  },
  {
    names: ['soy sauce'],
    swaps: ['tamari (gluten-free)', 'coconut aminos', 'Worcestershire sauce (use less)'],
  },
  {
    names: ['breadcrumb', 'bread crumb', 'panko'],
    swaps: ['crushed crackers or cornflakes', 'rolled oats'],
  },
  { names: ['garlic'], swaps: ['⅛ tsp garlic powder per clove', 'a little garlic paste'] },
  {
    names: ['onion', 'yellow onion', 'white onion'],
    swaps: ['1 tbsp onion powder per medium onion', 'shallots or leeks (same amount)'],
  },
  { names: ['shallot'], swaps: ['red onion or a little yellow onion'] },
  { names: ['ginger'], swaps: ['¼ tsp ground ginger per 1 tbsp fresh'] },
  {
    names: ['parsley', 'basil', 'oregano', 'thyme', 'rosemary', 'dill', 'mint', 'sage'],
    swaps: ['dried version: 1 tsp per 1 tbsp fresh'],
  },
  {
    names: ['tomato paste'],
    swaps: ['3 tbsp tomato sauce per 1 tbsp, simmered down', 'ketchup (a little sweeter)'],
  },
  {
    names: ['chicken stock', 'chicken broth'],
    swaps: ['vegetable stock', 'bouillon cube + water'],
  },
  {
    names: ['vegetable stock', 'vegetable broth'],
    swaps: ['chicken stock', 'bouillon cube + water'],
  },
  {
    names: ['dijon mustard', 'mustard'],
    swaps: ['yellow mustard (milder)', '1 tsp mustard powder + 1 tsp water + 1 tsp vinegar'],
  },
  { names: ['paprika'], swaps: ['chili powder (use less)', 'sweet pepper flakes'] },
  { names: ['cumin'], swaps: ['coriander + a pinch of chili powder', 'caraway (a little less)'] },
  { names: ['cinnamon'], swaps: ['allspice or nutmeg (a little less)'] },
  {
    names: ['vanilla extract', 'vanilla'],
    swaps: ['maple syrup (same amount)', 'a little vanilla sugar'],
  },
  { names: ['cocoa powder', 'cocoa'], swaps: ['carob powder (same amount)'] },
  {
    names: ['chocolate', 'dark chocolate'],
    swaps: ['3 tbsp cocoa + 1 tbsp butter or oil per 1 oz (28 g)'],
  },
  {
    names: ['pasta', 'spaghetti', 'penne'],
    swaps: ['any other pasta shape', 'rice noodles or zucchini noodles'],
  },
  { names: ['rice'], swaps: ['couscous', 'quinoa', 'bulgur'] },
];

// Words that don't change what the ingredient is ("unsalted butter" is still butter).
const HARMLESS = new Set([
  'unsalted',
  'salted',
  'whole',
  'skim',
  'skimmed',
  'low',
  'fat',
  'plain',
  'unsweetened',
  'extra',
  'virgin',
  'large',
  'medium',
  'small',
  'organic',
  'free',
  'range',
]);

const key = (words: string[]) => words.join(' ');

const LOOKUP = new Map<string, string[]>();
for (const e of ENTRIES) for (const n of e.names) LOOKUP.set(key(normalizeWords(n)), e.swaps);

/**
 * Ideas for replacing an ingredient you don't have, or undefined if none are known.
 * Only exact matches count: "unsalted butter" gets butter swaps, "peanut butter" gets none.
 */
export function findSubstitutions(ingredientName: string): string[] | undefined {
  const words = normalizeWords(ingredientName).filter((w) => !HARMLESS.has(w));
  return LOOKUP.get(key(words));
}
