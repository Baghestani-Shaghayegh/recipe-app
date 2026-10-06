import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, confirm, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { deleteRecipePhoto } from '@/lib/photos';
import { formatMinutes, totalMinutes } from '@/lib/recipe';
import { useRecipes } from '@/store/recipes';

export default function RecipeDetailScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, loaded, deleteRecipe } = useRecipes();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {loaded ? <Text style={{ color: c.textSecondary }}>This recipe doesn’t exist anymore.</Text> : null}
      </View>
    );
  }

  const total = totalMinutes(recipe);
  const facts = [
    recipe.prepMinutes !== undefined ? ['Prep', formatMinutes(recipe.prepMinutes)] : undefined,
    recipe.cookMinutes !== undefined ? ['Cook', formatMinutes(recipe.cookMinutes)] : undefined,
    total !== undefined ? ['Total', formatMinutes(total)] : undefined,
    recipe.servings !== undefined ? ['Serves', String(recipe.servings)] : undefined,
  ].filter((f): f is string[] => !!f);

  const onDelete = async () => {
    if (await confirm('Delete recipe?', `“${recipe.title}” will be removed.`, 'Delete')) {
      deleteRecipePhoto(recipe.photoUri);
      deleteRecipe(recipe.id);
      router.back();
    }
  };

  const editButton = () => (
    <Pressable
      onPress={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })}
      hitSlop={8}
      accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Edit</Text>
    </Pressable>
  );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: recipe.title, headerRight: editButton }} />

      {recipe.photoUri ? (
        <Image source={{ uri: recipe.photoUri }} style={styles.photo} contentFit="cover" />
      ) : null}

      <View style={styles.block}>
        <Text style={[styles.title, { color: c.text }]}>{recipe.title}</Text>
        {recipe.category || recipe.tags.length ? (
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            {[recipe.category, ...recipe.tags.map((t) => `#${t}`)].filter(Boolean).join('  ·  ')}
          </Text>
        ) : null}
      </View>

      {facts.length ? (
        <View style={[styles.facts, { backgroundColor: c.card, borderColor: c.border }]}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={[styles.factLabel, { color: c.textSecondary }]}>{label}</Text>
              <Text style={[styles.factValue, { color: c.text }]}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recipe.ingredients.length ? (
        <View style={styles.block}>
          <SectionTitle>Ingredients</SectionTitle>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.bullet, { color: c.accent }]}>•</Text>
              <Text style={[styles.body, { color: c.text }]}>{ing.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recipe.steps.length ? (
        <View style={styles.block}>
          <SectionTitle>Steps</SectionTitle>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.stepNumber, { color: c.accent }]}>{i + 1}</Text>
              <Text style={[styles.body, { color: c.text }]}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {recipe.notes ? (
        <View style={styles.block}>
          <SectionTitle>Notes</SectionTitle>
          <Text style={[styles.body, { color: c.text }]}>{recipe.notes}</Text>
        </View>
      ) : null}

      {recipe.sourceUrl ? (
        <Pressable onPress={() => Linking.openURL(recipe.sourceUrl!)} accessibilityRole="link">
          <Text style={[styles.link, { color: c.accent }]} numberOfLines={1}>
            Source: {recipe.sourceUrl}
          </Text>
        </Pressable>
      ) : null}

      <Button label="Delete recipe" variant="danger" onPress={onDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerButton: { fontSize: 17, fontWeight: '600', paddingHorizontal: Spacing.two },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six * 2,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16 },
  block: { gap: Spacing.two },
  title: { fontSize: 28, fontWeight: '800' },
  meta: { fontSize: 15 },
  facts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.four,
  },
  fact: { alignItems: 'center', gap: 2 },
  factLabel: { fontSize: 13 },
  factValue: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  bullet: { fontSize: 18, lineHeight: 24 },
  stepNumber: { fontSize: 16, fontWeight: '800', lineHeight: 24, minWidth: 18 },
  body: { flex: 1, fontSize: 16, lineHeight: 24 },
  link: { fontSize: 15 },
});
