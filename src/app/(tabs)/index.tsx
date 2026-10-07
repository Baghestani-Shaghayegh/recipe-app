import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { RecipeCard } from '@/components/recipe-card';
import { Button, Chip } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { allTags, CATEGORIES, filterRecipes, TIME_FILTERS, type Category } from '@/lib/recipe';
import { useRecipes } from '@/store/recipes';

export default function RecipeListScreen() {
  const c = useTheme();
  const { recipes, loaded } = useRecipes();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>();
  const [maxMinutes, setMaxMinutes] = useState<number>();
  const [tags, setTags] = useState<string[]>([]);

  const tagOptions = useMemo(() => allTags(recipes), [recipes]);
  const visible = useMemo(
    () => filterRecipes(recipes, { query, category, maxMinutes, tags }),
    [recipes, query, category, maxMinutes, tags],
  );
  const hasFilters = !!query || !!category || maxMinutes !== undefined || tags.length > 0;

  const clearFilters = () => {
    setQuery('');
    setCategory(undefined);
    setMaxMinutes(undefined);
    setTags([]);
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

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
        {tagOptions.map((t) => (
          <Chip key={t} label={`#${t}`} selected={tags.includes(t)} onPress={() => toggleTag(t)} />
        ))}
      </ScrollView>
      {hasFilters ? (
        <Pressable onPress={clearFilters} accessibilityRole="button">
          <Text style={[styles.clear, { color: c.accent }]}>
            Clear filters · {visible.length} of {recipes.length}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Tabs.Screen options={{ headerRight: headerButtons }} />
      <FlatList
        data={visible}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
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
                label="Import from Instagram"
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
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  filters: { gap: Spacing.three, marginBottom: Spacing.two },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
    fontSize: 16,
  },
  chipRow: { gap: Spacing.two },
  clear: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
