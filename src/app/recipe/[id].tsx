import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NutritionPanel } from '@/components/nutrition-panel';
import { Button, confirm, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { isStaple, pantryHas } from '@/lib/pantry';
import { deleteRecipePhoto } from '@/lib/photos';
import { formatMinutes, totalMinutes } from '@/lib/recipe';
import { MAX_SERVINGS, MIN_SERVINGS, scaleFactor, scaleIngredientText } from '@/lib/scale';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function RecipeDetailScreen() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, loaded, deleteRecipe } = useRecipes();
  const { pantry, isInMakeNext, toggleMakeNext, markCooked, cooked } = useKitchen();
  const recipe = recipes.find((r) => r.id === id);
  // Serving size picked on this screen only; the saved recipe is never changed.
  const [chosenServings, setChosenServings] = useState<number>();

  if (!recipe) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {loaded ? (
          <Text style={{ color: c.textSecondary }}>This recipe doesn’t exist anymore.</Text>
        ) : null}
      </View>
    );
  }

  const baseServings = recipe.servings;
  const servings = chosenServings ?? baseServings;
  const factor = scaleFactor(baseServings, servings);
  const total = totalMinutes(recipe);
  const facts = [
    recipe.prepMinutes !== undefined ? ['Prep', formatMinutes(recipe.prepMinutes)] : undefined,
    recipe.cookMinutes !== undefined ? ['Cook', formatMinutes(recipe.cookMinutes)] : undefined,
    total !== undefined ? ['Total', formatMinutes(total)] : undefined,
    baseServings !== undefined ? ['Serves', String(baseServings)] : undefined,
  ].filter((f): f is string[] => !!f);

  const inMakeNext = isInMakeNext(recipe.id);
  const timesCooked = cooked.filter((e) => e.recipeId === recipe.id);
  const lastCooked = timesCooked[0]
    ? new Date(timesCooked[0].cookedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : undefined;
  const ingredientStatus = (name: string) =>
    !pantry.length || isStaple(name) ? 'unknown' : pantryHas(pantry, name) ? 'have' : 'missing';
  const counted = recipe.ingredients.filter((i) => ingredientStatus(i.name) !== 'unknown');
  const haveCount = counted.filter((i) => ingredientStatus(i.name) === 'have').length;

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

      <View style={styles.block}>
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button
              label={inMakeNext ? '✓ In make next' : '+ Add to make next'}
              variant={inMakeNext ? 'secondary' : 'primary'}
              onPress={() => toggleMakeNext(recipe.id)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="I cooked this"
              variant="secondary"
              onPress={() => markCooked(recipe.id)}
            />
          </View>
        </View>
        {timesCooked.length ? (
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            Cooked {timesCooked.length === 1 ? 'once' : `${timesCooked.length} times`} · last on{' '}
            {lastCooked}
          </Text>
        ) : null}
      </View>

      {recipe.ingredients.length ? (
        <View style={styles.block}>
          <SectionTitle>Ingredients</SectionTitle>
          {counted.length ? (
            <Text style={[styles.meta, { color: c.textSecondary }]}>
              You have {haveCount} of {counted.length} in your pantry
            </Text>
          ) : null}
          {baseServings !== undefined && servings !== undefined ? (
            <View style={styles.stepper}>
              <Text style={[styles.meta, { color: c.textSecondary }]}>Servings</Text>
              <Pressable
                onPress={() => setChosenServings(Math.max(MIN_SERVINGS, servings - 1))}
                disabled={servings <= MIN_SERVINGS}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Fewer servings"
                style={[styles.stepButton, { borderColor: c.border, backgroundColor: c.card }]}>
                <Text style={[styles.stepButtonText, { color: c.text }]}>−</Text>
              </Pressable>
              <Text style={[styles.servings, { color: c.text }]} accessibilityLiveRegion="polite">
                {servings}
              </Text>
              <Pressable
                onPress={() => setChosenServings(Math.min(MAX_SERVINGS, servings + 1))}
                disabled={servings >= MAX_SERVINGS}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More servings"
                style={[styles.stepButton, { borderColor: c.border, backgroundColor: c.card }]}>
                <Text style={[styles.stepButtonText, { color: c.text }]}>+</Text>
              </Pressable>
              {servings !== baseServings ? (
                <Pressable onPress={() => setChosenServings(undefined)} hitSlop={8}>
                  <Text style={[styles.meta, { color: c.accent }]}>Reset to {baseServings}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {recipe.ingredients.map((ing, i) => {
            const status = ingredientStatus(ing.name);
            return (
              <View key={i} style={styles.row}>
                <Text
                  style={[styles.bullet, { color: status === 'have' ? c.accent : c.textSecondary }]}
                  accessibilityLabel={
                    status === 'have' ? 'In pantry' : status === 'missing' ? 'Missing' : undefined
                  }>
                  {status === 'have' ? '✓' : status === 'missing' ? '○' : '•'}
                </Text>
                <Text style={[styles.body, { color: c.text }]}>{scaleIngredientText(ing, factor)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <NutritionPanel recipe={recipe} />

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
  bullet: { fontSize: 16, lineHeight: 24, minWidth: 18, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { fontSize: 20, fontWeight: '600', lineHeight: 24 },
  servings: { fontSize: 18, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  stepNumber: { fontSize: 16, fontWeight: '800', lineHeight: 24, minWidth: 18 },
  body: { flex: 1, fontSize: 16, lineHeight: 24 },
  link: { fontSize: 15 },
});
