import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Chip, Field } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { parseIngredientList } from '@/lib/ingredients';
import { estimateNutrition, type Nutrients } from '@/lib/nutrition';
import { deleteRecipePhoto, pickRecipePhoto } from '@/lib/photos';
import { CATEGORIES, parseTags, type Category, type Recipe } from '@/lib/recipe';
import { getRecipeDraft } from '@/store/draft';
import { useRecipes, type RecipeInput } from '@/store/recipes';

/** "" -> undefined, "12" -> 12, anything else -> NaN (shown as an error). */
function parseWholeNumber(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** Like parseWholeNumber but allows decimals ("12.5" or "12,5"). */
function parseDecimal(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const numText = (n: number | undefined) => (n === undefined ? '' : String(n));

const NUTRIENT_FIELDS = [
  { key: 'kcal', label: 'Calories', placeholder: '350' },
  { key: 'protein', label: 'Protein (g)', placeholder: '20' },
  { key: 'carbs', label: 'Carbs (g)', placeholder: '40' },
  { key: 'fat', label: 'Fat (g)', placeholder: '12' },
] as const;
type NutrientKey = (typeof NUTRIENT_FIELDS)[number]['key'];

export default function EditRecipeScreen() {
  const { id, draft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  const { recipes, loaded } = useRecipes();
  // A draft handed over by the import screen.
  const imported = draft ? getRecipeDraft(draft) : undefined;
  // Wait for saved recipes to load, so an edit opened directly (e.g. after a web refresh) starts filled in.
  if (!loaded) return null;
  return (
    <EditForm existing={id ? recipes.find((r) => r.id === id) : undefined} imported={imported} />
  );
}

function EditForm({ existing, imported }: { existing?: Recipe; imported?: RecipeInput }) {
  const c = useTheme();
  const { addRecipe, updateRecipe } = useRecipes();
  // Starting values: the saved recipe when editing, an imported draft, or nothing.
  const start = existing ?? imported;

  const [title, setTitle] = useState(start?.title ?? '');
  const [photoUri, setPhotoUri] = useState(start?.photoUri);
  const [category, setCategory] = useState<Category | undefined>(start?.category);
  const [tags, setTags] = useState(start?.tags.join(', ') ?? '');
  const [servings, setServings] = useState(numText(start?.servings));
  const [prep, setPrep] = useState(numText(start?.prepMinutes));
  const [cook, setCook] = useState(numText(start?.cookMinutes));
  const [ingredients, setIngredients] = useState(
    start?.ingredients.map((i) => i.text).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(start?.steps.join('\n') ?? '');
  const [notes, setNotes] = useState(start?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(start?.sourceUrl ?? '');
  const [nutrition, setNutrition] = useState<Record<NutrientKey, string>>({
    kcal: numText(start?.nutrition?.kcal),
    protein: numText(start?.nutrition?.protein),
    carbs: numText(start?.nutrition?.carbs),
    fat: numText(start?.nutrition?.fat),
  });
  const [error, setError] = useState<string>();

  const estimate = useMemo(
    () =>
      estimateNutrition({
        ingredients: parseIngredientList(ingredients),
        servings: parseWholeNumber(servings) || undefined,
      }),
    [ingredients, servings],
  );

  const choosePhoto = async () => {
    try {
      const uri = await pickRecipePhoto();
      if (!uri) return;
      // A photo picked earlier in this same edit (not the saved one) is no longer needed.
      if (photoUri !== existing?.photoUri) deleteRecipePhoto(photoUri);
      setPhotoUri(uri);
    } catch (e) {
      setError('Could not add that photo.');
      console.warn(e);
    }
  };

  const removePhoto = () => {
    if (photoUri !== existing?.photoUri) deleteRecipePhoto(photoUri);
    setPhotoUri(undefined);
  };

  const cancel = () => {
    if (photoUri !== existing?.photoUri) deleteRecipePhoto(photoUri);
    router.back();
  };

  const save = () => {
    const nums = {
      servings: parseWholeNumber(servings),
      prepMinutes: parseWholeNumber(prep),
      cookMinutes: parseWholeNumber(cook),
    };
    if (!title.trim()) return setError('Give your recipe a name.');
    if (Object.values(nums).some((n) => Number.isNaN(n))) {
      return setError('Servings and times must be whole numbers (like 4 or 30).');
    }
    const nutrients = {
      kcal: parseDecimal(nutrition.kcal),
      protein: parseDecimal(nutrition.protein),
      carbs: parseDecimal(nutrition.carbs),
      fat: parseDecimal(nutrition.fat),
    };
    const filled = Object.values(nutrients).filter((n) => n !== undefined);
    if (filled.some((n) => Number.isNaN(n))) {
      return setError('Nutrition values must be numbers (like 350 or 12.5).');
    }
    if (filled.length && filled.length < 4) {
      return setError(
        'Fill in all four nutrition values, or leave them all empty to use the estimate.',
      );
    }

    const input: RecipeInput = {
      title: title.trim(),
      photoUri,
      category,
      tags: parseTags(tags),
      ...nums,
      ingredients: parseIngredientList(ingredients),
      steps: steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notes.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      nutrition: filled.length ? (nutrients as Nutrients) : undefined,
      favorite: existing?.favorite,
      rating: existing?.rating,
    };

    if (existing) {
      if (existing.photoUri !== photoUri) deleteRecipePhoto(existing.photoUri);
      updateRecipe(existing.id, input);
      router.back();
    } else {
      const created = addRecipe(input);
      router.replace({ pathname: '/recipe/[id]', params: { id: created.id } });
    }
  };

  const headerLeft = () => (
    <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Cancel</Text>
    </Pressable>
  );
  const headerRight = () => (
    <Pressable onPress={save} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, styles.bold, { color: c.accent }]}>Save</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit recipe' : imported ? 'Review import' : 'New recipe',
          headerLeft,
          headerRight,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field
          label="Name"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(undefined);
          }}
          placeholder="Grandma’s apple pie"
          autoFocus={!start}
        />

        <View style={styles.group}>
          <Text style={[styles.label, { color: c.text }]}>Photo</Text>
          {photoUri ? (
            <View style={styles.group}>
              <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
              <View style={styles.photoButtons}>
                <Button label="Change photo" variant="secondary" onPress={choosePhoto} />
                <Button label="Remove" variant="danger" onPress={removePhoto} />
              </View>
            </View>
          ) : (
            <Button label="Add a photo" variant="secondary" onPress={choosePhoto} />
          )}
        </View>

        <View style={styles.group}>
          <Text style={[styles.label, { color: c.text }]}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                selected={category === cat}
                onPress={() => setCategory(category === cat ? undefined : cat)}
              />
            ))}
          </View>
        </View>

        <Field
          label="Tags"
          hint="Separate with commas"
          value={tags}
          onChangeText={setTags}
          placeholder="vegetarian, quick, persian"
          autoCapitalize="none"
        />

        <View style={styles.numbers}>
          <View style={styles.number}>
            <Field
              label="Prep (min)"
              value={prep}
              onChangeText={setPrep}
              keyboardType="number-pad"
              placeholder="10"
            />
          </View>
          <View style={styles.number}>
            <Field
              label="Cook (min)"
              value={cook}
              onChangeText={setCook}
              keyboardType="number-pad"
              placeholder="30"
            />
          </View>
          <View style={styles.number}>
            <Field
              label="Servings"
              value={servings}
              onChangeText={setServings}
              keyboardType="number-pad"
              placeholder="4"
            />
          </View>
        </View>

        <Field
          label="Ingredients"
          hint="One per line, like “2 cups flour”"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
          placeholder={'2 cups flour\n1 tsp salt\n3 eggs'}
        />

        <Field
          label="Steps"
          hint="One step per line"
          value={steps}
          onChangeText={setSteps}
          multiline
          placeholder={'Preheat the oven to 180°C.\nMix the dry ingredients.'}
        />

        <View style={styles.group}>
          <Text style={[styles.label, { color: c.text }]}>Nutrition per serving (optional)</Text>
          <Text style={[styles.hint, { color: c.textSecondary }]}>
            {estimate.countedCount
              ? `Leave empty to use the estimate from your ingredients: about ${Math.round(estimate.perServing.kcal)} kcal per serving.`
              : 'Leave empty to estimate it from your ingredients.'}
          </Text>
          <View style={styles.nutrientGrid}>
            {NUTRIENT_FIELDS.map((f) => (
              <View key={f.key} style={styles.nutrientCell}>
                <Field
                  label={f.label}
                  value={nutrition[f.key]}
                  onChangeText={(t) => {
                    setNutrition((prev) => ({ ...prev, [f.key]: t }));
                    setError(undefined);
                  }}
                  keyboardType="decimal-pad"
                  placeholder={f.placeholder}
                />
              </View>
            ))}
          </View>
        </View>

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Use less sugar next time"
        />

        <Field
          label="Source link"
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
        />

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
        <Button label={existing ? 'Save changes' : 'Save recipe'} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerButton: { fontSize: 17, paddingHorizontal: Spacing.two },
  bold: { fontWeight: '700' },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six * 2,
  },
  group: { gap: Spacing.two },
  label: { fontSize: 15, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14 },
  photoButtons: { flexDirection: 'row', gap: Spacing.two },
  numbers: { flexDirection: 'row', gap: Spacing.three },
  number: { flex: 1 },
  hint: { fontSize: 13 },
  nutrientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  nutrientCell: { flexBasis: '45%', flexGrow: 1 },
  error: { fontSize: 15, fontWeight: '600' },
});
