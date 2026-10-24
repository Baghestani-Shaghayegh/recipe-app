import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RecipeBrowser } from '@/components/recipe-browser';
import { confirm } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import {
  batchesFor,
  batchUse,
  eatFromBatch,
  fromDateKey,
  goodUntil,
  MEAL_LABELS,
  MEALS,
  pastGood,
  type Batch,
  type Meal,
} from '@/lib/plan';
import type { Category, Recipe } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

// Each meal starts on the recipes of the same category; the filter can be cleared.
const MEAL_CATEGORY: Record<Meal, Category> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/** "Add meal" on the Plan tab: your recipes, and tapping one plans it for that meal. */
export default function PickMealScreen() {
  const { day, meal: mealParam } = useLocalSearchParams<{ day: string; meal: string }>();
  const meal: Meal = MEALS.includes(mealParam as Meal) ? (mealParam as Meal) : 'dinner';
  const c = useTheme();
  const { setMeal, plan, batches, saveBatch } = usePlan();
  const { recipes } = useRecipes();
  // Meal prep batches with servings left: this meal can be leftovers from one of them.
  const leftovers = batchesFor(batches, plan, day, meal).flatMap((b) => {
    const recipe = recipes.find((r) => r.id === b.recipeId);
    return recipe ? [{ batch: b, recipe }] : [];
  });
  const label = MEAL_LABELS[meal];
  const weekday = (d: string) => fromDateKey(d).toLocaleDateString(undefined, { weekday: 'short' });
  // After its good-until day: ask first, so nobody eats food that's gone off by accident.
  const eatFrom = async (batch: Batch, recipe: Recipe) => {
    if (pastGood(batch, day)) {
      const ok = await confirm(
        'Too old to eat',
        `${recipe.title} keeps until ${weekday(goodUntil(batch))}. Plan it for ${weekday(day)} anyway?`,
        'Plan anyway',
      );
      if (!ok) return;
    }
    saveBatch(eatFromBatch(batch, day, meal));
    router.back();
  };
  const dayLabel = fromDateKey(day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <Stack.Screen options={{ title: `Choose ${label.toLowerCase()}`, headerBackTitle: 'Plan' }} />
      <RecipeBrowser
        pick={{
          category: MEAL_CATEGORY[meal],
          header: leftovers.length ? (
            <View style={styles.leftovers}>
              <Text style={[styles.heading, { color: c.text }]}>🥡 In your fridge</Text>
              {leftovers.map(({ batch, recipe }) => (
                <Pressable
                  key={batch.id}
                  onPress={() => void eatFrom(batch, recipe)}
                  accessibilityRole="button"
                  accessibilityLabel={`Leftovers: ${recipe.title}`}
                  style={({ pressed }) => [
                    styles.leftover,
                    {
                      backgroundColor: c.prepSoft,
                      borderColor: c.prep,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  {/* Two batches of the same dish are told apart by the day they were cooked. */}
                  {recipe.photoUri ? (
                    <Image
                      source={{ uri: recipe.photoUri }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.thumb, styles.center, { backgroundColor: c.card }]}>
                      <Text style={styles.icon}>🥡</Text>
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                      {recipe.title}
                      {leftovers.some(
                        (o) => o.batch.id !== batch.id && o.recipe.id === recipe.id,
                      ) ? (
                        <Text style={[styles.cooked, { color: c.textSecondary }]}>
                          {' '}
                          · cooked {weekday(batch.cookDay)}
                        </Text>
                      ) : null}
                    </Text>
                    <Text
                      style={[styles.left, { color: pastGood(batch, day) ? c.danger : c.prep }]}>
                      {batchUse(batch).left} left ·{' '}
                      {pastGood(batch, day)
                        ? 'too old to eat'
                        : `good until ${weekday(goodUntil(batch))}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : undefined,
          banner: (
            <>
              Tap a recipe to add it to{' '}
              <Text style={{ fontWeight: '700' }}>
                {label} · {dayLabel}
              </Text>
            </>
          ),
          onPick: (recipe) => {
            setMeal(day, meal, recipe.id);
            router.back();
          },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  leftovers: { gap: Spacing.two },
  heading: { fontSize: 15, fontWeight: '700' },
  leftover: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.two + 2,
  },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700' },
  cooked: { fontSize: 13, fontWeight: '600' },
  left: { fontSize: 13, fontWeight: '700', marginTop: 2 },
});
