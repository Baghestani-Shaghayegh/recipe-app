# Recipe App — Feature Plan

## Must-have features (MVP)

These are the core of the app. Build them first, in roughly this order.

### 1. My Recipes (write down and save recipes)
- Add, edit and delete a recipe
- Fields: title, photo, ingredients (amount + unit + name), steps, servings
- Prep time + cook time (total time is calculated)
- Notes field (for example "use less salt next time")
- Source link (where the recipe came from)

### 2. Categories and tags
- Categories: Breakfast, Lunch, Dinner, Dessert, Snack, Drinks
- Free tags: vegetarian, spicy, quick, Persian, meal-prep, …
- A recipe can have one category and many tags

### 3. Search and filters
- Search by name or ingredient
- Filter by category, tag, and time ("under 15 min", "under 30 min", "under 1 hour")

### 4. "What can I make?" (recommend from ingredients I have)
- Keep a simple **My Pantry** list (eggs, rice, onion, …)
- Score each recipe by how many of its ingredients you already have
- Show "You can make this now" and "Missing 1–2 ingredients" groups
- Combine with filters: "dinner, under 30 min, with what I have"
- Ignore basics like salt, pepper, oil and water when scoring

### 5. Nutrition
- Calories, protein, carbs, fat (per serving and per recipe)
- Calculated from the ingredient list using a nutrition database
  (the free USDA FoodData Central API is a good start; Edamam or Spoonacular are paid alternatives)
- Show it as an estimate; let the user correct it by hand

### 6. Import from an Instagram link
- Paste (or share) an Instagram post/reel link → the app creates a draft recipe
- How it works:
  1. Get the post caption (most recipe creators put the recipe in the caption)
  2. Use AI to turn the caption into title, ingredients, steps and time
  3. Show the draft so the user can fix it before saving
  4. Keep the original link and thumbnail on the recipe
- Things to know:
  - Instagram has no open API for reading posts. Getting the caption needs Meta's
    oEmbed API (requires a Meta developer app) or the user pasting the caption.
  - Some reels only say the recipe out loud with no caption. Those need the audio
    transcribed, so leave that for later.
  - Always have a fallback: "Paste the caption here" if the link can't be read.

### 7. "What to make next" list
- A simple queue: add any recipe with one tap
- Reorder it, and check a recipe off when you've cooked it
- "Cooked" history with the date

---

## Nice-to-have features (add later)

### Planning and shopping
- ✅ **Weekly meal planner**: put recipes on days of the week (tap to add; no drag yet)
- ✅ **Shopping list**: made from the "make next" list and the meal plan, minus what's in My Pantry
- ✅ Group the shopping list by store section (produce, dairy, …)

### Better recipes
- ✅ **Scale servings**: change 2 → 6 servings and the amounts update
- ✅ **Unit conversion**: cups ↔ ml, oz ↔ g, °F ↔ °C (volume ↔ weight such as cups ↔ grams is not done)
- ✅ **Cooking mode**: big text, one step at a time, screen stays on
- ✅ **Timers** inside the steps (in-app only, no background alerts)
- ✅ **Ratings** (1–5 stars; no separate "would make again")
- ✅ **Favorites**

### More import options
- ✅ Import from any recipe website (most use a standard recipe format that's easy to read)
- ✅ Import from TikTok and YouTube links (description / caption only, not speech)
- Scan a photo of a cookbook page or handwritten recipe
- Transcribe recipe videos that have no caption

### Smarter recommendations
- ✅ "Use it up": suggest recipes with ingredients that expire soon
- Suggestions based on what you cook and rate highly
- ✅ Ingredient substitutions ("no buttermilk? use milk + lemon"), built-in list shown for missing ingredients
- ✅ Diet filters: vegetarian, vegan, gluten-free, dairy-free, nut-free, high-protein (keyword-based, not allergy-safe)

### Nutrition extras
- ✅ Daily/weekly nutrition totals from the meal planner
- ✅ Goals (calories or protein per day)
- Full nutrients (fiber, sugar, sodium, vitamins)

### Social and sync
- Account login and sync between phone and computer
- Share a recipe with a friend as a link
- Shared lists with a partner or family

### Polish
- Dark mode
- Works offline
- ✅ Export / backup all recipes (copy as text; no file export yet)

---

## Suggested build order

| Phase | What | Why |
|-------|------|-----|
| 1 ✅ | Recipes, categories, search/filter | The base everything else uses |
| 2 ✅ | "Make next" list + My Pantry + recommendations | Small effort, big value |
| 3 ✅ | Nutrition | Built-in food table for now; online lookup later |
| 4 ✅ | Instagram import | Link → caption → recipe draft, on the phone; paste-caption fallback. Next: share sheet, AI parsing |
| 5 | Nice-to-haves | Pick by what you miss most while using it |

## Data model (first draft)

- **Recipe**: id, title, photo, category, tags[], servings, prepMinutes, cookMinutes,
  ingredients[], steps[], notes, sourceUrl, nutrition, createdAt
- **Ingredient**: name, amount, unit
- **PantryItem**: name, (optional) expiresOn
- **MakeNextItem**: recipeId, position, addedAt
- **CookedEntry**: recipeId, cookedOn, rating
