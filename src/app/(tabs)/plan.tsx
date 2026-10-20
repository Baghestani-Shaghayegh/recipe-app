import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionSheet } from '@/components/action-sheet';
import { PlanShoppingBar } from '@/components/plan-shopping';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { servingNutrition } from '@/lib/nutrition';
import {
  addDays,
  dateKey,
  MEAL_LABELS,
  MEALS,
  plannedMeals,
  weekDays,
  type Meal,
} from '@/lib/plan';
import { planNutrition } from '@/lib/plan-nutrition';
import { formatMinutes, totalMinutes, type Recipe } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

const BAR_SPACE = 96;

const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Pick a day at the top, then plan its breakfast, lunch and dinner. */
export default function PlanScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { plan, setMeal } = usePlan();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [menu, setMenu] = useState<{ meal: Meal; recipe: Recipe }>();

  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(addDays(today, weekOffset * 7));
  const week = days.map(dateKey);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  // The chosen day stays in the week on screen.
  const day = week.includes(selected) ? selected : week.includes(todayKey) ? todayKey : week[0];
  const dayDate = days[week.indexOf(day)];

  const goToWeek = (offset: number) => {
    setWeekOffset(offset);
    const newWeek = weekDays(addDays(today, offset * 7)).map(dateKey);
    setSelected(newWeek.includes(todayKey) ? todayKey : newWeek[0]);
  };

  const meals = plannedMeals(plan, [day]).filter((m) => byId.has(m.recipeId));
  const kcal = planNutrition(plan, [day], byId).total.kcal;
  const summary = [
    dayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    meals.length ? `${meals.length} meal${meals.length === 1 ? '' : 's'}` : 'Nothing planned',
    Features.nutrition && kcal > 0 ? `~${Math.round(kcal)} kcal` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const pick = (meal: Meal) => router.push({ pathname: '/plan/pick', params: { day, meal } });

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.weekBar}>
          <Pressable
            onPress={() => goToWeek(weekOffset - 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous week">
            <Ionicons name="chevron-back" size={26} color={c.accent} />
          </Pressable>
          <View style={styles.weekTitle}>
            <Text style={[styles.range, { color: c.text }]}>
              {short(days[0])} – {short(days[6])}
            </Text>
            <Pressable
              onPress={() => goToWeek(0)}
              disabled={weekOffset === 0}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={[styles.thisWeek, { color: c.accent }]}>
                {weekOffset === 0 ? 'This week' : 'Back to this week'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => goToWeek(weekOffset + 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next week">
            <Ionicons name="chevron-forward" size={26} color={c.accent} />
          </Pressable>
        </View>

        <View style={styles.strip}>
          {days.map((d, i) => {
            const key = week[i];
            const on = key === day;
            const count = plannedMeals(plan, [key]).filter((m) => byId.has(m.recipeId)).length;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' })}, ${count} meals`}
                style={[
                  styles.day,
                  {
                    backgroundColor: on ? c.accent : c.card,
                    borderColor: on || key === todayKey ? c.accent : c.border,
                  },
                ]}>
                <Text style={[styles.weekday, { color: on ? c.accentText : c.textSecondary }]}>
                  {d.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <Text style={[styles.date, { color: on ? c.accentText : c.text }]}>
                  {d.getDate()}
                </Text>
                <View style={styles.dots}>
                  {Array.from({ length: count }, (_, n) => (
                    <View
                      key={n}
                      style={[styles.dot, { backgroundColor: on ? c.accentText : c.accent }]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View>
          <Text style={[styles.dayTitle, { color: c.text }]}>
            {day === todayKey
              ? 'Today'
              : day === dateKey(addDays(today, 1))
                ? 'Tomorrow'
                : dayDate.toLocaleDateString(undefined, { weekday: 'long' })}
          </Text>
          <Text style={[styles.summary, { color: c.textSecondary }]}>{summary}</Text>
        </View>

        {MEALS.map((meal) => {
          const recipe = byId.get(plan[day]?.[meal] ?? '');
          return recipe ? (
            <MealCard
              key={meal}
              meal={meal}
              recipe={recipe}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
              onLongPress={() => setMenu({ meal, recipe })}
            />
          ) : (
            <MealCard key={meal} meal={meal} onPress={() => pick(meal)} />
          );
        })}

        <Text style={[styles.hint, { color: c.textSecondary }]}>
          Tap a meal to open it. Hold it to change or remove it.
        </Text>
      </ScrollView>

      <PlanShoppingBar week={week} today={todayKey} />

      <ActionSheet
        visible={!!menu}
        title={menu ? `${MEAL_LABELS[menu.meal]}: ${menu.recipe.title}` : undefined}
        onClose={() => setMenu(undefined)}
        actions={
          menu
            ? [
                {
                  label: 'Open recipe',
                  onPress: () => {
                    setMenu(undefined);
                    router.push({ pathname: '/recipe/[id]', params: { id: menu.recipe.id } });
                  },
                },
                {
                  label: 'Choose another recipe',
                  onPress: () => {
                    setMenu(undefined);
                    pick(menu.meal);
                  },
                },
                {
                  label: `Remove from ${MEAL_LABELS[menu.meal].toLowerCase()}`,
                  danger: true,
                  onPress: () => {
                    setMeal(day, menu.meal, undefined);
                    setMenu(undefined);
                  },
                },
              ]
            : []
        }
      />
    </View>
  );
}

/** One meal of the day: the planned recipe, or an "Add meal" card of the same size. */
function MealCard({
  meal,
  recipe,
  onPress,
  onLongPress,
}: {
  meal: Meal;
  recipe?: Recipe;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const c = useTheme();
  const minutes = recipe ? totalMinutes(recipe) : undefined;
  const nutrition = recipe && Features.nutrition ? servingNutrition(recipe) : undefined;
  const facts = [
    minutes ? formatMinutes(minutes) : undefined,
    nutrition
      ? `${nutrition.source === 'estimate' ? '~' : ''}${Math.round(nutrition.values.kcal)} kcal`
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={
        recipe ? `${MEAL_LABELS[meal]}: ${recipe.title}` : `Add ${MEAL_LABELS[meal].toLowerCase()}`
      }
      accessibilityHint={recipe ? 'Hold to change or remove' : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      {recipe ? (
        recipe.photoUri ? (
          <Image source={{ uri: recipe.photoUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.center, { backgroundColor: c.chip }]}>
            <Text style={styles.emoji}>🍽️</Text>
          </View>
        )
      ) : (
        <View style={[styles.thumb, styles.center, styles.addThumb, { borderColor: c.border }]}>
          <Ionicons name="add" size={28} color={c.accent} />
        </View>
      )}
      <View style={styles.cardText}>
        <Text style={[styles.meal, { color: c.accent }]}>{MEAL_LABELS[meal]}</Text>
        <Text
          style={[
            styles.title,
            { color: recipe ? c.text : c.textSecondary },
            !recipe && styles.add,
          ]}
          numberOfLines={2}>
          {recipe ? recipe.title : 'Add meal'}
        </Text>
        {facts ? (
          <Text style={[styles.facts, { color: c.textSecondary }]} numberOfLines={1}>
            {facts}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
    </Pressable>
  );
}

const THUMB = 64;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: BAR_SPACE + Spacing.four,
  },
  weekBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { alignItems: 'center', gap: 2 },
  range: { fontSize: 17, fontWeight: '700' },
  thisWeek: { fontSize: 13, fontWeight: '600' },
  strip: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
  },
  weekday: { fontSize: 12 },
  date: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  dots: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center', marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayTitle: { fontSize: 24, fontWeight: '700', marginTop: Spacing.two },
  summary: { fontSize: 14, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14 },
  center: { alignItems: 'center', justifyContent: 'center' },
  addThumb: { borderWidth: 1.5, borderStyle: 'dashed' },
  emoji: { fontSize: 28 },
  cardText: { flex: 1, minWidth: 0, gap: 2 },
  meal: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '600' },
  add: { fontWeight: '500' },
  facts: { fontSize: 13 },
  hint: { fontSize: 13, textAlign: 'center' },
});
