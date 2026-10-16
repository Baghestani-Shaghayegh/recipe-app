import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
import { type Recipe } from '@/lib/recipe';

/**
 * A recipe tile: a square photo with the name under it. Tapping it opens the recipe.
 * The name is cut to two lines so long names never push the tile out of shape.
 * `children` adds extra lines under the name (e.g. "Missing: bread");
 * `actions` sits underneath, for buttons.
 * Tiles fill their parent's width; put them in a `RecipeGrid` (or a 2-column list).
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
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
        accessibilityRole="button"
        accessibilityLabel={recipe.title}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.8 : 1 }]}>
        {recipe.photoUri ? (
          <Image
            source={{ uri: recipe.photoUri }}
            style={[styles.photo, { backgroundColor: c.chip }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photo, styles.placeholder, { backgroundColor: c.chip }]}>
            <Text style={styles.placeholderEmoji}>🍽️</Text>
          </View>
        )}
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2} ellipsizeMode="tail">
          {recipe.title}
        </Text>
        {children}
      </Pressable>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Lays recipe tiles out two per row. A lone last tile keeps the same width as the others. */
export function RecipeGrid({ children }: { children: React.ReactNode[] }) {
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < children.length; i += 2) rows.push(children.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          <View style={styles.gridCell}>{row[0]}</View>
          <View style={styles.gridCell}>{row[1]}</View>
        </View>
      ))}
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
      <Text
        style={[styles.actionText, { color: emphasis ? c.accent : c.textSecondary }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export const GRID_GAP = Spacing.three;

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  body: { gap: Spacing.two },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 14, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 40 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: Spacing.one },
  action: { paddingVertical: 8, paddingRight: Spacing.three, maxWidth: '100%' },
  actionText: { fontSize: 14, fontWeight: '600' },
  grid: { gap: Spacing.four },
  gridRow: { flexDirection: 'row', gap: GRID_GAP },
  gridCell: { flex: 1, minWidth: 0 },
});
