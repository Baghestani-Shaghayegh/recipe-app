import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Spacing, useTheme } from '@/constants/theme';
import { addDays, dateKey, MEAL_LABELS, MEALS, type Meal } from '@/lib/plan';
import type { Recipe } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

const DAYS_AHEAD = 14;

// Each meal is suggested first for the recipe's own category.
const CATEGORY_MEAL: Partial<Record<string, Meal>> = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
};

/** From a recipe page: pick a day and a meal, and the recipe is planned there. */
export function AddToPlanSheet({
  recipe,
  visible,
  onClose,
  onPlanned,
}: {
  recipe: Recipe;
  visible: boolean;
  onClose: () => void;
  onPlanned: (message: string) => void;
}) {
  const c = useTheme();
  const { plan, setMeal } = usePlan();
  const { recipes } = useRecipes();
  const [day, setDay] = useState(() => dateKey(new Date()));
  const today = new Date();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  const suggested = recipe.category ? CATEGORY_MEAL[recipe.category] : undefined;

  return (
    <BottomSheet visible={visible} title="Add to meal plan" onClose={onClose}>
      {(close) => (
        <View style={styles.body}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.days}>
            {days.map((d, i) => {
              const key = dateKey(d);
              const on = key === day;
              return (
                <Pressable
                  key={key}
                  onPress={() => setDay(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.day,
                    {
                      backgroundColor: on ? c.accent : c.background,
                      borderColor: on ? c.accent : c.border,
                    },
                  ]}>
                  <Text style={[styles.weekday, { color: on ? c.accentText : c.textSecondary }]}>
                    {i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.date, { color: on ? c.accentText : c.text }]}>
                    {d.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {MEALS.map((meal) => {
            const current = recipes.find((r) => r.id === plan[day]?.[meal]);
            const same = current?.id === recipe.id;
            return (
              <Pressable
                key={meal}
                disabled={same}
                onPress={() => {
                  setMeal(day, meal, recipe.id);
                  const when =
                    day === dateKey(today)
                      ? 'today'
                      : days
                          .find((d) => dateKey(d) === day)!
                          .toLocaleDateString(undefined, { weekday: 'long' });
                  close(() => onPlanned(`Planned for ${MEAL_LABELS[meal].toLowerCase()} ${when}.`));
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.meal,
                  {
                    borderColor: meal === suggested ? c.accent : c.border,
                    opacity: same ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}>
                <View style={styles.flex}>
                  <Text style={[styles.mealName, { color: c.text }]}>{MEAL_LABELS[meal]}</Text>
                  <Text style={[styles.mealNow, { color: c.textSecondary }]} numberOfLines={1}>
                    {same
                      ? 'Already planned'
                      : current
                        ? `Replaces ${current.title}`
                        : 'Nothing planned yet'}
                  </Text>
                </View>
                <Ionicons
                  name={same ? 'checkmark' : 'add-circle'}
                  size={26}
                  color={same ? c.textSecondary : c.accent}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, paddingTop: Spacing.two },
  days: { gap: Spacing.two, paddingBottom: Spacing.one },
  day: {
    width: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  weekday: { fontSize: 12 },
  date: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  flex: { flex: 1, minWidth: 0 },
  mealName: { fontSize: 16, fontWeight: '700' },
  mealNow: { fontSize: 13, marginTop: 2 },
});
