# Recipe Box

A personal recipe app for phone and web, built with [Expo](https://expo.dev) (React Native) and Expo Router.
See [FEATURES.md](FEATURES.md) for the full plan.

## Phase 1

- Add, edit and delete recipes: name, photo, category, tags, prep/cook time, servings,
  ingredients, steps, notes and source link
- Search by name, ingredient or tag
- Filter by category, total time (≤ 15 / 30 / 60 min) and tags
- Recipes are saved on the device (AsyncStorage; `localStorage` on web)

## Phase 2

- **Pantry:** list what you have at home (salt, pepper, oil and water are assumed)
- **Cook now:** recipes you can make with your pantry, plus ones missing only 1–2 ingredients,
  with category and time filters. "egg" matches "3 eggs", "lentils" matches "red lentils", etc.
- **Make next:** a to-cook list you can reorder; "Cooked" moves a recipe to your history
- Recipe pages show which ingredients you have and how often you've cooked it

## Phase 3

- **Nutrition per serving** (calories, protein, carbs, fat), estimated from the ingredient list
  using a built-in table of ~120 common foods (`src/lib/foods.ts`, typical USDA values per 100 g)
- Converts cups / tbsp / tsp / g / oz / lb / pieces / cans to grams per food
- Shows which ingredients weren't counted and a per-ingredient breakdown
- You can type in your own numbers for any recipe; they replace the estimate
- Recipe cards show calories per serving (`~` means estimated)

## Phase 4

- **Import from Instagram** (Recipes tab → Import): paste a post or reel link and tap
  *Get recipe*. The phone app reads the caption and photo from Instagram's public embed page.
  Private posts or failures fall back to pasting the caption.
- On the web, browsers block reading Instagram, so you paste the caption; the link is still saved.
- The caption is turned into a recipe on the device (`src/lib/recipe-text.ts`): title, ingredients,
  steps, servings, prep/cook time, hashtags as tags, and a category guess. You review it in the
  normal form before saving. Text it couldn't sort goes into the notes.
- Links can be opened directly: `recipeapp://recipe/import?url=<instagram link>`.

## Shopping list

- **Shopping tab:** everything your Make next recipes need, minus what's in your pantry
  (salt, pepper, oil and water are skipped), grouped by store section
- The same ingredient from several recipes is added up (2 eggs + 3 eggs → 5 eggs; 1 cup + 2 tbsp
  milk → 266 ml) and shows which recipes need it
- Tick items as you shop; *Done* puts ticked items in your pantry, so they drop off the list
- Add your own items (e.g. paper towels); *Copy* puts the list on the clipboard to send or paste

## Import from a recipe website

- Same Import screen: paste any recipe page link and tap *Get recipe*. The app reads the page's
  standard recipe data (schema.org JSON-LD, which most recipe sites include): title, photo,
  ingredients, steps, servings, prep/cook time, tags and a category guess (`src/lib/website.ts`).
- You review the recipe in the normal form before saving; the link is kept as the source.
- Pages with no recipe data, and the web version (browsers block reading other sites), fall back to
  pasting the recipe text.

## Meal plan

- **Plan tab:** a Monday–Sunday week with ‹ › to move between weeks. Tap *+ Add* on a day, search
  your recipes and tap one to plan it; *Remove* takes it off again. Today is highlighted.
- Recipes planned for today or later are added to the **Shopping list** together with Make next
  (a recipe in both is counted once). Past days no longer add anything.
- Saved on the device (`plan.v1`); logic in `src/lib/plan.ts`.

## Favorites and ratings

- On a recipe page, tap the heart to favorite it and the stars to rate it (tap the same star again
  to clear). Cards show ♥ and ★ ratings; the Recipes tab has a *♥ Favorites* filter chip.

## Substitutions

- On a recipe page, an ingredient that isn't in your pantry shows swap ideas underneath when we
  know some ("No buttermilk? Try: 1 cup milk + 1 tbsp lemon juice …"), from a built-in list of ~45
  common swaps (`src/lib/substitutions.ts`). Only exact matches: "peanut butter" gets no butter
  swaps. Needs a pantry with items in it, since "missing" means not in the pantry.

## Use it up

- **Pantry tab:** tap an item to set a best-before date (3 days / 1 week / 2 weeks / 1 month) or
  clear it. Dates show under the item, in red once they're within 3 days or past.
- **Cook now tab:** a *Use it up* section on top lists recipes that use items expiring within 3
  days (or already past), ranked by how many of them they use. The category, time and diet filters
  apply. Logic in `src/lib/expiry.ts`; dates are saved separately (`expiry.v1`).

## Diet filters

- Chips on the Recipes and Cook now tabs: Vegetarian, Vegan, Gluten-free, Dairy-free, Nut-free and
  High-protein (25 g+ per serving); several can be combined.
- A recipe fits if it has that diet as a tag (e.g. `vegan`), or if its ingredient list has no
  matching words (`src/lib/diet.ts`: meat, fish, dairy, egg, honey, gluten, nuts, with exceptions
  like coconut milk or rice flour). **This is a keyword check, not a guarantee: don't rely on it for
  allergies.** Recipes without ingredients never match.

## Unit conversion

- Recipe page: *As written* / *Metric* / *US cups* chips above the ingredients. Cups, tablespoons,
  teaspoons and ml become each other (rounded to kitchen sizes: ¼, ⅓, ½ …), oz / lb and g / kg too,
  and temperatures in the steps switch between °F and °C. Works together with the servings
  stepper and carries into cooking mode. Cloves, cans, pieces etc. stay as written; conversions are
  approximate (volume and weight aren't converted into each other). Logic in `src/lib/units.ts`.

## Cooking mode and timers

- *Start cooking* on a recipe page: one step at a time in big text, *Back* / *Next step*, and the
  screen stays on. *Show ingredients* lists them at the serving size you picked.
- Times in a step ("simmer 30 minutes", "fry 5-7 min") get a *Start timer* button (a range uses the
  shorter time). Several timers can run at once; they vibrate when time is up. Timers only run
  while the cooking screen is open; there are no notifications when the app is in the background.
  Logic in `src/lib/timers.ts`.

## Backup

- Footer of the Recipes tab → *Back up or restore recipes*. *Copy backup* puts all recipes and the
  pantry on the clipboard as text; paste it into a note or email to keep it. *Restore* adds the
  recipes you don't already have (same id) and pantry items; nothing is overwritten.
- Photos stay on the device and aren't part of the backup. Logic in `src/lib/backup.ts`.

## Nutrition totals and goals

- **Plan tab:** each day shows the estimated calories and protein of its planned recipes (one
  serving each), with the percentage of your calorie goal and red when over it. A card at the top
  adds up the week (kcal, protein, carbs, fat) and shows the average on planned days.
- *Daily goals* at the bottom of the tab: calories and protein per day, saved on the device.
- Recipes with no nutrition data are left out and counted in a note. Estimates only, same as the
  recipe pages. Not yet: fiber, sugar, sodium and vitamins (the built-in food table only has
  calories, protein, carbs and fat). Logic in `src/lib/plan-nutrition.ts`.

## Scale servings

- On a recipe page, use − / + next to *Servings* to change the serving size; ingredient amounts
  update (1½ cups → 3 cups, 2 cloves → 1 clove). *Reset* goes back to the saved size.
- Only for viewing: the saved recipe is not changed. Lines without a plain amount ("salt to taste",
  "2-3 eggs") and amounts written in the steps are not scaled.

Not yet: receiving links from Instagram's share sheet (needs a development build, not Expo Go),
and AI parsing for captions without clear structure or reels with spoken-only recipes.

## Run it

```bash
npm install
npm start        # then scan the QR code with the Expo Go app on your phone
npm run web      # or open it in the browser
```

## Checks

```bash
npm test             # unit tests for parsing, search/filter, pantry matching, nutrition, import and the shopping list
npm run typecheck
npm run lint
```

## Code layout

- `src/app/` – screens (Expo Router: every file is a route)
  - `(tabs)/` – the six tabs: `index.tsx` (recipes, search, filters), `cook.tsx`, `next.tsx`, `plan.tsx`, `pantry.tsx`, `shopping.tsx`
  - `recipe/[id].tsx` – recipe details
  - `recipe/edit.tsx` – add / edit form
- `src/lib/` – plain logic: recipe types, filtering, ingredient parsing, pantry matching, nutrition, shopping list, Instagram and caption reading, photo saving
- `src/store/` – data saved on the device: recipes; pantry, make next and cooking history; shopping ticks
- `src/components/ui.tsx` – shared buttons, chips and text fields
- `tests/` – unit tests (run with Node's built-in test runner)
