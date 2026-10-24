import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RecipeBrowser } from '@/components/recipe-browser';
import { confirm } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
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

  // With leftovers in the fridge, those come first: eating them is what keeps food from waste.
  const [tab, setTab] = useState<'fridge' | 'recipes'>(leftovers.length ? 'fridge' : 'recipes');
  const showFridge = tab === 'fridge' && leftovers.length > 0;

  const banner = (
    <>
      Tap a recipe to add it to{' '}
      <Text style={{ fontWeight: '700' }}>
        {label} · {dayLabel}
      </Text>
    </>
  );

  const tabs = leftovers.length ? (
    <View style={[styles.tabs, { backgroundColor: c.chip }]} accessibilityRole="tablist">
      {(['recipes', 'fridge'] as const).map((t) => {
        const on = (t === 'fridge') === showFridge;
        return (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && { backgroundColor: c.card }]}>
            {t === 'fridge' ? (
              <MaterialCommunityIcons
                name="snowflake"
                size={17}
                color={on ? c.prep : c.textSecondary}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.tabText, { color: on ? c.text : c.textSecondary }]}>
              {t === 'fridge' ? 'In your fridge' : 'Recipes'}
            </Text>
            {t === 'fridge' ? (
              <View style={[styles.badge, { backgroundColor: c.prep }]}>
                <Text style={styles.badgeText}>{leftovers.length}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  ) : undefined;

  return (
    <>
      <Stack.Screen options={{ title: `Choose ${label.toLowerCase()}`, headerBackTitle: 'Plan' }} />
      {showFridge ? (
        <ScrollView
          style={{ backgroundColor: c.background }}
          contentContainerStyle={styles.fridgeList}>
          <Text style={[styles.banner, { color: c.textSecondary }]}>{banner}</Text>
          {tabs}
          {leftovers.map(({ batch, recipe }) => {
            const old = pastGood(batch, day);
            const { left } = batchUse(batch);
            const squares = Math.min(batch.servings, MAX_SQUARES);
            return (
              <Pressable
                key={batch.id}
                onPress={() => void eatFrom(batch, recipe)}
                accessibilityRole="button"
                accessibilityLabel={`Leftovers: ${recipe.title}, ${left} left`}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: c.card,
                    borderColor: old ? c.danger : c.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                {recipe.photoUri ? (
                  <Image source={{ uri: recipe.photoUri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.center, { backgroundColor: c.prepSoft }]}>
                    <Text style={styles.icon}>🍲</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
                    {recipe.title}
                  </Text>
                  {/* The day it was cooked, which also tells two batches of a dish apart. */}
                  <Text style={[styles.cooked, { color: c.textSecondary }]}>
                    Cooked {weekday(batch.cookDay)}
                  </Text>
                  {/* Filled: servings left. Dashed: already planned or eaten. */}
                  <View style={styles.squares}>
                    {Array.from({ length: squares }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.square,
                          i < left
                            ? { backgroundColor: old ? c.danger : c.prep }
                            : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.prepLine },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.left, { color: old ? c.danger : c.prep }]} numberOfLines={1}>
                    {old
                      ? 'Too old to eat'
                      : `${left} left · eat by ${weekday(goodUntil(batch))}`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {/* Kept mounted on the fridge tab, so search and filters are still there when you come back. */}
      <View style={[styles.flex, showFridge && styles.hidden]}>
        <RecipeBrowser
          pick={{
            category: MEAL_CATEGORY[meal],
            header: tabs,
            banner,
            onPick: (recipe) => {
              setMeal(day, meal, recipe.id);
              router.back();
            },
          }}
        />
      </View>
    </>
  );
}

const MAX_SQUARES = 16;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  fridgeList: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  banner: { fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  badge: { borderRadius: 999, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 32 },
  info: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, fontWeight: '700' },
  cooked: { fontSize: 13, fontWeight: '500' },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  square: { width: 11, height: 11, borderRadius: 3 },
  left: { fontSize: 13, fontWeight: '700', marginTop: 1 },
});
