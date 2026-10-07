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
  - `(tabs)/` – the five tabs: `index.tsx` (recipes, search, filters), `cook.tsx`, `next.tsx`, `pantry.tsx`, `shopping.tsx`
  - `recipe/[id].tsx` – recipe details
  - `recipe/edit.tsx` – add / edit form
- `src/lib/` – plain logic: recipe types, filtering, ingredient parsing, pantry matching, nutrition, shopping list, Instagram and caption reading, photo saving
- `src/store/` – data saved on the device: recipes; pantry, make next and cooking history; shopping ticks
- `src/components/ui.tsx` – shared buttons, chips and text fields
- `tests/` – unit tests (run with Node's built-in test runner)
