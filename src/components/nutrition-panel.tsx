import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionTitle } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import {
  estimateExtras,
  estimateNutrition,
  type IngredientNutrition,
  type Nutrients,
} from '@/lib/nutrition';
import type { Recipe } from '@/lib/recipe';

const PROBLEM_TEXT: Record<NonNullable<IngredientNutrition['problem']>, string> = {
  'unknown-food': 'not in the food list',
  'no-amount': 'no amount given',
  'unknown-size': 'unit not known for this food',
  skipped: 'too little to count',
};

export function formatNutrient(value: number, unit: 'kcal' | 'g'): string {
  if (unit === 'kcal') return `${Math.round(value)}`;
  return value < 10 ? `${Math.round(value * 10) / 10} g` : `${Math.round(value)} g`;
}

function NutrientRow({ values }: { values: Nutrients }) {
  const c = useTheme();
  const items: [string, string][] = [
    ['Calories', formatNutrient(values.kcal, 'kcal')],
    ['Protein', formatNutrient(values.protein, 'g')],
    ['Carbs', formatNutrient(values.carbs, 'g')],
    ['Fat', formatNutrient(values.fat, 'g')],
  ];
  return (
    <View style={[styles.box, { backgroundColor: c.card, borderColor: c.border }]}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.item}>
          <Text style={[styles.value, { color: c.text }]}>{value}</Text>
          <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Nutrition per serving: the user's own numbers if they entered them, otherwise an estimate. */
export function NutritionPanel({ recipe }: { recipe: Recipe }) {
  const c = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const est = estimateNutrition(recipe);
  const manual = recipe.nutrition;
  const extras = estimateExtras(recipe);

  if (!manual && !est.countedCount) {
    if (!recipe.ingredients.length) return null;
    return (
      <View style={styles.block}>
        <SectionTitle>Nutrition</SectionTitle>
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Couldn’t estimate this one. You can type in the numbers yourself under Edit.
        </Text>
      </View>
    );
  }

  const perServing = est.servings === 1 ? 'per serving' : `per serving (of ${est.servings})`;

  return (
    <View style={styles.block}>
      <SectionTitle>Nutrition</SectionTitle>
      <Text style={[styles.note, { color: c.textSecondary }]}>
        {manual ? `Your numbers, per serving` : `Estimated ${perServing}`}
      </Text>
      <NutrientRow values={manual ?? est.perServing} />

      {extras ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Also (estimated from the ingredients): fiber {formatNutrient(extras.fiber, 'g')} · sugar{' '}
          {formatNutrient(extras.sugar, 'g')} · sodium {Math.round(extras.sodium)} mg
        </Text>
      ) : null}

      {!manual && est.notCounted.length ? (
        <Text style={[styles.note, { color: c.danger }]}>
          Not counted: {est.notCounted.map((l) => l.ingredient.name).join(', ')}
        </Text>
      ) : null}
      {manual && est.countedCount ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Estimate from ingredients: {formatNutrient(est.perServing.kcal, 'kcal')} kcal
        </Text>
      ) : null}

      {est.countedCount ? (
        <Pressable
          onPress={() => setShowDetails((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}>
          <Text style={[styles.toggle, { color: c.accent }]}>
            {showDetails ? 'Hide how it’s worked out' : 'How it’s worked out'}
          </Text>
        </Pressable>
      ) : null}

      {showDetails ? (
        <View style={styles.details}>
          {est.lines.map((l, i) => (
            <View key={i} style={[styles.line, { borderBottomColor: c.border }]}>
              <Text style={[styles.lineName, { color: c.text }]}>{l.ingredient.text}</Text>
              <Text style={[styles.lineValue, { color: l.nutrients ? c.text : c.textSecondary }]}>
                {l.nutrients && l.grams !== undefined
                  ? `${Math.round(l.grams)} g · ${formatNutrient(l.nutrients.kcal, 'kcal')} kcal`
                  : PROBLEM_TEXT[l.problem!]}
              </Text>
            </View>
          ))}
          <Text style={[styles.note, { color: c.textSecondary }]}>
            Whole recipe: {formatNutrient(est.total.kcal, 'kcal')} kcal. Values are typical
            averages, so treat them as a guide.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  note: { fontSize: 14, lineHeight: 20 },
  box: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.four,
  },
  item: { alignItems: 'center', gap: 2 },
  value: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 13 },
  toggle: { fontSize: 15, fontWeight: '600', paddingVertical: Spacing.one },
  details: { gap: 0 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineName: { flex: 1, fontSize: 15 },
  lineValue: { fontSize: 14, textAlign: 'right' },
});
