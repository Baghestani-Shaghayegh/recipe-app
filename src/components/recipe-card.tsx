import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { servingNutrition } from '@/lib/nutrition';
import { formatMinutes, totalMinutes, type Recipe } from '@/lib/recipe';

/**
 * A recipe row that opens the recipe when tapped.
 * `children` adds extra lines under the title (e.g. "Missing: bread");
 * `actions` sits underneath, full width, for buttons.
 */
export function RecipeCard({
  recipe,
  children,
  actions,
}: {
  recipe: Recipe;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const c = useTheme();
  const minutes = totalMinutes(recipe);
  const nutrition = servingNutrition(recipe);
  const kcal = nutrition
    ? `${nutrition.source === 'estimate' ? '~' : ''}${Math.round(nutrition.values.kcal)} kcal`
    : undefined;
  const meta = [recipe.category, minutes !== undefined ? formatMinutes(minutes) : undefined, kcal]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <Pressable
        onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.8 : 1 }]}>
        {recipe.photoUri ? (
          <Image source={{ uri: recipe.photoUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: c.chip }]}>
            <Text style={styles.thumbEmoji}>🍽️</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
            {recipe.title}
          </Text>
          {meta ? <Text style={[styles.meta, { color: c.textSecondary }]}>{meta}</Text> : null}
          {recipe.tags.length ? (
            <Text style={[styles.tags, { color: c.accent }]} numberOfLines={1}>
              {recipe.tags.map((t) => `#${t}`).join('  ')}
            </Text>
          ) : null}
          {children}
        </View>
      </Pressable>
      {actions ? (
        <View style={[styles.actions, { borderTopColor: c.border }]}>{actions}</View>
      ) : null}
    </View>
  );
}

/** Small text button for a card's `actions` row. */
export function CardAction({
  label,
  onPress,
  emphasis,
  disabled,
}: {
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <Text style={[styles.actionText, { color: emphasis ? c.accent : c.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  thumb: { width: 96, minHeight: 96, alignSelf: 'stretch' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 32 },
  body: { flex: 1, padding: Spacing.three, gap: Spacing.one, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 14 },
  tags: { fontSize: 13, fontWeight: '500' },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
  },
  action: { paddingVertical: 10, paddingHorizontal: Spacing.two },
  actionText: { fontSize: 15, fontWeight: '600' },
});
