import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Field } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { addDays, dateKey, weekDays } from '@/lib/plan';
import { goalProgress, parseGoal, planNutrition } from '@/lib/plan-nutrition';
import { filterRecipes } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

const MAX_PICKER_RESULTS = 8;

function dayLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function PlanScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { plan, addToDay, removeFromDay, goals, setGoals } = usePlan();
  const [kcalGoal, setKcalGoal] = useState(goals.kcal ? String(goals.kcal) : '');
  const [proteinGoal, setProteinGoal] = useState(goals.protein ? String(goals.protein) : '');
  const [weekOffset, setWeekOffset] = useState(0);
  const [pickerDay, setPickerDay] = useState<string>();
  const [query, setQuery] = useState('');

  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(addDays(today, weekOffset * 7));
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const matches = useMemo(
    () =>
      filterRecipes(recipes, { query, tags: [] })
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, MAX_PICKER_RESULTS),
    [recipes, query],
  );

  const dayKeys = days.map(dateKey);
  const weekNutrition = planNutrition(plan, dayKeys, byId);
  const plannedDays = dayKeys.filter((k) => (plan[k] ?? []).some((id) => byId.has(id))).length;
  const average = (total: number) => (plannedDays ? Math.round(total / plannedDays) : 0);
  const saveGoals = () => {
    const next = { kcal: parseGoal(kcalGoal), protein: parseGoal(proteinGoal) };
    setGoals(next);
    setKcalGoal(next.kcal ? String(next.kcal) : '');
    setProteinGoal(next.protein ? String(next.protein) : '');
  };

  const rangeLabel = `${dayLabel(days[0])} – ${dayLabel(days[6])}`;
  const closePicker = () => {
    setPickerDay(undefined);
    setQuery('');
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <View style={styles.weekBar}>
        <Pressable
          onPress={() => setWeekOffset((w) => w - 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous week">
          <Text style={[styles.arrow, { color: c.accent }]}>‹</Text>
        </Pressable>
        <View style={styles.weekTitle}>
          <Text style={[styles.range, { color: c.text }]}>{rangeLabel}</Text>
          {weekOffset !== 0 ? (
            <Pressable onPress={() => setWeekOffset(0)} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.small, { color: c.accent }]}>This week</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setWeekOffset((w) => w + 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next week">
          <Text style={[styles.arrow, { color: c.accent }]}>›</Text>
        </Pressable>
      </View>

      {plannedDays ? (
        <View style={[styles.summary, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.dayName, { color: c.text }]}>
            Planned this week: ~{Math.round(weekNutrition.total.kcal)} kcal
          </Text>
          <Text style={[styles.small, { color: c.textSecondary }]}>
            {Math.round(weekNutrition.total.protein)} g protein ·{' '}
            {Math.round(weekNutrition.total.carbs)} g carbs · {Math.round(weekNutrition.total.fat)}{' '}
            g fat. Average on planned days: ~{average(weekNutrition.total.kcal)} kcal
            {goals.kcal ? ` (goal ${goals.kcal})` : ''}, {average(weekNutrition.total.protein)} g
            protein{goals.protein ? ` (goal ${goals.protein})` : ''}.
            {weekNutrition.unknown
              ? ` ${weekNutrition.unknown} planned recipe${weekNutrition.unknown === 1 ? ' has' : 's have'} no nutrition data.`
              : ''}
          </Text>
        </View>
      ) : null}

      {days.map((d) => {
        const key = dateKey(d);
        const planned = (plan[key] ?? []).map((id) => byId.get(id)).filter((r) => !!r);
        const isToday = key === todayKey;
        const dayNutrition = planNutrition(plan, [key], byId);
        const kcalShare = goalProgress(dayNutrition.total.kcal, goals.kcal);
        const picking = pickerDay === key;
        return (
          <View
            key={key}
            style={[
              styles.day,
              { backgroundColor: c.card, borderColor: isToday ? c.accent : c.border },
            ]}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, { color: isToday ? c.accent : c.text }]}>
                {dayLabel(d)}
                {isToday ? ' · today' : ''}
              </Text>
              <Pressable
                onPress={() => (picking ? closePicker() : (setPickerDay(key), setQuery('')))}
                hitSlop={8}
                accessibilityRole="button">
                <Text style={[styles.small, { color: c.accent }]}>
                  {picking ? 'Done' : '+ Add'}
                </Text>
              </Pressable>
            </View>

            {planned.map((r) => (
              <View key={r.id} style={styles.planned}>
                <Pressable
                  style={styles.flex}
                  onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}
                  accessibilityRole="link">
                  <Text style={[styles.recipeTitle, { color: c.text }]} numberOfLines={2}>
                    {r.title}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => removeFromDay(key, r.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${r.title} from ${dayLabel(d)}`}>
                  <Text style={[styles.small, { color: c.textSecondary }]}>Remove</Text>
                </Pressable>
              </View>
            ))}
            {planned.length && dayNutrition.total.kcal > 0 ? (
              <Text
                style={[
                  styles.small,
                  { color: kcalShare !== undefined && kcalShare > 1 ? c.danger : c.textSecondary },
                ]}>
                ~{Math.round(dayNutrition.total.kcal)} kcal ·{' '}
                {Math.round(dayNutrition.total.protein)} g protein
                {kcalShare !== undefined
                  ? ` · ${Math.round(kcalShare * 100)}% of your calorie goal`
                  : ''}
              </Text>
            ) : null}
            {!planned.length && !picking ? (
              <Text style={[styles.small, { color: c.textSecondary }]}>Nothing planned</Text>
            ) : null}

            {picking ? (
              <View style={styles.picker}>
                {recipes.length ? (
                  <>
                    <Field
                      label="Find a recipe"
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Name, ingredient or tag"
                      autoCorrect={false}
                    />
                    {matches.map((r) => (
                      <Pressable
                        key={r.id}
                        onPress={() => {
                          addToDay(key, r.id);
                          closePicker();
                        }}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.option,
                          { backgroundColor: c.chip, opacity: pressed ? 0.7 : 1 },
                        ]}>
                        <Text style={[styles.recipeTitle, { color: c.text }]} numberOfLines={1}>
                          {r.title}
                        </Text>
                      </Pressable>
                    ))}
                    {!matches.length ? (
                      <Text style={[styles.small, { color: c.textSecondary }]}>
                        No recipes match.
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={[styles.small, { color: c.textSecondary }]}>
                    Add some recipes first, then plan them here.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={[styles.summary, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.dayName, { color: c.text }]}>Daily goals</Text>
        <Text style={[styles.small, { color: c.textSecondary }]}>
          Totals count one serving of each planned recipe. Leave a box empty for no goal.
        </Text>
        <Field
          label="Calories per day"
          value={kcalGoal}
          onChangeText={setKcalGoal}
          keyboardType="number-pad"
          placeholder="e.g. 2000"
        />
        <Field
          label="Protein per day (g)"
          value={proteinGoal}
          onChangeText={setProteinGoal}
          keyboardType="number-pad"
          placeholder="e.g. 80"
        />
        <Button label="Save goals" variant="secondary" onPress={saveGoals} />
      </View>

      <Text style={[styles.small, { color: c.textSecondary }]}>
        Recipes planned for today or later are added to your Shopping list.
      </Text>
      <Button
        label="Open shopping list"
        variant="secondary"
        onPress={() => router.navigate('/shopping')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six * 2,
  },
  weekBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekTitle: { alignItems: 'center', gap: 2 },
  range: { fontSize: 17, fontWeight: '700' },
  arrow: { fontSize: 32, lineHeight: 34, paddingHorizontal: Spacing.three },
  summary: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  day: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 16, fontWeight: '700' },
  planned: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  recipeTitle: { fontSize: 16 },
  small: { fontSize: 14, lineHeight: 20 },
  picker: { gap: Spacing.two },
  option: { borderRadius: 10, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
});
