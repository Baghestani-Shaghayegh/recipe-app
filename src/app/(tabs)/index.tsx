import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useMemo, useState } from 'react';
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
import { FilterBar, type FilterGroup, type FilterToggle } from '@/components/filter-bar';
import { categoryGroup, dietGroup, timeGroup } from '@/components/recipe-filters';
import { Button } from '@/components/ui';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { matchRecipe } from '@/lib/pantry';
import { allTags, filterRecipes, type Category, type Recipe } from '@/lib/recipe';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function RecipeListScreen() {
  const c = useTheme();
  const { recipes, loaded } = useRecipes();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>();
  const [maxMinutes, setMaxMinutes] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [diets, setDiets] = useState<DietId[]>([]);

  const { pantry } = useKitchen();
  const [canMakeOnly, setCanMakeOnly] = useState(false);
  const haveFilter = canMakeOnly && pantry.length > 0;

  const tagOptions = useMemo(() => allTags(recipes), [recipes]);
  const visible = useMemo(() => {
    const found = filterRecipes(recipes, {
      query,
      category,
      maxMinutes,
      tags,
      favoritesOnly,
      diets,
    });
    return haveFilter ? found.filter((r) => !matchRecipe(r, pantry).missing.length) : found;
  }, [recipes, query, category, maxMinutes, tags, favoritesOnly, diets, haveFilter, pantry]);
  const hasFilters =
    !!query ||
    !!category ||
    maxMinutes !== undefined ||
    tags.length > 0 ||
    favoritesOnly ||
    diets.length > 0 ||
    haveFilter;

  const clearFilters = () => {
    setQuery('');
    setCategory(undefined);
    setMaxMinutes(undefined);
    setTags([]);
    setFavoritesOnly(false);
    setDiets([]);
    setCanMakeOnly(false);
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
    ...(pantry.length
      ? [
          {
            key: 'have',
            label: 'Only what I have',
            section: 'Ingredients',
            on: canMakeOnly,
            onChange: setCanMakeOnly,
          },
        ]
      : []),
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

  const headerButtons = () => (
    <View style={styles.headerButtons}>
      <Pressable
        onPress={() => router.push('/recipe/import')}
        hitSlop={8}
        accessibilityRole="button">
        <Text style={[styles.headerButton, { color: c.accent }]}>Import</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/recipe/edit')} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.headerButton, { color: c.accent }]}>+ Add</Text>
      </Pressable>
    </View>
  );

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const filters = (
    <View style={styles.filters}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search recipes or ingredients"
        placeholderTextColor={c.textSecondary}
        clearButtonMode="while-editing"
        style={[styles.search, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
      />
      <FilterBar groups={filterGroups} toggles={filterToggles} resultCount={visible.length} />
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
      <Tabs.Screen options={{ headerRight: headerButtons }} />
      <FlatList
        data={cells}
        keyExtractor={(r) => r?.id ?? 'filler'}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        // An empty cell after an odd last tile keeps it the same width as the others.
        renderItem={({ item }) =>
          item ? <RecipeCard recipe={item} /> : <View style={styles.filler} />
        }
        ListHeaderComponent={filters}
        ListEmptyComponent={
          recipes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No recipes yet</Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                Add your first recipe to start your collection.
              </Text>
              <Button label="Add a recipe" onPress={() => router.push('/recipe/edit')} />
              <Button
                label="Import a recipe"
                variant="secondary"
                onPress={() => router.push('/recipe/import')}
              />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                No recipes match these filters.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
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
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButtons: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.two },
  headerButton: { fontSize: 17, fontWeight: '600', paddingHorizontal: Spacing.two },
  list: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  filters: { gap: Spacing.three, marginBottom: Spacing.two },
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
