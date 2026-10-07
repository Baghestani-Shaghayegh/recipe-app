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
npm test             # unit tests for parsing, search/filter, pantry matching, nutrition and import
npm run typecheck
npm run lint
```

## Code layout

- `src/app/` – screens (Expo Router: every file is a route)
  - `(tabs)/` – the four tabs: `index.tsx` (recipes, search, filters), `cook.tsx`, `next.tsx`, `pantry.tsx`
  - `recipe/[id].tsx` – recipe details
  - `recipe/edit.tsx` – add / edit form
- `src/lib/` – plain logic: recipe types, filtering, ingredient parsing, pantry matching, nutrition, Instagram and caption reading, photo saving
- `src/store/` – data saved on the device: recipes, and pantry / make next / cooking history
- `src/components/ui.tsx` – shared buttons, chips and text fields
- `tests/` – unit tests (run with Node's built-in test runner)
