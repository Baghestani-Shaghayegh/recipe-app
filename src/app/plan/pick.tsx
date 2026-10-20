import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { RecipeBrowser } from '@/components/recipe-browser';
import { fromDateKey, MEAL_LABELS, MEALS, type Meal } from '@/lib/plan';
import type { Category } from '@/lib/recipe';
import { usePlan } from '@/store/plan';

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
  const { setMeal } = usePlan();
  const label = MEAL_LABELS[meal];
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
