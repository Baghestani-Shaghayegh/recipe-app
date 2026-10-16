import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CardAction, RecipeCard, RecipeGrid } from '@/components/recipe-card';
import { PantryList } from '@/components/pantry-list';
import { Button, Chip, SectionTitle, Segmented } from '@/components/ui';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { describeExpiry, expiringItems, recipesToUseUp } from '@/lib/expiry';
import { suggestForYou } from '@/lib/suggest';
import { recommend, type RecipeMatch } from '@/lib/pantry';
import { DIETS, type DietId } from '@/lib/diet';
import { CATEGORIES, filterRecipes, TIME_FILTERS, type Category } from '@/lib/recipe';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function CookScreen() {
  const c = useTheme();
  const { pantry } = useKitchen();
  // Starts on the pantry until there's something in it.
  const [view, setView] = useState<'cook' | 'pantry'>();
  const current = view ?? (pantry.length ? 'cook' : 'pantry');

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <View style={styles.segmentWrap}>
        <Segmented
          value={current}
          onChange={setView}
          options={[
            { value: 'cook', label: 'What can I make' },
            { value: 'pantry', label: `My pantry (${pantry.length})` },
          ]}
        />
      </View>
      {current === 'pantry' ? (
        <PantryList onSeeRecipes={() => setView('cook')} />
      ) : (
        <Suggestions onOpenPantry={() => setView('pantry')} />
      )}
    </View>
  );
}

function Suggestions({ onOpenPantry }: { onOpenPantry: () => void }) {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { pantry, expiry, cooked } = useKitchen();
  const [category, setCategory] = useState<Category>();
  const [maxMinutes, setMaxMinutes] = useState<number>();
  const [diets, setDiets] = useState<DietId[]>([]);

  const { ready, almost } = useMemo(
    () =>
      recommend(
        filterRecipes(recipes, { query: '', category, maxMinutes, tags: [], diets }),
        pantry,
      ),
    [recipes, pantry, category, maxMinutes, diets],
  );

  const useSoon = useMemo(() => {
    const filtered = filterRecipes(recipes, { query: '', category, maxMinutes, tags: [], diets });
    return recipesToUseUp(filtered, expiringItems(pantry, expiry));
  }, [recipes, pantry, expiry, category, maxMinutes, diets]);

  const forYou = useMemo(() => suggestForYou(recipes, cooked), [recipes, cooked]);

  if (!pantry.length) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>What’s in your kitchen?</Text>
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          Add the ingredients you have to your pantry, and this page will show which recipes you can
          make.
        </Text>
        <Button label="Fill my pantry" onPress={onOpenPantry} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <View style={styles.filters}>
        <View style={styles.wrapRow}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(category === cat ? undefined : cat)}
            />
          ))}
        </View>
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
        {Features.dietFilters ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}>
            {DIETS.map((d) => (
              <Chip
                key={d.id}
                label={d.label}
                selected={diets.includes(d.id)}
                onPress={() =>
                  setDiets((prev) =>
                    prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                  )
                }
              />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {Features.expiryDates && useSoon.length ? (
        <View style={styles.section}>
          <SectionTitle>Use it up ({useSoon.length})</SectionTitle>
          <RecipeGrid>
            {useSoon.map(({ recipe, uses }) => (
              <RecipeCard key={recipe.id} recipe={recipe}>
                <Text style={[styles.missing, { color: c.danger }]} numberOfLines={3}>
                  Uses{' '}
                  {uses
                    .map((u) => `${u.item} (${describeExpiry(u.daysLeft).toLowerCase()})`)
                    .join(', ')}
                </Text>
              </RecipeCard>
            ))}
          </RecipeGrid>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionTitle>Ready to cook ({ready.length})</SectionTitle>
        {ready.length ? (
          <RecipeGrid>
            {ready.map((m) => (
              <MatchCard key={m.recipe.id} match={m} />
            ))}
          </RecipeGrid>
        ) : (
          <Text style={[styles.none, { color: c.textSecondary }]}>
            Nothing you can make with exactly what you have yet.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle>Almost there ({almost.length})</SectionTitle>
        {almost.length ? (
          <RecipeGrid>
            {almost.map((m) => (
              <MatchCard key={m.recipe.id} match={m} />
            ))}
          </RecipeGrid>
        ) : (
          <Text style={[styles.none, { color: c.textSecondary }]}>
            No recipes missing just 1 or 2 things.
          </Text>
        )}
      </View>
      {Features.suggestions && forYou.length ? (
        <View style={styles.section}>
          <SectionTitle>You might like</SectionTitle>
          <RecipeGrid>
            {forYou.map(({ recipe, similarTo }) => (
              <RecipeCard key={recipe.id} recipe={recipe}>
                <Text style={[styles.have, { color: c.textSecondary }]} numberOfLines={2}>
                  Similar to {similarTo.title}
                </Text>
              </RecipeCard>
            ))}
          </RecipeGrid>
        </View>
      ) : null}
    </ScrollView>
  );
}

function MatchCard({ match }: { match: RecipeMatch }) {
  const c = useTheme();
  const { isInMakeNext, toggleMakeNext } = useKitchen();
  const inList = isInMakeNext(match.recipe.id);
  const total = match.have.length + match.missing.length;
  const missing = match.missing.length > 0;

  // Version 1 has no Make next tab: the list is "what I'm shopping for" on the Shopping tab.
  const listLabel = Features.makeNextTab
    ? inList
      ? '✓ In make next'
      : '+ Make next'
    : inList
      ? '✓ On shopping list'
      : '+ Shopping list';

  return (
    <RecipeCard
      recipe={match.recipe}
      actions={
        missing || Features.makeNextTab ? (
          <CardAction
            label={listLabel}
            emphasis={!inList}
            onPress={() => toggleMakeNext(match.recipe.id)}
          />
        ) : Features.cookingMode && match.recipe.steps.length ? (
          <CardAction
            label="Start cooking"
            emphasis
            onPress={() =>
              router.push({ pathname: '/recipe/cook', params: { id: match.recipe.id } })
            }
          />
        ) : undefined
      }>
      {missing ? (
        <Text style={[styles.missing, { color: c.danger }]} numberOfLines={2}>
          Missing: {match.missing.map((i) => i.name).join(', ')}
        </Text>
      ) : (
        <Text style={[styles.have, { color: c.textSecondary }]} numberOfLines={2}>
          You have all {total} ingredient{total === 1 ? '' : 's'}
        </Text>
      )}
    </RecipeCard>
  );
}

const styles = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  screen: { flex: 1 },
  segmentWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
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
