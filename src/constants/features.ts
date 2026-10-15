/**
 * What's switched on in this version of the app.
 *
 * Version 1 keeps the app to its one job: save recipes from anywhere, decide what to cook,
 * and buy what's missing. Everything else is built and tested but switched off here, so it can
 * come back in an update by flipping one line. Nothing is deleted.
 */
export const Features = {
  // ---- On in version 1 ----
  /** Cooking mode: big text, one step at a time, timers. */
  cookingMode: true,
  /** − / + servings on a recipe page. */
  scaleServings: true,
  /** Calories, protein, carbs and fat per serving. */
  nutrition: true,

  // ---- Off for now (planned for later updates) ----
  /** Recipe video feed (needs Supabase, moderation, video hosting; turn the microphone permission
   *  in app.json back on for recording videos with sound). */
  discover: false,
  /** Sign in, sync between devices, households, share as link (needs Supabase + account deletion). */
  accounts: false,
  /** Weekly meal plan tab and its nutrition totals and goals. */
  mealPlan: false,
  /** Separate "Make next" tab (its list is shown on the Shopping tab instead). */
  makeNextTab: false,
  /** Vegetarian / vegan / ... filter chips. */
  dietFilters: false,
  /** Heart and star rating on recipes. */
  favoritesAndRatings: false,
  /** Metric / US cups switch on recipe pages. */
  unitSwitch: false,
  /** "No buttermilk? Try ..." under missing ingredients. */
  substitutions: false,
  /** "You might like" suggestions. */
  suggestions: false,
  /** Best-before dates in the pantry and the "Use it up" list. */
  expiryDates: false,
  /** Fiber, sugar and sodium under the nutrition box. */
  extraNutrients: false,
  /** Backup / restore screen. */
  backup: false,
  /** Hashtag chips on the Recipes tab. */
  tagFilters: false,
} as const;
