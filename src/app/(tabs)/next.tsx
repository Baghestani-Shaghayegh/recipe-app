import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardAction, RecipeCard } from '@/components/recipe-card';
import { Button, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import type { Recipe } from '@/lib/recipe';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

const HISTORY_LIMIT = 15;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MakeNextScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { makeNext, moveMakeNext, toggleMakeNext, markCooked, cooked } = useKitchen();

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  // Recipes deleted since being added are skipped.
  const queue = makeNext.map((m) => byId.get(m.recipeId)).filter((r): r is Recipe => !!r);
  const history = cooked
    .map((entry) => ({ entry, recipe: byId.get(entry.recipeId) }))
    .filter((h): h is { entry: (typeof cooked)[number]; recipe: Recipe } => !!h.recipe)
    .slice(0, HISTORY_LIMIT);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      {queue.length ? (
        <View style={styles.section}>
          {queue.map((recipe, i) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              actions={
                <>
                  <CardAction
                    label="↑"
                    onPress={() => moveMakeNext(recipe.id, -1)}
                    disabled={i === 0}
                  />
                  <CardAction
                    label="↓"
                    onPress={() => moveMakeNext(recipe.id, 1)}
                    disabled={i === queue.length - 1}
                  />
                  <View style={styles.spacer} />
                  <CardAction label="Remove" onPress={() => toggleMakeNext(recipe.id)} />
                  <CardAction label="✓ Cooked" emphasis onPress={() => markCooked(recipe.id)} />
                </>
              }>
              {i === 0 ? <Text style={[styles.upNext, { color: c.accent }]}>Up next</Text> : null}
            </RecipeCard>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing planned yet</Text>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            Tap “Add to make next” on any recipe, or pick one from Cook now.
          </Text>
          <Button label="Browse recipes" variant="secondary" onPress={() => router.navigate('/')} />
        </View>
      )}

      {history.length ? (
        <View style={styles.section}>
          <SectionTitle>Recently cooked</SectionTitle>
          {history.map(({ entry, recipe }) => (
            <Pressable
              key={`${entry.recipeId}-${entry.cookedAt}`}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
              accessibilityRole="button"
              style={[styles.historyRow, { borderBottomColor: c.border }]}>
              <Text style={[styles.historyTitle, { color: c.text }]} numberOfLines={1}>
                {recipe.title}
              </Text>
              <Text style={[styles.historyDate, { color: c.textSecondary }]}>
                {formatDate(entry.cookedAt)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  section: { gap: Spacing.three },
  spacer: { flex: 1 },
  upNext: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21, maxWidth: 360 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyTitle: { flex: 1, fontSize: 16 },
  historyDate: { fontSize: 15 },
});
