import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
import { deleteRecipePhoto, pickRecipePhoto } from '@/lib/photos';
import { CATEGORIES, parseTags, type Category, type Recipe } from '@/lib/recipe';
import { useRecipes, type RecipeInput } from '@/store/recipes';

/** "" -> undefined, "12" -> 12, anything else -> NaN (shown as an error). */
function parseWholeNumber(text: string): number | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

const numText = (n: number | undefined) => (n === undefined ? '' : String(n));

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { recipes, loaded } = useRecipes();
  // Wait for saved recipes to load, so an edit opened directly (e.g. after a web refresh) starts filled in.
  if (!loaded) return null;
  return <EditForm existing={id ? recipes.find((r) => r.id === id) : undefined} />;
}

function EditForm({ existing }: { existing?: Recipe }) {
  const c = useTheme();
  const { addRecipe, updateRecipe } = useRecipes();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [photoUri, setPhotoUri] = useState(existing?.photoUri);
  const [category, setCategory] = useState<Category | undefined>(existing?.category);
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [servings, setServings] = useState(numText(existing?.servings));
  const [prep, setPrep] = useState(numText(existing?.prepMinutes));
  const [cook, setCook] = useState(numText(existing?.cookMinutes));
  const [ingredients, setIngredients] = useState(
    existing?.ingredients.map((i) => i.text).join('\n') ?? '',
  );
  const [steps, setSteps] = useState(existing?.steps.join('\n') ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? '');
  const [error, setError] = useState<string>();

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
        options={{ title: existing ? 'Edit recipe' : 'New recipe', headerLeft, headerRight }}
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
          autoFocus={!existing}
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
            <Field label="Prep (min)" value={prep} onChangeText={setPrep} keyboardType="number-pad" placeholder="10" />
          </View>
          <View style={styles.number}>
            <Field label="Cook (min)" value={cook} onChangeText={setCook} keyboardType="number-pad" placeholder="30" />
          </View>
          <View style={styles.number}>
            <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="4" />
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

        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Use less sugar next time" />

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
  error: { fontSize: 15, fontWeight: '600' },
});
