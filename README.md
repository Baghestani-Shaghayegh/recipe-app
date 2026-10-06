# Recipe Box

A personal recipe app for phone and web, built with [Expo](https://expo.dev) (React Native) and Expo Router.
See [FEATURES.md](FEATURES.md) for the full plan.

## What works now (phase 1)

- Add, edit and delete recipes: name, photo, category, tags, prep/cook time, servings,
  ingredients, steps, notes and source link
- Search by name, ingredient or tag
- Filter by category, total time (≤ 15 / 30 / 60 min) and tags
- Recipes are saved on the device (AsyncStorage; `localStorage` on web)

## Run it

```bash
npm install
npm start        # then scan the QR code with the Expo Go app on your phone
npm run web      # or open it in the browser
```

## Checks

```bash
npm test             # unit tests for ingredient parsing and search/filter logic
npm run typecheck
npm run lint
```

## Code layout

- `src/app/` – screens (Expo Router: every file is a route)
  - `index.tsx` – recipe list, search and filters
  - `recipe/[id].tsx` – recipe details
  - `recipe/edit.tsx` – add / edit form
- `src/lib/` – plain logic: recipe types, filtering, ingredient parsing, photo saving
- `src/store/recipes.tsx` – loads and saves recipes
- `src/components/ui.tsx` – shared buttons, chips and text fields
- `tests/` – unit tests (run with Node's built-in test runner)
