import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BottomSheet } from '@/components/bottom-sheet';
import { Field } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import type { Nutrients } from '@/lib/nutrition';
import { dailyGoals, parseGoal, TYPICAL_GOALS, type Goals } from '@/lib/plan-nutrition';
import { usePlan } from '@/store/plan';

const RING = 96;
const STROKE = 10;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const share = (value: number, goal: number) => Math.max(0, Math.min(1, value / goal));

/**
 * A day's calories as a ring, and its protein and fat as bars, each filling up towards the daily
 * goal (typical amounts when none is set). Tapping it sets the goals.
 */
export function DayNutrition({ total }: { total: Nutrients }) {
  const c = useTheme();
  const { goals } = usePlan();
  const goal = dailyGoals(goals);
  const [editing, setEditing] = useState(false);
  const kcal = Math.round(total.kcal);

  return (
    <>
      <Pressable
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel={`${kcal} kcal, ${Math.round(total.protein)} g protein, ${Math.round(total.fat)} g fat. Set daily goals`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
        ]}>
        <View style={styles.ring}>
          <Svg width={RING} height={RING} style={styles.ringSvg}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={c.kcalTrack}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={c.kcal}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - share(total.kcal, goal.kcal))}
            />
          </Svg>
          <View style={styles.ringText}>
            <Text style={[styles.kcal, { color: c.text }]}>{kcal.toLocaleString()}</Text>
            <Text style={[styles.kcalLabel, { color: c.kcal }]}>KCAL</Text>
          </View>
        </View>
        <View style={styles.macros}>
          <Macro
            label="Protein"
            grams={total.protein}
            goal={goal.protein}
            color={c.protein}
            track={c.proteinTrack}
          />
          <Macro label="Fat" grams={total.fat} goal={goal.fat} color={c.fat} track={c.fatTrack} />
        </View>
      </Pressable>
      {editing ? <GoalsSheet onClose={() => setEditing(false)} /> : null}
    </>
  );
}

function Macro({
  label,
  grams,
  goal,
  color,
  track,
}: {
  label: string;
  grams: number;
  goal: number;
  color: string;
  track: string;
}) {
  const c = useTheme();
  return (
    <View>
      <View style={styles.macroTop}>
        <View style={styles.macroName}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.macroLabel, { color: c.text }]}>{label}</Text>
        </View>
        <Text style={[styles.grams, { color: c.text }]}>
          {Math.round(grams)}
          <Text style={[styles.unit, { color: c.textSecondary }]}>g</Text>
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View
          style={[styles.fill, { backgroundColor: color, width: `${share(grams, goal) * 100}%` }]}
        />
      </View>
    </View>
  );
}

/** Daily calories, protein and fat. An empty box means the typical amount. */
function GoalsSheet({ onClose }: { onClose: () => void }) {
  const c = useTheme();
  const { goals, setGoals } = usePlan();
  const text = (n?: number) => (n ? String(n) : '');
  const [kcal, setKcal] = useState(text(goals.kcal));
  const [protein, setProtein] = useState(text(goals.protein));
  const [fat, setFat] = useState(text(goals.fat));

  const save = (close: () => void) => {
    const next: Goals = { kcal: parseGoal(kcal), protein: parseGoal(protein), fat: parseGoal(fat) };
    setGoals(next);
    close();
  };

  return (
    <BottomSheet visible title="Daily goals" onClose={onClose}>
      {(close) => (
        <View style={styles.sheet}>
          <Field
            label="Calories (kcal)"
            value={kcal}
            onChangeText={setKcal}
            keyboardType="number-pad"
            placeholder={String(TYPICAL_GOALS.kcal)}
          />
          <Field
            label="Protein (g)"
            value={protein}
            onChangeText={setProtein}
            keyboardType="number-pad"
            placeholder={String(TYPICAL_GOALS.protein)}
          />
          <Field
            label="Fat (g)"
            value={fat}
            onChangeText={setFat}
            keyboardType="number-pad"
            placeholder={String(TYPICAL_GOALS.fat)}
          />
          <Pressable
            onPress={() => save(() => close())}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.ctaText, { color: c.accentText }]}>Save goals</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four + 2,
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four + 2,
  },
  ring: { width: RING, height: RING },
  // The ring starts at the top.
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringText: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  kcal: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  kcalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginTop: 2 },
  macros: { flex: 1, gap: Spacing.three + 2 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  macroLabel: { fontSize: 14, fontWeight: '700' },
  grams: { fontSize: 15, fontWeight: '800' },
  unit: { fontSize: 12, fontWeight: '700' },
  track: { height: 10, borderRadius: 6, marginTop: 7, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  sheet: { gap: Spacing.three, paddingTop: Spacing.two },
  cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.two },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
