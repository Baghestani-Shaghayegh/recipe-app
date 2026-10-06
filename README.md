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

## Run it

```bash
npm install
npm start        # then scan the QR code with the Expo Go app on your phone
npm run web      # or open it in the browser
```

## Checks

```bash
npm test             # unit tests for ingredient parsing, search/filter and pantry matching
npm run typecheck
npm run lint
```

## Code layout

- `src/app/` – screens (Expo Router: every file is a route)
  - `(tabs)/` – the four tabs: `index.tsx` (recipes, search, filters), `cook.tsx`, `next.tsx`, `pantry.tsx`
  - `recipe/[id].tsx` – recipe details
  - `recipe/edit.tsx` – add / edit form
- `src/lib/` – plain logic: recipe types, filtering, ingredient parsing, pantry matching, photo saving
- `src/store/` – data saved on the device: recipes, and pantry / make next / cooking history
- `src/components/ui.tsx` – shared buttons, chips and text fields
- `tests/` – unit tests (run with Node's built-in test runner)
