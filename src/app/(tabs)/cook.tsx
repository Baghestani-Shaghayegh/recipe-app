import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardAction, RecipeCard } from '@/components/recipe-card';
import { Button, Chip, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { recommend, type RecipeMatch } from '@/lib/pantry';
import { CATEGORIES, filterRecipes, TIME_FILTERS, type Category } from '@/lib/recipe';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function CookNowScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { pantry } = useKitchen();
  const [category, setCategory] = useState<Category>();
  const [maxMinutes, setMaxMinutes] = useState<number>();

  const { ready, almost } = useMemo(
    () => recommend(filterRecipes(recipes, { query: '', category, maxMinutes, tags: [] }), pantry),
    [recipes, pantry, category, maxMinutes],
  );

  if (!pantry.length) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>What’s in your kitchen?</Text>
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          Add the ingredients you have to your pantry, and this page will show which recipes you can
          make.
        </Text>
        <Button label="Fill my pantry" onPress={() => router.navigate('/pantry')} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(category === cat ? undefined : cat)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {TIME_FILTERS.map((t) => (
            <Chip
              key={t.maxMinutes}
              label={t.label}
              selected={maxMinutes === t.maxMinutes}
              onPress={() => setMaxMinutes(maxMinutes === t.maxMinutes ? undefined : t.maxMinutes)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionTitle>Ready to cook ({ready.length})</SectionTitle>
        {ready.length ? (
          ready.map((m) => <MatchCard key={m.recipe.id} match={m} />)
        ) : (
          <Text style={[styles.none, { color: c.textSecondary }]}>
            Nothing you can make with exactly what you have yet.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle>Almost there ({almost.length})</SectionTitle>
        {almost.length ? (
          almost.map((m) => <MatchCard key={m.recipe.id} match={m} />)
        ) : (
          <Text style={[styles.none, { color: c.textSecondary }]}>
            No recipes missing just 1 or 2 things.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function MatchCard({ match }: { match: RecipeMatch }) {
  const c = useTheme();
  const { isInMakeNext, toggleMakeNext } = useKitchen();
  const inList = isInMakeNext(match.recipe.id);
  const total = match.have.length + match.missing.length;

  return (
    <RecipeCard
      recipe={match.recipe}
      actions={
        <CardAction
          label={inList ? '✓ In make next' : '+ Make next'}
          emphasis={!inList}
          onPress={() => toggleMakeNext(match.recipe.id)}
        />
      }>
      {match.missing.length ? (
        <Text style={[styles.missing, { color: c.danger }]} numberOfLines={2}>
          Missing: {match.missing.map((i) => i.name).join(', ')}
        </Text>
      ) : (
        <Text style={[styles.have, { color: c.textSecondary }]}>
          You have all {total} ingredient{total === 1 ? '' : 's'}
        </Text>
      )}
    </RecipeCard>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21, maxWidth: 360 },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  filters: { gap: Spacing.three },
  chipRow: { gap: Spacing.two },
  section: { gap: Spacing.three },
  none: { fontSize: 15 },
  missing: { fontSize: 14, fontWeight: '500' },
  have: { fontSize: 14 },
});
