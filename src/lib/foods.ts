/**
 * Built-in nutrition table for common ingredients.
 *
 * Values are per 100 g, rounded from typical USDA FoodData Central entries
 * (raw/uncooked unless the name says otherwise). They're averages, so results are estimates.
 *
 * - `cup`: grams in one US cup, used to convert tsp / tbsp / cup / ml / l to grams
 *   (if missing, 1 ml is treated as 1 g, which is right for watery liquids).
 * - `each`: grams in one piece, used for "3 eggs", "2 cloves garlic", "1 slice bread".
 * - `can`: grams in one can.
 * - `bunch`: grams in one bunch.
 */
export type Food = {
  names: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  cup?: number;
  each?: number;
  can?: number;
  bunch?: number;
};

// [names, kcal, protein, carbs, fat, extra]
type Row = [
  string[],
  number,
  number,
  number,
  number,
  Omit<Food, 'names' | 'kcal' | 'protein' | 'carbs' | 'fat'>?,
];

const ROWS: Row[] = [
  // Eggs & dairy
  [['egg'], 143, 12.6, 0.7, 9.5, { each: 50, cup: 243 }],
  [['egg white'], 52, 10.9, 0.7, 0.2, { each: 33, cup: 243 }],
  [['egg yolk'], 322, 15.9, 3.6, 26.5, { each: 17, cup: 243 }],
  [['butter', 'ghee'], 717, 0.9, 0.1, 81, { cup: 227, each: 113 }],
  [['milk', 'whole milk'], 61, 3.2, 4.8, 3.3, { cup: 244 }],
  [['skim milk', 'low fat milk'], 34, 3.4, 5, 0.1, { cup: 245 }],
  [['cream', 'heavy cream', 'whipping cream', 'double cream'], 340, 2.8, 2.7, 36, { cup: 238 }],
  [['sour cream'], 198, 2.4, 4.6, 19, { cup: 230 }],
  [['yogurt', 'yoghurt', 'plain yogurt'], 61, 3.5, 4.7, 3.3, { cup: 245 }],
  [['greek yogurt'], 97, 9, 3.6, 5, { cup: 245 }],
  [['cheese', 'cheddar', 'cheddar cheese'], 403, 25, 1.3, 33, { cup: 113, each: 28 }],
  [['mozzarella', 'mozzarella cheese'], 280, 28, 3.1, 17, { cup: 112 }],
  [['parmesan', 'parmesan cheese', 'parmigiano'], 431, 38, 4.1, 29, { cup: 100 }],
  [['feta', 'feta cheese'], 264, 14, 4.1, 21, { cup: 150 }],
  [['cream cheese'], 342, 6, 4.1, 34, { cup: 232 }],

  // Grains, flour, baking
  [['flour', 'all purpose flour', 'plain flour', 'white flour'], 364, 10.3, 76.3, 1, { cup: 125 }],
  [['whole wheat flour', 'wholemeal flour'], 340, 13.2, 72, 2.5, { cup: 120 }],
  [['sugar', 'white sugar', 'granulated sugar', 'caster sugar'], 387, 0, 100, 0, { cup: 200 }],
  [['brown sugar'], 380, 0.1, 98, 0, { cup: 220 }],
  [['powdered sugar', 'icing sugar', 'confectioners sugar'], 389, 0, 99.8, 0, { cup: 120 }],
  [['honey'], 304, 0.3, 82.4, 0, { cup: 340 }],
  [['maple syrup'], 260, 0, 67, 0.1, { cup: 315 }],
  [
    ['rice', 'white rice', 'basmati rice', 'jasmine rice', 'basmati'],
    365,
    7.1,
    80,
    0.7,
    { cup: 185 },
  ],
  [['brown rice'], 370, 7.9, 77, 2.9, { cup: 190 }],
  [
    ['pasta', 'spaghetti', 'penne', 'macaroni', 'noodle', 'fusilli', 'linguine'],
    371,
    13,
    75,
    1.5,
    { cup: 100 },
  ],
  [['oat', 'oats', 'rolled oat', 'oatmeal'], 389, 16.9, 66, 6.9, { cup: 81 }],
  [['bread', 'toast'], 265, 9, 49, 3.2, { each: 30 }],
  [['tortilla', 'wrap'], 312, 8.3, 52, 7.9, { each: 45 }],
  [['pita', 'pita bread', 'lavash'], 275, 9.1, 55.7, 1.2, { each: 60 }],
  [['couscous'], 376, 12.8, 77, 0.6, { cup: 173 }],
  [['quinoa'], 368, 14, 64, 6, { cup: 170 }],
  [['breadcrumb', 'panko'], 395, 13, 72, 5.3, { cup: 108 }],
  [['cornstarch', 'corn starch', 'cornflour'], 381, 0.3, 91, 0.1, { cup: 128 }],
  [['baking powder'], 53, 0, 28, 0, { cup: 220 }],
  [['baking soda', 'bicarbonate of soda'], 0, 0, 0, 0, { cup: 220 }],
  [['yeast'], 325, 40, 41, 7.6, { cup: 144, each: 7 }],
  [['cocoa', 'cocoa powder'], 228, 19.6, 57.9, 13.7, { cup: 86 }],
  [['chocolate', 'chocolate chip', 'dark chocolate'], 546, 4.9, 61, 31, { cup: 168 }],
  [['vanilla', 'vanilla extract'], 288, 0.1, 12.7, 0.1, { cup: 208 }],

  // Beans, lentils, nuts, seeds
  [['lentil', 'red lentil', 'green lentil', 'brown lentil'], 352, 24.6, 63, 1.1, { cup: 192 }],
  [['chickpea', 'garbanzo'], 139, 7, 22.5, 2.6, { cup: 164, can: 240 }],
  [['kidney bean', 'red kidney bean'], 127, 8.7, 22.8, 0.5, { cup: 177, can: 250 }],
  [['black bean'], 132, 8.9, 23.7, 0.5, { cup: 172, can: 250 }],
  [['white bean', 'cannellini bean', 'navy bean'], 139, 9.7, 25, 0.4, { cup: 179, can: 250 }],
  [['almond'], 579, 21, 22, 50, { cup: 143, each: 1.2 }],
  [['walnut'], 654, 15, 14, 65, { cup: 117, each: 4 }],
  [['peanut'], 567, 26, 16, 49, { cup: 146 }],
  [['pistachio'], 560, 20, 28, 45, { cup: 123 }],
  [['cashew'], 553, 18, 30, 44, { cup: 137 }],
  [['peanut butter'], 588, 25, 20, 50, { cup: 258 }],
  [['tahini', 'sesame paste'], 595, 17, 21, 54, { cup: 240 }],
  [['sesame seed', 'sesame'], 573, 17.7, 23.5, 49.7, { cup: 144 }],
  [['raisin'], 299, 3.1, 79, 0.5, { cup: 145 }],
  [['date', 'medjool date'], 277, 1.8, 75, 0.2, { each: 24, cup: 147 }],

  // Meat, fish, tofu
  [['chicken breast'], 120, 22.5, 0, 2.6, { each: 200 }],
  [['chicken thigh'], 144, 19.7, 0, 7, { each: 110 }],
  [['chicken'], 150, 21, 0, 7, { each: 200 }],
  [['beef', 'steak'], 200, 19, 0, 13, { each: 225 }],
  [['ground beef', 'minced beef', 'beef mince'], 254, 17.2, 0, 20],
  [['lamb'], 282, 16.6, 0, 23.4],
  [['pork'], 211, 18, 0, 15],
  [['bacon'], 417, 13, 1.4, 40, { each: 28 }],
  [['sausage'], 301, 12, 2, 27, { each: 75 }],
  [['ham'], 145, 21, 1.5, 6, { each: 28 }],
  [['salmon'], 208, 20, 0, 13, { each: 170 }],
  [['tuna'], 116, 26, 0, 0.8, { can: 140 }],
  [['white fish', 'cod', 'tilapia', 'fish'], 90, 19, 0, 1, { each: 150 }],
  [['shrimp', 'prawn'], 85, 20, 0, 0.5, { each: 12 }],
  [['tofu'], 144, 17.3, 2.8, 8.7, { cup: 252, each: 400 }],

  // Oils, sauces, condiments
  [
    [
      'oil',
      'olive oil',
      'vegetable oil',
      'canola oil',
      'sunflower oil',
      'sesame oil',
      'cooking oil',
    ],
    884,
    0,
    0,
    100,
    { cup: 216 },
  ],
  [['coconut oil'], 862, 0, 0, 100, { cup: 218 }],
  [['mayonnaise', 'mayo'], 680, 1, 0.6, 75, { cup: 220 }],
  [['ketchup'], 101, 1, 27, 0.1, { cup: 272 }],
  [['mustard'], 60, 3.7, 5.8, 3.3, { cup: 250 }],
  [['soy sauce'], 53, 8, 4.9, 0.6, { cup: 255 }],
  [['vinegar'], 18, 0, 0.1, 0, { cup: 239 }],
  [['tomato paste'], 82, 4.3, 19, 0.5, { cup: 262, can: 170 }],
  [['canned tomato', 'tomato sauce', 'passata'], 32, 1.6, 7.3, 0.3, { cup: 240, can: 400 }],
  [
    [
      'stock',
      'broth',
      'vegetable stock',
      'chicken stock',
      'beef stock',
      'chicken broth',
      'vegetable broth',
    ],
    7,
    0.5,
    1,
    0.2,
    { cup: 237 },
  ],
  [['coconut milk'], 230, 2.3, 6, 24, { cup: 240, can: 400 }],
  [['water'], 0, 0, 0, 0, { cup: 237 }],
  [['salt', 'sea salt', 'kosher salt'], 0, 0, 0, 0, { cup: 288 }],

  // Vegetables
  [
    ['onion', 'red onion', 'yellow onion', 'white onion', 'shallot'],
    40,
    1.1,
    9.3,
    0.1,
    { each: 110, cup: 160 },
  ],
  [
    ['green onion', 'spring onion', 'scallion'],
    32,
    1.8,
    7.3,
    0.2,
    { each: 15, cup: 100, bunch: 100 },
  ],
  [['garlic'], 149, 6.4, 33, 0.5, { each: 3, cup: 136 }],
  [['tomato', 'cherry tomato'], 18, 0.9, 3.9, 0.2, { each: 123, cup: 180 }],
  [['cucumber'], 15, 0.7, 3.6, 0.1, { each: 300, cup: 120 }],
  [['carrot'], 41, 0.9, 9.6, 0.2, { each: 61, cup: 128 }],
  [['potato'], 77, 2, 17.5, 0.1, { each: 213, cup: 150 }],
  [['sweet potato'], 86, 1.6, 20, 0.1, { each: 130, cup: 133 }],
  [
    ['bell pepper', 'red pepper', 'green pepper', 'yellow pepper', 'capsicum'],
    31,
    1,
    6,
    0.3,
    { each: 120, cup: 150 },
  ],
  [['spinach'], 23, 2.9, 3.6, 0.4, { cup: 30, bunch: 340 }],
  [['lettuce', 'romaine'], 15, 1.4, 2.9, 0.2, { cup: 47, each: 600 }],
  [['cabbage'], 25, 1.3, 5.8, 0.1, { cup: 89, each: 900 }],
  [['kale'], 49, 4.3, 8.8, 0.9, { cup: 67, bunch: 200 }],
  [['broccoli'], 34, 2.8, 6.6, 0.4, { cup: 91, each: 300 }],
  [['cauliflower'], 25, 1.9, 5, 0.3, { cup: 107, each: 575 }],
  [['zucchini', 'courgette'], 17, 1.2, 3.1, 0.3, { each: 200, cup: 124 }],
  [['eggplant', 'aubergine'], 25, 1, 5.9, 0.2, { each: 450, cup: 82 }],
  [['mushroom'], 22, 3.1, 3.3, 0.3, { each: 18, cup: 70 }],
  [['celery'], 16, 0.7, 3, 0.2, { each: 40, cup: 101 }],
  [['corn', 'sweetcorn'], 86, 3.3, 19, 1.4, { cup: 145, each: 100, can: 285 }],
  [['pea', 'green pea'], 81, 5.4, 14.5, 0.4, { cup: 145 }],
  [['green bean'], 31, 1.8, 7, 0.2, { cup: 110 }],
  [['avocado'], 160, 2, 8.5, 14.7, { each: 150, cup: 150 }],
  [['olive'], 115, 0.8, 6, 10.7, { each: 4, cup: 135 }],
  [['ginger'], 80, 1.8, 18, 0.8, { cup: 96, each: 15 }],

  // Fruit
  [['lemon'], 29, 1.1, 9.3, 0.3, { each: 84 }],
  [['lemon juice'], 22, 0.4, 6.9, 0.2, { cup: 244 }],
  [['lime'], 30, 0.7, 10.5, 0.2, { each: 67 }],
  [['lime juice'], 25, 0.4, 8.4, 0.1, { cup: 242 }],
  [['apple'], 52, 0.3, 13.8, 0.2, { each: 182, cup: 125 }],
  [['banana'], 89, 1.1, 22.8, 0.3, { each: 118, cup: 150 }],
  [['orange'], 47, 0.9, 11.8, 0.1, { each: 131, cup: 180 }],
  [['orange juice'], 45, 0.7, 10.4, 0.2, { cup: 248 }],
  [['strawberry'], 32, 0.7, 7.7, 0.3, { each: 12, cup: 152 }],
  [['blueberry'], 57, 0.7, 14.5, 0.3, { cup: 148 }],
  [['raspberry'], 52, 1.2, 11.9, 0.7, { cup: 123 }],
  [['berry', 'mixed berry'], 45, 0.8, 10.5, 0.4, { cup: 145 }],
  [['pomegranate'], 83, 1.7, 18.7, 1.2, { each: 280, cup: 174 }],
  [['mango'], 60, 0.8, 15, 0.4, { each: 200, cup: 165 }],
  [['pineapple'], 50, 0.5, 13, 0.1, { cup: 165 }],

  // Herbs & spices
  [['parsley'], 36, 3, 6.3, 0.8, { cup: 60, bunch: 60 }],
  [['cilantro', 'coriander'], 23, 2.1, 3.7, 0.5, { cup: 16, bunch: 60 }],
  [['mint'], 70, 3.8, 15, 0.9, { cup: 50, bunch: 40 }],
  [['basil'], 23, 3.2, 2.7, 0.6, { cup: 24, bunch: 40 }],
  [['dill'], 43, 3.5, 7, 1.1, { cup: 9, bunch: 30 }],
  [['chive'], 30, 3.3, 4.4, 0.7, { cup: 48, bunch: 30 }],
  [['pepper', 'black pepper'], 251, 10, 64, 3.3, { cup: 110 }],
  [['cinnamon'], 247, 4, 81, 1.2, { cup: 125 }],
  [['cumin'], 375, 17.8, 44, 22, { cup: 96 }],
  [['turmeric'], 312, 9.7, 67, 3.3, { cup: 136 }],
  [['paprika', 'chili powder', 'chilli powder'], 282, 14, 54, 13, { cup: 110 }],
  [['saffron'], 310, 11, 65, 6, { cup: 34 }],
];

export const FOODS: Food[] = ROWS.map(([names, kcal, protein, carbs, fat, extra]) => ({
  names,
  kcal,
  protein,
  carbs,
  fat,
  ...extra,
}));
