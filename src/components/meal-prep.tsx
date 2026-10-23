import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Spacing, useTheme } from '@/constants/theme';
import {
  addDays,
  BATCH_DAYS,
  batchUse,
  dateKey,
  fromDateKey,
  MEAL_LABELS,
  MEALS,
  slotKey,
  type Batch,
  type Meal,
} from '@/lib/plan';
import type { Recipe } from '@/lib/recipe';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';

const MAX_SERVINGS = 24;

const newBatchId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const weekday = (day: string) =>
  fromDateKey(day).toLocaleDateString(undefined, { weekday: 'short' });

/** "Lentil Soup · 2 left" and a bowl per serving: eaten ones full, spare ones empty. */
export function Bowls({
  title,
  servings,
  used,
  empty,
}: {
  title: string;
  servings: number;
  used: number;
  /** Every bowl empty (the batch is finished). */
  empty?: boolean;
}) {
  const c = useTheme();
  const left = servings - used;
  const short = left < 0;
  const count = Math.min(Math.max(servings, used), MAX_SERVINGS);
  return (
    <View style={[styles.bowlCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.bowlHead}>
        <Text style={[styles.bowlTitle, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {empty ? null : (
          <View style={[styles.pill, { backgroundColor: short ? c.danger : c.prep }]}>
            <Text style={styles.pillText}>{short ? `${-left} short` : `${left} left`}</Text>
          </View>
        )}
      </View>
      <View style={styles.bowls}>
        {Array.from({ length: count }, (_, i) => {
          const eaten = !empty && i < Math.min(used, servings);
          const over = !empty && i >= servings;
          return (
            // Eight to a row: each bowl takes an eighth of the width, with its gap inside.
            <View key={i} style={styles.bowlSlot}>
              <View
                style={[
                  styles.bowl,
                  eaten
                    ? { backgroundColor: c.prepSoft }
                    : {
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: over ? c.danger : c.prepLine,
                      },
                ]}>
                <Text style={[styles.bowlEmoji, !eaten && styles.bowlFaded]}>🍲</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** − 8 + for the servings and the people. */
function Stepper({
  label,
  value,
  min,
  max = MAX_SERVINGS,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  const c = useTheme();
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={[styles.stepper, { borderBottomColor: c.border }]}>
      <Text style={[styles.stepLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable
          onPress={() => step(-1)}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Fewer: ${label.toLowerCase()}`}
          style={[styles.stepButton, { backgroundColor: c.chip, opacity: value <= min ? 0.4 : 1 }]}>
          <Ionicons name="remove" size={20} color={c.accent} />
        </Pressable>
        <Text style={[styles.stepValue, { color: c.text }]}>{value}</Text>
        <Pressable
          onPress={() => step(1)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`More: ${label.toLowerCase()}`}
          style={[styles.stepButton, { backgroundColor: c.chip, opacity: value >= max ? 0.4 : 1 }]}>
          <Ionicons name="add" size={20} color={c.accent} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Meal prep for a planned meal: how many servings to cook, how many people eat, and which meals
 * of the next days eat the leftovers.
 */
export function MealPrepSheet({
  recipe,
  day,
  meal,
  batch,
  onClose,
}: {
  recipe: Recipe;
  day: string;
  meal: Meal;
  /** The batch being changed; a new one when missing. */
  batch?: Batch;
  onClose: () => void;
}) {
  const c = useTheme();
  const { plan, batches, saveBatch } = usePlan();
  const { recipes } = useRecipes();
  const lastPeople = batches[batches.length - 1]?.people;
  const [servings, setServings] = useState(batch?.servings ?? recipe.servings ?? 4);
  const [people, setPeople] = useState(() =>
    Math.min(batch?.people ?? lastPeople ?? 1, batch?.servings ?? recipe.servings ?? 4),
  );
  const [eats, setEats] = useState<string[]>(() =>
    (batch?.eats ?? []).map((e) => slotKey(e.day, e.meal)),
  );
  const days = Array.from({ length: BATCH_DAYS }, (_, i) => dateKey(addDays(fromDateKey(day), i)));
  const { used, left } = batchUse({ servings, people, eats });
  // Only as many meals as the servings cover: no more ticks once another meal wouldn't fit,
  // no fewer servings than the ticked meals need, and no more people than the servings feed.
  const full = left < people;
  const meals = 1 + eats.length;

  // Meals that already hold another recipe can't be picked.
  const takenBy = (d: string, m: Meal) => {
    const id = plan[d]?.[m];
    const mine = batch?.eats.some((e) => e.day === d && e.meal === m);
    return id && !(id === recipe.id && mine) ? recipes.find((r) => r.id === id) : undefined;
  };

  const toggle = (key: string) =>
    setEats((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const save = (close: (after?: () => void) => void) => {
    saveBatch({
      id: batch?.id ?? newBatchId(),
      recipeId: recipe.id,
      cookDay: day,
      cookMeal: meal,
      servings,
      people,
      eats: eats.map((k) => {
        const [d, m] = k.split(':');
        return { day: d, meal: m as Meal };
      }),
    });
    close();
  };

  return (
    <BottomSheet visible title={`Meal prep: ${recipe.title}`} onClose={onClose}>
      {(close) => (
        <View style={styles.sheet}>
          <View>
            <Stepper
              label="Servings to cook"
              value={servings}
              min={Math.max(1, used)}
              onChange={setServings}
            />
            <Stepper
              label="People eating"
              value={people}
              min={1}
              max={Math.max(1, Math.floor(servings / meals))}
              onChange={setPeople}
            />
          </View>

          <Text style={[styles.gridTitle, { color: c.textSecondary }]}>EAT IT ON</Text>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <View style={styles.rowLabel} />
              {days.map((d) => (
                <Text key={d} style={[styles.colLabel, { color: c.textSecondary }]}>
                  {weekday(d)}
                </Text>
              ))}
            </View>
            {MEALS.map((m) => (
              <View key={m} style={styles.gridRow}>
                <Text style={[styles.rowLabel, { color: c.textSecondary }]} numberOfLines={1}>
                  {MEAL_LABELS[m]}
                </Text>
                {days.map((d) => {
                  const key = slotKey(d, m);
                  const cooking = d === day && m === meal;
                  // Only meals after the cooking one.
                  const before = d === day && MEALS.indexOf(m) <= MEALS.indexOf(meal);
                  const taken = cooking || before ? undefined : takenBy(d, m);
                  const on = eats.includes(key);
                  if (cooking) {
                    return (
                      <View
                        key={key}
                        accessibilityLabel={`${weekday(d)} ${MEAL_LABELS[m]}: cooking`}
                        style={[styles.cell, { borderColor: c.prep, backgroundColor: c.prepSoft }]}>
                        <Text style={styles.cookIcon}>🥡</Text>
                      </View>
                    );
                  }
                  if (before || taken) {
                    return (
                      <View
                        key={key}
                        accessibilityLabel={
                          taken ? `${weekday(d)} ${MEAL_LABELS[m]}: ${taken.title}` : undefined
                        }
                        // Can't be picked (before the cooking meal, or another recipe is there):
                        // left empty rather than shown as a box.
                        style={[styles.cell, styles.unavailable]}
                      />
                    );
                  }
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggle(key)}
                      disabled={!on && full}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: !on && full }}
                      accessibilityLabel={`${weekday(d)} ${MEAL_LABELS[m]}`}
                      style={[
                        styles.cell,
                        on
                          ? { backgroundColor: c.prep, borderColor: c.prep }
                          : { borderColor: c.border, opacity: full ? 0.35 : 1 },
                      ]}>
                      {on ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <Bowls title={recipe.title} servings={servings} used={used} />

          <Pressable
            onPress={() => save(close)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.ctaText, { color: c.accentText }]}>Save meal prep</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

/** "Lentil Soup is finished?" for a batch that ran out early. */
export function FinishedSheet({
  batch,
  recipe,
  today,
  onClose,
}: {
  batch: Batch;
  recipe: Recipe;
  today: string;
  onClose: () => void;
}) {
  const c = useTheme();
  const { finishBatch } = usePlan();
  const freed = batch.eats
    .filter((e) => e.day >= today)
    .map((e) => `${weekday(e.day)} ${MEAL_LABELS[e.meal].toLowerCase()}`);
  return (
    <BottomSheet visible title={`${recipe.title} is finished?`} onClose={onClose}>
      {(close) => (
        <View style={styles.sheet}>
          <Bowls title={recipe.title} servings={batch.servings} used={0} empty />
          {freed.length ? (
            <Text style={[styles.freed, { color: c.textSecondary }]}>
              Frees up {freed.join(', ')}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              finishBatch(batch.id, today);
              close();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.ctaText, { color: c.accentText }]}>Yes, it’s finished</Text>
          </Pressable>
          <Pressable onPress={() => close()} accessibilityRole="button" style={styles.ghost}>
            <Text style={[styles.ctaText, { color: c.text }]}>Keep it</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: Spacing.three, paddingTop: Spacing.two },
  bowlCard: { borderWidth: 1, borderRadius: 18, padding: Spacing.three + 2, gap: Spacing.three },
  bowlHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bowlTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bowls: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2.5, rowGap: 5 },
  bowlSlot: { width: '12.5%', paddingHorizontal: 2.5 },
  bowl: { aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bowlEmoji: { fontSize: 17 },
  bowlFaded: { opacity: 0.3 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepLabel: { fontSize: 16, fontWeight: '600' },
  stepControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  gridTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: Spacing.one },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowLabel: { width: 64, fontSize: 12, fontWeight: '600' },
  colLabel: { flex: 1, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  cell: {
    flex: 1,
    height: 34,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookIcon: { fontSize: 15 },
  unavailable: { borderWidth: 0 },
  freed: { fontSize: 14, textAlign: 'center' },
  cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700' },
  ghost: { paddingVertical: 12, alignItems: 'center' },
});
