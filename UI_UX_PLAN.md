# UI / UX Plan

Design direction for the recipe app, focused on mobile.

## 1. UX principles

### Design for the kitchen
People use the app with messy hands, the phone propped on the counter, and their attention split.

- **Cook Mode:** a full-screen, one-step-at-a-time view with large text (20–24pt), big tap targets (at least 48pt), and swipe or tap to go to the next step.
- **Keep the screen awake while cooking** with `expo-keep-awake`.
- **Timers inside steps:** "Simmer 10 min" is a tappable button that starts a timer.

### Get people to the recipe fast
- Layout: hero photo → title → quick-facts row (⏱ time · 🍽 servings · 🔥 difficulty · calories).
- A "Jump to recipe" button. Never bury the recipe under a long story.
- Sticky tabs: **Ingredients | Steps | Notes**.

### Interactive ingredients
- Checkboxes to tick off items as they are gathered or used.
- Servings stepper (− 4 +) that rescales quantities automatically.
- Metric / imperial toggle.
- One-tap "Add to shopping list".

### Discovery and organization
- **Home:** search bar, category chips (Breakfast, Vegan, <30 min, …), "Continue cooking" row, featured carousel.
- **Search:** filter by ingredients on hand, diet, time, and cuisine.
- **Saved:** favorites sorted into collections ("Weeknight", "Holiday").
- **Bottom tabs (Expo Router):** Home · Search · Saved · Shopping List · Profile (four or five tabs at most).

### Visual style
- Food photos are the main visual. Large rounded cards (16–20 radius), lots of white space, soft shadows.
- Typography: a warm serif for titles (Playfair Display, Fraunces, DM Serif) and a clean sans for body text (Inter, DM Sans).
- Small touches: haptics on check-off, heart animation on save, skeleton loaders while images load.
- Empty states that invite action ("No saved recipes yet — find something tasty").

## 2. Color palette

Food looks best next to warm, natural colors. Avoid cold blues and purples as the main color because they suppress appetite.

### Chosen: "Warm Kitchen"

| Role | Color | Light | Dark |
|---|---|---|---|
| Primary (buttons, CTAs) | Tomato / terracotta | `#E4572E` | `#F06A43` |
| Secondary | Sage green | `#7A9E7E` | `#8FB393` |
| Accent | Saffron / mustard | `#F2A541` | `#F2A541` |
| Background | Warm cream / warm near-black | `#FFF8F0` | `#1C1714` |
| Surface (cards) | White / dark brown | `#FFFFFF` | `#2A231E` |
| Text primary | Espresso / cream | `#2B2118` | `#F5EDE4` |
| Text secondary | Warm gray | `#7D7068` | `#B3A79D` |
| Border / divider | Light sand | `#EFE4D8` | `#3A312A` |

### Alternatives
- **Fresh & Healthy** (healthy-eating or meal-prep angle): primary avocado `#5B8C51`, accent citrus `#FFB627`, background `#F7FAF5`, text `#1F2A1D`.
- **Bold & Modern** (younger audience): primary paprika `#D7263D`, accent butter yellow `#FFD166`, background `#FAFAF7`, text `#1B1B1E`.

### Color rules
- Use the primary color sparingly, for CTAs, the active tab and the save heart, so photos stay the focus.
- Keep backgrounds neutral and warm so food photos stand out.
- Check text contrast against WCAG AA (4.5:1). Light text on mustard or sage often fails.
- Dark mode uses warm near-black, not pure black, for dim kitchens at night.

## 3. Implementation notes
- Put the colors in one theme file (e.g. `src/constants/theme.ts`) with light and dark tokens, and switch with `useColorScheme()`.
- Navigation via Expo Router tabs in `src/app/`.
- Suggested build order:
  1. Theme tokens + typography
  2. Tab layout
  3. Recipe detail screen (hero, quick facts, ingredients, steps)
  4. Cook Mode
  5. Search filters, collections, shopping list
