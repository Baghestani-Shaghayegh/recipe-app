import { useKeepAwake } from 'expo-keep-awake';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';

import { Button } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { scaleFactor, scaleIngredientText } from '@/lib/scale';
import { findTimers, formatClock } from '@/lib/timers';
import { convertTemperatures, type UnitSystem } from '@/lib/units';
import { useRecipes } from '@/store/recipes';

type RunningTimer = { id: number; label: string; endsAt: number; done: boolean };

let nextTimerId = 1;

/** One step at a time, big text, screen stays on, timers for times mentioned in the steps. */
export default function CookScreen() {
  const c = useTheme();
  useKeepAwake();
  const { id, servings, units } = useLocalSearchParams<{
    id: string;
    servings?: string;
    units?: UnitSystem;
  }>();
  const system: UnitSystem = units === 'metric' || units === 'us' ? units : 'original';
  const { recipes } = useRecipes();
  const recipe = recipes.find((r) => r.id === id);
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const running = timers.some((t) => !t.done);
  useEffect(() => {
    if (!running) return;
    const update = () => {
      const time = Date.now();
      setNow(time);
      setTimers((prev) => {
        if (!prev.some((t) => !t.done && t.endsAt <= time)) return prev;
        Vibration.vibrate([0, 500, 300, 500, 300, 500]);
        return prev.map((t) => (!t.done && t.endsAt <= time ? { ...t, done: true } : t));
      });
    };
    update();
    const tick = setInterval(update, 500);
    return () => clearInterval(tick);
  }, [running]);

  if (!recipe) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={{ color: c.textSecondary }}>This recipe doesn’t exist anymore.</Text>
      </View>
    );
  }

  const steps = recipe.steps;
  const last = steps.length - 1;
  const stepTimers = steps[step] ? findTimers(steps[step]) : [];
  const factor = scaleFactor(recipe.servings, servings ? Number(servings) : undefined);

  const startTimer = (label: string, seconds: number) => {
    setTimers((prev) => [
      ...prev,
      { id: nextTimerId++, label, endsAt: Date.now() + seconds * 1000, done: false },
    ]);
  };
  const stopTimer = (timerId: number) => setTimers((prev) => prev.filter((t) => t.id !== timerId));

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: recipe.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        {steps.length ? (
          <>
            <Text style={[styles.progress, { color: c.accent }]}>
              Step {step + 1} of {steps.length}
            </Text>
            <Text style={[styles.step, { color: c.text }]}>
              {convertTemperatures(steps[step], system)}
            </Text>
            {stepTimers.length ? (
              <View style={styles.timerButtons}>
                {stepTimers.map((t) => (
                  <Button
                    key={t.label}
                    label={`⏱ Start ${t.label} timer`}
                    variant="secondary"
                    onPress={() => startTimer(t.label, t.seconds)}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.step, { color: c.text }]}>This recipe has no steps yet.</Text>
        )}

        {recipe.ingredients.length ? (
          <View style={styles.ingredients}>
            <Pressable onPress={() => setShowIngredients((s) => !s)} accessibilityRole="button">
              <Text style={[styles.toggle, { color: c.accent }]}>
                {showIngredients ? 'Hide ingredients' : 'Show ingredients'}
              </Text>
            </Pressable>
            {showIngredients
              ? recipe.ingredients.map((ing, i) => (
                  <Text key={i} style={[styles.ingredient, { color: c.text }]}>
                    • {scaleIngredientText(ing, factor, system)}
                  </Text>
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>

      {timers.length ? (
        <View style={[styles.timers, { borderTopColor: c.border, backgroundColor: c.card }]}>
          {timers.map((t) => (
            <View key={t.id} style={styles.timerRow}>
              <Text style={[styles.timerLabel, { color: c.textSecondary }]}>{t.label}</Text>
              <Text style={[styles.clock, { color: t.done ? c.danger : c.text }]}>
                {t.done ? 'Time’s up!' : formatClock((t.endsAt - now) / 1000)}
              </Text>
              <Pressable onPress={() => stopTimer(t.id)} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.toggle, { color: c.accent }]}>
                  {t.done ? 'Dismiss' : 'Cancel'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.nav, { borderTopColor: c.border }]}>
        <View style={styles.flex}>
          <Button
            label="Back"
            variant="secondary"
            onPress={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          />
        </View>
        <View style={styles.flex}>
          {step >= last ? (
            <Button label="Done" onPress={() => router.back()} />
          ) : (
            <Button label="Next step" onPress={() => setStep((s) => Math.min(last, s + 1))} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  progress: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  step: { fontSize: 28, lineHeight: 38, fontWeight: '500' },
  timerButtons: { gap: Spacing.two },
  ingredients: { gap: Spacing.two, marginTop: Spacing.three },
  toggle: { fontSize: 15, fontWeight: '600' },
  ingredient: { fontSize: 18, lineHeight: 26 },
  timers: { borderTopWidth: 1, padding: Spacing.three, gap: Spacing.two },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  timerLabel: { fontSize: 15, minWidth: 64 },
  clock: { flex: 1, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  nav: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.four, borderTopWidth: 1 },
  flex: { flex: 1 },
});
