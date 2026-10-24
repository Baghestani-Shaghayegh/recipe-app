import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type DietId } from '@/lib/diet';
import { GRID_GAP, RecipeCard } from '@/components/recipe-card';
import { AddRecipeMenu } from '@/components/add-recipe-menu';
import { FilterBar, type FilterGroup, type FilterToggle } from '@/components/filter-bar';
import { categoryGroup, dietGroup, timeGroup } from '@/components/recipe-filters';
import { Button } from '@/components/ui';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { recommend } from '@/lib/pantry';
import { shoppingName } from '@/lib/shopping';
import { allTags, filterRecipes, type Category, type Recipe } from '@/lib/recipe';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

/** Choosing a recipe for something else (a meal in the plan) instead of browsing. */
export type RecipePick = {
  /** Shown above the search box, e.g. "Tap a recipe to add it to Lunch · Tue, Oct 20". */
  banner: React.ReactNode;
  /** The category filter to start with. */
  category?: Category;
  /** Shown above the search box too, e.g. leftovers from a meal prep batch. */
  header?: React.ReactNode;
  onPick: (recipe: Recipe) => void;
};

/**
 * Your recipes as a grid with search and filters: the Recipes tab, and the page for choosing a
 * recipe for the meal plan (`pick`).
 */
export function RecipeBrowser({ pick }: { pick?: RecipePick }) {
  const c = useTheme();
  const { recipes, loaded } = useRecipes();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | undefined>(pick?.category);
  const [maxMinutes, setMaxMinutes] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [diets, setDiets] = useState<DietId[]>([]);
  const [adding, setAdding] = useState(false);
  const closeAdding = useCallback(() => setAdding(false), []);

  const { pantry } = useKitchen();
  // Match my pantry: recipes you can make now, then ones missing only 1–2 things.
  const [matchPantry, setMatchPantry] = useState(false);
  const pantryEmpty = matchPantry && !pantry.length;

  const tagOptions = useMemo(() => allTags(recipes), [recipes]);
  const { visible, missing } = useMemo(() => {
    const found = filterRecipes(recipes, {
      query,
      category,
      maxMinutes,
      tags,
      favoritesOnly,
      diets,
    });
    if (!matchPantry) return { visible: found, missing: undefined };
    const { ready, almost } = recommend(found, pantry);
    return {
      visible: [...ready, ...almost].map((m) => m.recipe),
      // What each recipe still needs, by id; empty when you have everything.
      missing: new Map(
        [...ready, ...almost].map((m) => [m.recipe.id, m.missing.map((i) => shoppingName(i.name))]),
      ),
    };
  }, [recipes, query, category, maxMinutes, tags, favoritesOnly, diets, matchPantry, pantry]);
  const hasFilters =
    !!query ||
    !!category ||
    maxMinutes !== undefined ||
    tags.length > 0 ||
    favoritesOnly ||
    diets.length > 0 ||
    matchPantry;

  const clearFilters = () => {
    setQuery('');
    setCategory(undefined);
    setMaxMinutes(undefined);
    setTags([]);
    setFavoritesOnly(false);
    setDiets([]);
    setMatchPantry(false);
  };

  const filterGroups: FilterGroup[] = [
    categoryGroup(category, setCategory),
    timeGroup(maxMinutes, setMaxMinutes),
    ...(Features.dietFilters ? [dietGroup(diets, setDiets)] : []),
    ...(Features.tagFilters && tagOptions.length
      ? [
          {
            key: 'tags',
            title: 'Tags',
            multi: true,
            options: tagOptions.map((t) => ({ value: t, label: `#${t}` })),
            selected: tags,
            onChange: setTags,
          },
        ]
      : []),
  ];
  const filterToggles: FilterToggle[] = [
    ...(Features.favoritesAndRatings
      ? [
          {
            key: 'favorites',
            label: '♥ Favorites',
            section: 'Favorites',
            on: favoritesOnly,
            onChange: setFavoritesOnly,
          },
        ]
      : []),
  ];

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const filters = (
    <View style={styles.filters}>
      {pick ? (
        <Text style={[styles.bannerText, { color: c.textSecondary }]}>{pick.banner}</Text>
      ) : null}
      {pick?.header}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search recipes or ingredients"
        placeholderTextColor={c.textSecondary}
        clearButtonMode="while-editing"
        style={[styles.search, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
      />
      <FilterBar groups={filterGroups} toggles={filterToggles} resultCount={visible.length} />
      <View style={styles.pantryRow}>
        <Pressable
          onPress={() => setMatchPantry((on) => !on)}
          accessibilityRole="switch"
          accessibilityState={{ checked: matchPantry }}
          style={({ pressed }) => [
            styles.matchButton,
            {
              backgroundColor: matchPantry ? c.accent : c.chip,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Ionicons
            name={matchPantry ? 'checkmark-circle' : 'basket-outline'}
            size={18}
            color={matchPantry ? c.accentText : c.text}
          />
          <Text style={[styles.matchText, { color: matchPantry ? c.accentText : c.text }]}>
            Match my pantry
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/pantry')} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.pantryLink, { color: c.accent }]}>
            My pantry ({pantry.length}) ›
          </Text>
        </Pressable>
      </View>
      {pantryEmpty ? (
        <View style={[styles.pantryNote, { backgroundColor: c.chip }]}>
          <Text style={[styles.emptyText, { color: c.text }]}>Your pantry is empty.</Text>
          <Button label="Fill my pantry" onPress={() => router.push('/pantry')} />
        </View>
      ) : null}
      {hasFilters ? (
        <Pressable onPress={clearFilters} accessibilityRole="button">
          <Text style={[styles.clear, { color: c.accent }]}>
            Clear filters · {visible.length} of {recipes.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const cells: (Recipe | null)[] = visible.length % 2 ? [...visible, null] : visible;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <FlatList
        data={cells}
        keyExtractor={(r) => r?.id ?? 'filler'}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        // An empty cell after an odd last tile keeps it the same width as the others.
        renderItem={({ item }) =>
          item ? (
            <RecipeCard recipe={item} onPress={pick ? () => pick.onPick(item) : undefined}>
              {missing ? <PantryLine missing={missing.get(item.id) ?? []} /> : null}
            </RecipeCard>
          ) : (
            <View style={styles.filler} />
          )
        }
        ListHeaderComponent={filters}
        ListEmptyComponent={
          pantryEmpty ? undefined : recipes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No recipes yet</Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {pick
                  ? 'Add some on the Recipes tab, then plan them here.'
                  : 'Save one from Instagram or TikTok, snap a recipe card, or write your own.'}
              </Text>
              {pick ? null : <Button label="Add a recipe" onPress={() => setAdding(true)} />}
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {matchPantry
                  ? 'Nothing you can make yet with your pantry. Try adding a few more things to it.'
                  : 'No recipes match these filters.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          pick ? undefined : (
            <View>
              {Features.accounts ? (
                <Pressable onPress={() => router.push('/account')} accessibilityRole="link">
                  <Text style={[styles.footerLink, { color: c.accent }]}>Account & sync</Text>
                </Pressable>
              ) : null}
              {Features.backup ? (
                <Pressable onPress={() => router.push('/backup')} accessibilityRole="link">
                  <Text style={[styles.footerLink, { color: c.accent }]}>
                    Back up or restore recipes
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        contentContainerStyle={[styles.list, pick && styles.pickList]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      {pick ? null : (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a recipe"
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: c.accent, transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}>
          <Ionicons name="add" size={32} color={c.accentText} />
        </Pressable>
      )}
      {pick ? null : <AddRecipeMenu visible={adding} onClose={closeAdding} />}
    </View>
  );
}

/** Under a card in Match my pantry: "✓ Ready to cook" or "Missing: bread, eggs". */
function PantryLine({ missing }: { missing: string[] }) {
  const c = useTheme();
  return (
    <Text
      style={[styles.pantryLine, { color: missing.length ? c.danger : c.accent }]}
      numberOfLines={2}>
      {missing.length ? `Missing: ${missing.join(', ')}` : '✓ Ready to cook'}
    </Text>
  );
}

const ADD_BUTTON_SIZE = 60;

const styles = StyleSheet.create({
  addButton: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: ADD_BUTTON_SIZE,
    height: ADD_BUTTON_SIZE,
    borderRadius: ADD_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
  },
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    padding: Spacing.four,
    // Room under the last recipes so the + button doesn't cover them.
    paddingBottom: ADD_BUTTON_SIZE + Spacing.four * 2,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  pickList: { paddingBottom: Spacing.six },
  filters: { gap: Spacing.three, marginBottom: Spacing.two },
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  matchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  matchText: { fontSize: 15, fontWeight: '600' },
  pantryLink: { fontSize: 15, fontWeight: '600' },
  pantryNote: { borderRadius: 14, padding: Spacing.four, gap: Spacing.three },
  pantryLine: { fontSize: 13, fontWeight: '600', marginTop: -Spacing.one },
  bannerText: { fontSize: 14, lineHeight: 20 },
  gridRow: { gap: GRID_GAP },
  filler: { flex: 1 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    fontSize: 16,
  },
  footerLink: { fontSize: 14, textAlign: 'center', paddingVertical: Spacing.four },
  clear: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
