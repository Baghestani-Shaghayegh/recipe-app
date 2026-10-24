import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RecipeBrowser } from '@/components/recipe-browser';
import { confirm } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import {
  batchesFor,
  batchUse,
  dateKey,
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
  const params = useLocalSearchParams<{ day?: string; meal?: string }>();
  // Opened without a day (a bare link, or the web build rendering the page): today.
  const day =
    params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : dateKey(new Date());
  const mealParam = params.meal;
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
          // One panel with a row of batches you swipe through, so it stays short however many
          // there are.
          header: leftovers.length ? (
            <View style={[styles.fridge, { backgroundColor: c.prepSoft }]}>
              <View style={styles.fridgeHead}>
                <Text style={[styles.heading, { color: c.text }]}>🥡 In your fridge</Text>
                <Text style={[styles.count, { color: c.prep }]}>{leftovers.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}>
                {leftovers.map(({ batch, recipe }) => {
                  const old = pastGood(batch, day);
                  return (
                    <Pressable
                      key={batch.id}
                      onPress={() => void eatFrom(batch, recipe)}
                      accessibilityRole="button"
                      accessibilityLabel={`Leftovers: ${recipe.title}`}
                      style={({ pressed }) => [
                        styles.tile,
                        {
                          backgroundColor: c.card,
                          borderColor: old ? c.danger : c.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      {recipe.photoUri ? (
                        <Image
                          source={{ uri: recipe.photoUri }}
                          style={styles.photo}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.photo, styles.center, { backgroundColor: c.chip }]}>
                          <Text style={styles.icon}>🍲</Text>
                        </View>
                      )}
                      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                        {recipe.title}
                      </Text>
                      {/* The day it was cooked, which also tells two batches of a dish apart. */}
                      <Text style={[styles.cooked, { color: c.textSecondary }]}>
                        Cooked {weekday(batch.cookDay)}
                      </Text>
                      <Text
                        style={[styles.left, { color: old ? c.danger : c.prep }]}
                        numberOfLines={1}>
                        {old
                          ? 'Too old to eat'
                          : `${batchUse(batch).left} left · until ${weekday(goodUntil(batch))}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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

const TILE = 148;

const styles = StyleSheet.create({
  fridge: { borderRadius: 18, paddingTop: Spacing.three, paddingBottom: Spacing.three, gap: 10 },
  fridgeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three + 2,
  },
  heading: { fontSize: 15, fontWeight: '700' },
  count: { fontSize: 13, fontWeight: '700' },
  row: { gap: 10, paddingHorizontal: Spacing.three + 2 },
  tile: { width: TILE, borderWidth: 1, borderRadius: 14, padding: 8, gap: 4 },
  photo: { width: '100%', aspectRatio: 1.5, borderRadius: 10 },
  center: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 28 },
  title: { fontSize: 14, fontWeight: '700', lineHeight: 18, marginTop: 2 },
  cooked: { fontSize: 12, fontWeight: '600' },
  left: { fontSize: 12, fontWeight: '700' },
});
