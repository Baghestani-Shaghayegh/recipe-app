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
- Food photos are the main visual. Lots of white space; screens read like a printed cookbook page.
- Lists (ingredients, steps, shopping list) are plain rows with thin dividers, not a card per row. Cards only for recipe tiles in feeds.
- Buttons are rectangular with a small radius (10–12). Pills only for filter chips.
- Typography: **Young Serif** for recipe titles only, **Hanken Grotesk** for everything else. Type scale: 13 / 15 / 17 / 22 / 28.
- Small touches: haptics on check-off, heart animation on save, skeleton loaders while images load.
- Empty states that invite action ("No saved recipes yet — find something tasty").

## 2. Color palette

Food looks best next to warm, natural colors. Avoid cold blues and purples as the main color because they suppress appetite.

### Chosen: "Warm Kitchen" (refined)

Visual comparison: `design/vibe-picker.html`.

| Role | Color | Light | Dark |
|---|---|---|---|
| Primary (buttons) | Ripe tomato | `#C8412B` | `#C8412B` (fill), `#EE7A63` (text/icons) |
| Secondary (checkmarks, labels) | Olive | `#66733A` | `#A3B062` |
| Accent (timers, highlights) | Saffron | `#E3A23C` | `#E3A23C` |
| Background | Flour white / warm near-black | `#FBFAF8` | `#171311` |
| Surface | White / dark brown | `#FFFFFF` | `#221C19` |
| Text primary | Espresso / cream | `#241A17` | `#F3ECE6` |
| Text secondary | Warm gray | `#776B65` | `#ADA29A` |
| Border / divider | Light sand | `#ECE6E1` | `#342B27` |

Other reds considered (all pass WCAG AA with white text): Sun-dried tomato `#B23A28`, Rhubarb `#C43D4B`.
The original `#E4572E` was dropped because white text on it fails AA contrast.

### Color rules
- Use the primary color sparingly, for CTAs, the active tab and the save heart, so photos stay the focus.
- Keep backgrounds neutral and warm so food photos stand out.
- Check text contrast against WCAG AA (4.5:1). Light text on mustard or sage often fails.
- Dark mode uses warm near-black, not pure black, for dim kitchens at night.

## 3. Avoid the "AI-generated" look

| Giveaway | What we do instead |
|---|---|
| Purple/blue gradients, glowing color blobs | Flat colors taken from food; real photos do the visual work |
| Cream background + terracotta + trendy serif (the "second" AI default) | Flour-white background, deeper tomato red, olive, a cookbook serif only on titles |
| Inter / Geist / Plus Jakarta Sans everywhere | Young Serif + Hanken Grotesk |
| Identical rounded cards with soft shadows, cards inside cards | Plain divided lists; cards only for recipe tiles |
| Pill buttons with trailing arrows ("Get started →") | Rectangular buttons, plain verbs ("Start cooking") |
| Emoji as icons or section headings | One consistent icon set, used sparingly |
| Everything centered, rows of three equal cards | Left-aligned text, mixed tile sizes in feeds |
| Standard font-size ladder (12/14/16/18/24…) | Own scale: 13 / 15 / 17 / 22 / 28 |
| Glassmorphism, neon glow, shadows everywhere | No blur; shadows only on floating things (sheets, timer) |
| Placeholder content (John Doe, lorem ipsum) | Real recipes, real units (g, ml, °C), real photos |
| Sparkle icons, "AI-powered" badges | Name smart features by what they do ("Cook with what's in my fridge") |

## 4. Implementation notes
- Theme lives in `src/constants/theme.ts`: `Colors` (light/dark), `Fonts`, `TypeSize`, `Radius`, `Spacing`; read colors with `useTheme()`.
  - `accent` = red text/icons/tints; `primary` + `onPrimary` = filled buttons and selected chips; `secondary` (olive) = done/have states; `highlight` (saffron) = timers.
  - Custom fonts come one family per weight, so styles set `fontFamily: Fonts.bold` etc. instead of `fontWeight`.
  - Fonts load in `src/app/_layout.tsx`; the splash screen stays up until they are ready.
- Navigation via Expo Router tabs in `src/app/`.
- Suggested build order:
  1. ~~Theme tokens + typography~~ (done)
  2. Tab layout
  3. Recipe detail screen (hero, quick facts, ingredients, steps)
  4. Cook Mode
  5. Search filters, collections, shopping list
