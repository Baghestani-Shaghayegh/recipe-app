import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { AddToPlanSheet } from '@/components/add-to-plan-sheet';
import { Toast, type ToastMessage } from '@/components/toast';
import { NutritionPanel } from '@/components/nutrition-panel';
import { Button, Chip, confirm, SectionTitle } from '@/components/ui';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { isStaple, pantryHas } from '@/lib/pantry';
import { dayName, MEAL_LABELS } from '@/lib/plan';
import { recipeToText, sharedPayload } from '@/lib/share';
import { findSubstitutions } from '@/lib/substitutions';
import { deleteRecipePhoto } from '@/lib/photos';
import { formatMinutes, MAX_RATING, nextRating, totalMinutes } from '@/lib/recipe';
import { MAX_SERVINGS, MIN_SERVINGS, scaleFactor, scaleIngredientText } from '@/lib/scale';
import { convertTemperatures, UNIT_SYSTEMS, type UnitSystem } from '@/lib/units';
import { useAccount } from '@/store/account';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function RecipeDetailScreen() {
  const c = useTheme();
  // `servings` comes from a meal prep batch on the Plan, so the amounts match what's cooked.
  const { id, servings: servingsParam } = useLocalSearchParams<{ id: string; servings?: string }>();
  const { recipes, loaded, deleteRecipe, patchRecipe } = useRecipes();
  const { pantry, isInMakeNext, toggleMakeNext, markCooked, cooked } = useKitchen();
  const recipe = recipes.find((r) => r.id === id);
  // Serving size picked on this screen only; the saved recipe is never changed.
  const [chosenServings, setChosenServings] = useState<number | undefined>(() => {
    const n = Number(servingsParam);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  });
  const [units, setUnits] = useState<UnitSystem>('original');
  const [shareNote, setShareNote] = useState<ToastMessage>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const account = useAccount();

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

  const onShare = async () => {
    const message = recipeToText(recipe, { factor, servings, units });
    try {
      await Share.share({ message, title: recipe.title });
    } catch {
      // No share sheet (e.g. some browsers): copy the text instead.
      await Clipboard.setStringAsync(message).catch(() => undefined);
      setShareNote({ title: 'Copied the recipe', detail: 'Paste it into a message', done: true });
    }
  };

  const onShareLink = async () => {
    setShareNote('Making a link…');
    const { link, error } = await account.shareRecipe(sharedPayload(recipe));
    if (!link) return setShareNote(error ?? 'Couldn’t make a link.');
    setShareNote(undefined);
    const message = `${recipe.title}: open it in Recipe Box\n${link}\n\nNo app yet? Here it is as text:\n\n${recipeToText(recipe, { factor, servings, units })}`;
    try {
      await Share.share({ message, title: recipe.title });
    } catch {
      await Clipboard.setStringAsync(message).catch(() => undefined);
      setShareNote({ title: 'Copied the link', detail: 'Paste it into a message', done: true });
    }
  };

  const onDelete = async () => {
    if (await confirm('Delete recipe?', `“${recipe.title}” will be removed.`, 'Delete')) {
      deleteRecipePhoto(recipe.photoUri);
      deleteRecipe(recipe.id);
      router.back();
    }
  };

  const headerButtons = () => (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })}
        hitSlop={8}
        accessibilityRole="button">
        <Text style={[styles.headerButton, { color: c.accent }]}>Edit</Text>
      </Pressable>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="More">
        <Ionicons name="ellipsis-horizontal-circle-outline" size={26} color={c.accent} />
      </Pressable>
    </View>
  );

  // Everything that isn't cooking or shopping lives in the ⋯ menu.
  const fromMenu = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };
  const menuActions: SheetAction[] = [
    ...(Features.mealPlan
      ? [
          {
            label: 'Add to meal plan',
            // iOS can't open the next sheet until the menu has closed.
            onPress: fromMenu(() =>
              setTimeout(() => setPlanning(true), Platform.OS === 'ios' ? 350 : 0),
            ),
          },
        ]
      : []),
    { label: 'Share recipe', onPress: fromMenu(() => void onShare()) },
    {
      label: 'I cooked this',
      onPress: () => {
        setMenuOpen(false);
        markCooked(recipe.id);
        setShareNote({ title: 'Marked as cooked today', done: true });
      },
    },
    ...(Features.accounts && account.session
      ? [{ label: 'Share as link', onPress: fromMenu(() => void onShareLink()) }]
      : []),
    ...(Features.discover && account.configured
      ? [
          {
            label: 'Post a video to Discover',
            onPress: () => {
              setMenuOpen(false);
              router.push({ pathname: '/post/new', params: { recipeId: recipe.id } });
            },
          },
        ]
      : []),
    {
      label: 'Delete recipe',
      danger: true,
      onPress: fromMenu(() => void onDelete()),
    },
  ];

  const listLabel = Features.makeNextTab
    ? inMakeNext
      ? '✓ In make next'
      : '+ Add to make next'
    : inMakeNext
      ? '✓ On shopping list'
      : '+ Shopping list';
  const canCook = Features.cookingMode && recipe.steps.length > 0;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: recipe.title, headerRight: headerButtons }} />
        <ActionSheet visible={menuOpen} actions={menuActions} onClose={() => setMenuOpen(false)} />
        {Features.mealPlan ? (
          <AddToPlanSheet
            recipe={recipe}
            visible={planning}
            onClose={() => setPlanning(false)}
            onPlanned={(day, meal) =>
              setShareNote({
                title: 'Added to your plan',
                detail: `${MEAL_LABELS[meal]} · ${dayName(day)}`,
                done: true,
                action: {
                  label: 'View',
                  onPress: () =>
                    router.navigate({ pathname: '/plan', params: { day, at: String(Date.now()) } }),
                },
              })
            }
          />
        ) : null}

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

        {Features.favoritesAndRatings ? (
          <View style={styles.ratingRow}>
            <Pressable
              onPress={() => patchRecipe(recipe.id, { favorite: !recipe.favorite })}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: !!recipe.favorite }}
              accessibilityLabel={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Text style={[styles.heart, { color: recipe.favorite ? c.accent : c.textSecondary }]}>
                {recipe.favorite ? '♥' : '♡'}
              </Text>
            </Pressable>
            <View style={styles.stars}>
              {Array.from({ length: MAX_RATING }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => patchRecipe(recipe.id, { rating: nextRating(recipe.rating, n) })}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${n} of ${MAX_RATING}`}>
                  <Text
                    style={[
                      styles.star,
                      { color: n <= (recipe.rating ?? 0) ? c.accent : c.textSecondary },
                    ]}>
                    {n <= (recipe.rating ?? 0) ? '★' : '☆'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

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
            {canCook ? (
              <View style={styles.flex}>
                <Button
                  label="Start cooking"
                  onPress={() =>
                    router.push({
                      pathname: '/recipe/cook',
                      params: {
                        id: recipe.id,
                        ...(servings !== undefined && { servings: String(servings) }),
                        units,
                      },
                    })
                  }
                />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button
                label={listLabel}
                variant={canCook || inMakeNext ? 'secondary' : 'primary'}
                onPress={() => toggleMakeNext(recipe.id)}
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
            {Features.unitSwitch ? (
              <View style={styles.unitRow}>
                {UNIT_SYSTEMS.map((u) => (
                  <Chip
                    key={u.id}
                    label={u.label}
                    selected={units === u.id}
                    onPress={() => setUnits(u.id)}
                  />
                ))}
              </View>
            ) : null}
            {Features.scaleServings && baseServings !== undefined && servings !== undefined ? (
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
                    style={[
                      styles.bullet,
                      { color: status === 'have' ? c.accent : c.textSecondary },
                    ]}
                    accessibilityLabel={
                      status === 'have' ? 'In pantry' : status === 'missing' ? 'Missing' : undefined
                    }>
                    {status === 'have' ? '✓' : status === 'missing' ? '○' : '•'}
                  </Text>
                  <View style={styles.flex}>
                    <Text style={[styles.body, { color: c.text }]}>
                      {scaleIngredientText(ing, factor, units)}
                    </Text>
                    {Features.substitutions &&
                    status === 'missing' &&
                    findSubstitutions(ing.name) ? (
                      <Text style={[styles.swap, { color: c.textSecondary }]}>
                        No {ing.name.split(',')[0]}? Try: {findSubstitutions(ing.name)!.join('; ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {Features.nutrition ? <NutritionPanel recipe={recipe} /> : null}

        {recipe.steps.length ? (
          <View style={styles.block}>
            <SectionTitle>Steps</SectionTitle>
            {recipe.steps.map((step, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.stepNumber, { color: c.accent }]}>{i + 1}</Text>
                <Text style={[styles.body, { color: c.text }]}>
                  {convertTemperatures(step, units)}
                </Text>
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
      </ScrollView>
      <Toast message={shareNote} onHide={() => setShareNote(undefined)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingRight: Spacing.two,
  },
  headerButton: { fontSize: 17, fontWeight: '600' },
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
  swap: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  unitRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four },
  heart: { fontSize: 30, lineHeight: 34 },
  stars: { flexDirection: 'row', gap: Spacing.one },
  star: { fontSize: 28, lineHeight: 34 },
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
