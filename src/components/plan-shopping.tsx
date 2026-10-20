import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Segmented } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { STORE_SECTIONS } from '@/lib/foods';
import { mealKey, plannedMeals, shopRangeDays, type ShopRange } from '@/lib/plan';
import type { Recipe } from '@/lib/recipe';
import { mealsShopping } from '@/lib/shopping';
import { useKitchen } from '@/store/kitchen';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';
import { useShopping } from '@/store/shopping';

const RANGE_LABELS: Record<ShopRange, string> = {
  today: 'Today',
  next3: 'Next 3 days',
  week: 'Rest of week',
};

/** The planned meals on `days` that aren't on the shopping list yet, with their recipes. */
function usePending(days: string[]) {
  const { plan, shopped } = usePlan();
  const { recipes } = useRecipes();
  const { pantry } = useKitchen();
  return useMemo(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const meals = plannedMeals(plan, days).filter(
      (m) => byId.has(m.recipeId) && !shopped.includes(mealKey(m)),
    );
    const mealRecipes = meals.map((m) => byId.get(m.recipeId)!);
    return { meals, recipes: mealRecipes, ...mealsShopping(mealRecipes, pantry) };
  }, [plan, shopped, recipes, pantry, days]);
}

/**
 * The bar at the bottom of the Plan tab ("5 meals planned · Missing 14 ingredients"), and the Review
 * sheet that adds what the meals need to the shopping list.
 */
export function PlanShoppingBar({ week, today }: { week: string[]; today: string }) {
  const c = useTheme();
  const { plan } = usePlan();
  const weekLeft = useMemo(() => shopRangeDays(week, today, 'week'), [week, today]);
  const planned = plannedMeals(plan, weekLeft).length;
  const pending = usePending(weekLeft);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string>();

  if (!planned && !note) return null;
  const allAdded = !pending.meals.length;

  return (
    <>
      <View style={[styles.bar, { backgroundColor: c.text }]}>
        <Ionicons
          name={allAdded ? 'checkmark-circle' : 'cart-outline'}
          size={24}
          color={c.background}
        />
        <View style={styles.flex}>
          <Text style={[styles.barTitle, { color: c.background }]} numberOfLines={1}>
            {note ?? `${planned} meal${planned === 1 ? '' : 's'} planned`}
          </Text>
          <Text style={[styles.barSub, { color: c.background }]} numberOfLines={1}>
            {allAdded
              ? 'Everything is on your shopping list'
              : pending.items.length
                ? `Missing ${pending.items.length} ingredient${pending.items.length === 1 ? '' : 's'}`
                : 'Nothing missing, you have it all'}
          </Text>
        </View>
        <Pressable
          onPress={() => (allAdded ? router.navigate('/shopping') : setOpen(true))}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.barButton,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.barButtonText, { color: c.accentText }]}>
            {allAdded ? 'Open list' : 'Review'}
          </Text>
        </Pressable>
      </View>
      {open ? (
        <ReviewSheet
          week={week}
          today={today}
          onClose={() => setOpen(false)}
          onAdded={(count) => {
            setNote(`Added ${count} item${count === 1 ? '' : 's'}`);
            setTimeout(() => setNote(undefined), 3000);
          }}
        />
      ) : null}
    </>
  );
}

function ReviewSheet({
  week,
  today,
  onClose,
  onAdded,
}: {
  week: string[];
  today: string;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const c = useTheme();
  const { plan, markShopped } = usePlan();
  const { addFoodItems } = useShopping();
  // A week that hasn't started can only be shopped for as a whole.
  const ranges: ShopRange[] = week.includes(today) ? ['today', 'next3', 'week'] : ['week'];
  const [range, setRange] = useState<ShopRange>('week');
  const days = useMemo(() => shopRangeDays(week, today, range), [week, today, range]);
  const { meals, recipes, items, have } = usePending(days);
  // Everything starts ticked; these are the ones you untick.
  const [skipped, setSkipped] = useState<string[]>([]);
  const [showHave, setShowHave] = useState(false);
  const chosen = items.filter((i) => !skipped.includes(i.key));

  const counts = new Map<Recipe, number>();
  for (const r of recipes) counts.set(r, (counts.get(r) ?? 0) + 1);
  const forLine = (titles: string[]) =>
    titles
      .map((t) => {
        const n = recipes.filter((r) => r.title === t).length;
        return n > 1 ? `${t} ×${n}` : t;
      })
      .join(', ');

  const add = (close: (after?: () => void) => void) => {
    addFoodItems(
      chosen.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        section: i.section,
        recipes: i.recipes,
      })),
    );
    markShopped(meals.map(mealKey));
    close(() => onAdded(chosen.length));
  };

  return (
    <BottomSheet visible title="Shop for your meals" onClose={onClose}>
      {(close) => (
        <View style={styles.sheet}>
          <Text style={[styles.lead, { color: c.textSecondary }]}>
            Everything the recipes need, minus your pantry.
          </Text>
          {ranges.length > 1 ? (
            <Segmented
              value={range}
              options={ranges.map((r) => ({ value: r, label: RANGE_LABELS[r] }))}
              onChange={(r) => {
                setRange(r);
                setSkipped([]);
              }}
            />
          ) : null}

          {recipes.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recipeChips}>
              {[...counts.entries()].map(([r, n]) => (
                <View
                  key={r.id}
                  style={[
                    styles.recipeChip,
                    { backgroundColor: c.background, borderColor: c.border },
                  ]}>
                  {r.photoUri ? (
                    <Image source={{ uri: r.photoUri }} style={styles.recipeChipPhoto} />
                  ) : (
                    <View style={[styles.recipeChipPhoto, { backgroundColor: c.chip }]} />
                  )}
                  <Text style={[styles.recipeChipText, { color: c.text }]} numberOfLines={1}>
                    {r.title}
                    {n > 1 ? <Text style={{ color: c.textSecondary }}> ×{n}</Text> : null}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {!meals.length ? (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                {plannedMeals(plan, days).length
                  ? 'Everything for these days is already on your shopping list.'
                  : 'No meals planned for these days.'}
              </Text>
            ) : !items.length ? (
              <Text style={[styles.empty, { color: c.textSecondary }]}>
                You already have everything for these meals.
              </Text>
            ) : null}

            {STORE_SECTIONS.map((section) => {
              const sectionItems = items.filter((i) => i.section === section);
              if (!sectionItems.length) return null;
              return (
                <View key={section}>
                  <Text style={[styles.section, { color: c.textSecondary }]}>{section}</Text>
                  {sectionItems.map((item) => {
                    const on = !skipped.includes(item.key);
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() =>
                          setSkipped((prev) =>
                            on ? [...prev, item.key] : prev.filter((k) => k !== item.key),
                          )
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={item.name}
                        style={[styles.item, { borderBottomColor: c.border }]}>
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={on ? c.accent : c.textSecondary}
                        />
                        <View style={styles.flex}>
                          <Text style={[styles.itemName, { color: on ? c.text : c.textSecondary }]}>
                            {item.name}
                          </Text>
                          <Text
                            style={[styles.itemFor, { color: c.textSecondary }]}
                            numberOfLines={1}>
                            {forLine(item.recipes)}
                          </Text>
                        </View>
                        {item.quantity ? (
                          <Text style={[styles.qty, { color: c.textSecondary }]}>
                            {item.quantity}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {have.length ? (
              <Pressable
                onPress={() => setShowHave((s) => !s)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showHave }}
                style={[styles.have, { backgroundColor: c.chip }]}>
                <View style={styles.haveRow}>
                  <Text style={[styles.haveText, { color: c.text }]}>
                    ✓ {have.length} thing{have.length === 1 ? '' : 's'} you already have
                  </Text>
                  <Text style={[styles.haveText, { color: c.accent }]}>
                    {showHave ? 'Hide' : 'Show'}
                  </Text>
                </View>
                {showHave ? (
                  <Text style={[styles.itemFor, { color: c.textSecondary }]}>
                    {have.join(', ')}. Change this in your pantry on the Cook tab.
                  </Text>
                ) : null}
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={() => add(close)}
            disabled={!meals.length}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: c.accent, opacity: !meals.length ? 0.4 : pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.ctaText, { color: c.accentText }]}>
              {chosen.length
                ? `Add ${chosen.length} item${chosen.length === 1 ? '' : 's'} to shopping list`
                : meals.length
                  ? 'Mark as shopped'
                  : 'Nothing to add'}
            </Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: Spacing.four,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
    maxWidth: 688,
    alignSelf: 'center',
  },
  barTitle: { fontSize: 15, fontWeight: '700' },
  barSub: { fontSize: 13, opacity: 0.75, marginTop: 1 },
  barButton: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  barButtonText: { fontSize: 14, fontWeight: '700' },
  sheet: { gap: Spacing.three, flexShrink: 1 },
  lead: { fontSize: 14, lineHeight: 20 },
  recipeChips: { gap: Spacing.two },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    maxWidth: 220,
  },
  recipeChipPhoto: { width: 24, height: 24, borderRadius: 12 },
  recipeChipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  list: { flexShrink: 1 },
  listContent: { paddingBottom: Spacing.two },
  empty: { fontSize: 15, lineHeight: 21, paddingVertical: Spacing.four, textAlign: 'center' },
  section: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemFor: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  qty: { fontSize: 14, fontWeight: '600' },
  have: { borderRadius: 12, padding: Spacing.three, marginTop: Spacing.three, gap: Spacing.one },
  haveRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  haveText: { fontSize: 14, fontWeight: '600' },
  cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700' },
});
