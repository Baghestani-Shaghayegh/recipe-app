import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { DayNutrition } from '@/components/day-nutrition';
import { Bowls, FinishedSheet, MealPrepSheet } from '@/components/meal-prep';
import { PlanShoppingBar } from '@/components/plan-shopping';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import {
  addDays,
  batchUse,
  cookingBatch,
  dateKey,
  fromDateKey,
  leftoverBatch,
  MEAL_LABELS,
  MEALS,
  plannedMeals,
  weekDays,
  type Batch,
  type Meal,
} from '@/lib/plan';
import { planNutrition } from '@/lib/plan-nutrition';
import { formatMinutes, totalMinutes, type Recipe } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

const BAR_SPACE = 96;

// iOS can't open the next sheet until the menu has closed.
const afterMenu = (run: () => void) => setTimeout(run, Platform.OS === 'ios' ? 350 : 0);

const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Pick a day at the top, then plan its breakfast, lunch and dinner. */
export default function PlanScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { plan, setMeal, batches } = usePlan();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [menu, setMenu] = useState<{ meal: Meal; recipe: Recipe }>();
  const [prep, setPrep] = useState<{ meal: Meal; recipe: Recipe; batch?: Batch }>();
  const [finishing, setFinishing] = useState<Batch>();

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
  // The day's calories, protein and fat, from one serving of each planned meal.
  const dayTotal = planNutrition(plan, [day], byId).total;
  const showNutrition = Features.nutrition && meals.length > 0 && dayTotal.kcal > 0;

  const pick = (meal: Meal) => router.push({ pathname: '/plan/pick', params: { day, meal } });
  // A meal-prep recipe opens at the batch's size, so cooking mode has the right amounts.
  const openRecipe = (recipe: Recipe, meal: Meal) => {
    const batch = cookingBatch(batches, plan, day, meal);
    router.push({
      pathname: '/recipe/[id]',
      params: batch ? { id: recipe.id, servings: String(batch.servings) } : { id: recipe.id },
    });
  };
  const cookedToday = batches.filter((b) => b.cookDay === day && byId.has(b.recipeId));

  const menuActions = (meal: Meal, recipe: Recipe): SheetAction[] => {
    const cook = cookingBatch(batches, plan, day, meal);
    const leftover = leftoverBatch(batches, plan, day, meal);
    const close = (run: () => void) => () => {
      setMenu(undefined);
      run();
    };
    // Opening the recipe is a tap on the card, and meal prep is the tag on it.
    return [
      ...(cook || leftover
        ? [
            {
              label: 'Finished it',
              onPress: close(() => afterMenu(() => setFinishing(cook ?? leftover))),
            },
          ]
        : []),
      ...(leftover ? [] : [{ label: 'Choose another recipe', onPress: close(() => pick(meal)) }]),
      {
        label: `Remove from ${MEAL_LABELS[meal].toLowerCase()}`,
        danger: true,
        onPress: close(() => setMeal(day, meal, undefined)),
      },
    ];
  };

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
            const dayMeals = plannedMeals(plan, [key]).filter((m) => byId.has(m.recipeId));
            const count = dayMeals.length;
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
                  {dayMeals.map((m) => (
                    <View
                      key={m.meal}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: on
                            ? c.accentText
                            : leftoverBatch(batches, plan, key, m.meal)
                              ? c.prep
                              : c.accent,
                        },
                      ]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.dayTitle, { color: c.text }]}>
          {day === todayKey
            ? 'Today'
            : day === dateKey(addDays(today, 1))
              ? 'Tomorrow'
              : dayDate.toLocaleDateString(undefined, { weekday: 'long' })}
        </Text>

        {showNutrition ? <DayNutrition total={dayTotal} /> : null}

        {MEALS.map((meal) => {
          const recipe = byId.get(plan[day]?.[meal] ?? '');
          const cook = cookingBatch(batches, plan, day, meal);
          const leftover = leftoverBatch(batches, plan, day, meal);
          return recipe ? (
            <MealCard
              key={meal}
              meal={meal}
              recipe={recipe}
              prep={
                cook
                  ? { kind: 'cook', servings: cook.servings }
                  : leftover
                    ? {
                        kind: 'leftover',
                        from: fromDateKey(leftover.cookDay).toLocaleDateString(undefined, {
                          weekday: 'long',
                        }),
                      }
                    : undefined
              }
              onPress={() => openRecipe(recipe, meal)}
              onMenu={() => setMenu({ meal, recipe })}
              onPrep={leftover ? undefined : () => setPrep({ meal, recipe, batch: cook })}
            />
          ) : (
            <MealCard key={meal} meal={meal} onPress={() => pick(meal)} />
          );
        })}

        {cookedToday.map((b) => (
          <View key={b.id} style={styles.batch}>
            <Bowls
              title={byId.get(b.recipeId)!.title}
              servings={b.servings}
              used={batchUse(b).used}
            />
            <Pressable
              onPress={() => setFinishing(b)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.finished,
                { borderColor: c.border, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[styles.finishedText, { color: c.text }]}>Finished it</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <PlanShoppingBar week={week} today={todayKey} />

      <ActionSheet
        visible={!!menu}
        onClose={() => setMenu(undefined)}
        actions={menu ? menuActions(menu.meal, menu.recipe) : []}
      />
      {prep ? (
        <MealPrepSheet
          recipe={prep.recipe}
          day={day}
          meal={prep.meal}
          batch={prep.batch}
          onClose={() => setPrep(undefined)}
        />
      ) : null}
      {finishing && byId.has(finishing.recipeId) ? (
        <FinishedSheet
          batch={finishing}
          recipe={byId.get(finishing.recipeId)!}
          today={todayKey}
          onClose={() => setFinishing(undefined)}
        />
      ) : null}
    </View>
  );
}

/** One meal of the day: the planned recipe, or an "Add meal" card of the same size. */
function MealCard({
  meal,
  recipe,
  prep,
  onPress,
  onMenu,
  onPrep,
}: {
  meal: Meal;
  recipe?: Recipe;
  /** Meal prep: the meal the batch is cooked for, or leftovers from it. */
  prep?: { kind: 'cook'; servings: number } | { kind: 'leftover'; from: string };
  onPress: () => void;
  /** The ⋯ button (and holding the card): change or remove. */
  onMenu?: () => void;
  /** The "+ Meal prep" tag (or "Meal prep" on a batch's cooking meal): set up meal prep. */
  onPrep?: () => void;
}) {
  const c = useTheme();
  const minutes = recipe ? totalMinutes(recipe) : undefined;
  const facts =
    prep?.kind === 'leftover'
      ? `From ${prep.from}`
      : [
          prep?.kind === 'cook' ? `Cook ${prep.servings} servings` : undefined,
          minutes ? formatMinutes(minutes) : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMenu}
      accessibilityRole="button"
      accessibilityLabel={
        recipe ? `${MEAL_LABELS[meal]}: ${recipe.title}` : `Add ${MEAL_LABELS[meal].toLowerCase()}`
      }
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: prep?.kind === 'cook' ? c.prep : c.border,
          borderWidth: prep?.kind === 'cook' ? 1.5 : 1,
          opacity: pressed ? 0.85 : 1,
        },
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
        <View style={styles.mealRow}>
          <Text style={[styles.meal, { color: c.accent }]}>{MEAL_LABELS[meal]}</Text>
          {prep?.kind === 'leftover' ? (
            <View style={[styles.tag, { backgroundColor: c.prepSoft }]}>
              <Text style={[styles.tagText, { color: c.prep }]}>Leftovers</Text>
            </View>
          ) : onPrep ? (
            <Pressable
              onPress={onPrep}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={prep ? 'Edit meal prep' : 'Meal prep'}
              style={({ pressed }) => [
                styles.tag,
                prep
                  ? { backgroundColor: c.prep }
                  : { borderWidth: 1, borderColor: c.prep, paddingVertical: 1 },
                { opacity: pressed ? 0.7 : 1 },
              ]}>
              <Text style={[styles.tagText, { color: prep ? c.background : c.prep }]}>
                {prep ? 'Meal prep' : '+ Meal prep'}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
          <Text
            style={[
              styles.facts,
              { color: c.textSecondary },
              prep?.kind === 'cook' && { color: c.prep, fontWeight: '600' },
            ]}
            numberOfLines={1}>
            {facts}
          </Text>
        ) : null}
      </View>
      {onMenu ? (
        <Pressable
          onPress={onMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`More for ${MEAL_LABELS[meal].toLowerCase()}`}>
          <Ionicons name="ellipsis-horizontal" size={22} color={c.textSecondary} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
      )}
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
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '700' },
  batch: { gap: Spacing.two },
  finished: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  finishedText: { fontSize: 15, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '600' },
  add: { fontWeight: '500' },
  facts: { fontSize: 13 },
});
