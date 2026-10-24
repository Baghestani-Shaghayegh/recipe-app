import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Toast, type ToastMessage } from '@/components/toast';
import { Button, Chip, SectionTitle } from '@/components/ui';
import { Features } from '@/constants/features';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { SECTION_LABELS, STORE_SECTIONS } from '@/lib/foods';
import { pantryHas } from '@/lib/pantry';
import { dateKey } from '@/lib/plan';
import { buildShoppingList, shoppingKey, shoppingListText, shoppingRecipes } from '@/lib/shopping';
import { useKitchen } from '@/store/kitchen';
import { usePlan } from '@/store/plan';
import { useRecipes } from '@/store/recipes';
import { extraKey, useShopping } from '@/store/shopping';

export default function ShoppingScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { makeNext, pantry, addToPantry, toggleMakeNext } = useKitchen();
  const {
    isChecked,
    toggleChecked,
    extras,
    addExtras,
    removeExtra,
    clearChecked,
    planned,
    removePlanned,
  } = useShopping();
  const { unmarkShopped } = usePlan();
  const [text, setText] = useState('');
  const [note, setNote] = useState<ToastMessage>();

  // Meals added from the plan and Make next recipes make one list: each ingredient once, with
  // the amounts added up, and nothing that's in the pantry.
  const sources = useMemo(
    () =>
      shoppingRecipes(
        makeNext.map((m) => m.recipeId),
        planned,
        new Map(recipes.map((r) => [r.id, r])),
        dateKey(new Date()),
      ),
    [recipes, makeNext, planned],
  );
  const items = useMemo(() => buildShoppingList(sources, pantry), [sources, pantry]);
  // Each recipe once, for the "Shopping for" chips.
  const queue = [...new Map(sources.map((r) => [r.id, r])).values()];
  const stopShopping = (recipeId: string) => {
    if (planned.some((p) => p.recipeId === recipeId)) {
      removePlanned(recipeId);
      unmarkShopped(recipeId);
    }
    if (makeNext.some((m) => m.recipeId === recipeId)) toggleMakeNext(recipeId);
  };

  // Lists from an earlier version may hold plan ingredients as separate rows; they're shown in
  // their store section unless the pantry has them or the list already does.
  const itemKeys = new Set(items.map((i) => i.key));
  const foodExtras = extras.filter(
    (e) => e.section && !pantryHas(pantry, e.name) && !itemKeys.has(shoppingKey(e.name)),
  );
  const ownExtras = extras.filter((e) => !e.section);
  // Food that's ticked goes into the pantry when you're done shopping.
  const tickedFood = [
    ...items.filter((i) => isChecked(i.key)).map((i) => i.name),
    ...foodExtras.filter((e) => isChecked(extraKey(e.id))).map((e) => e.name),
  ];
  const tickedCount =
    items.filter((i) => isChecked(i.key)).length +
    extras.filter((e) => isChecked(extraKey(e.id))).length;

  // Something already on the list isn't added a second time.
  const add = () => {
    if (!text.trim()) return;
    const onList = new Set([...itemKeys, ...extras.map((e) => shoppingKey(e.name))]);
    const names = text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const fresh = names.filter((n) => !onList.has(shoppingKey(n)));
    const already = names.filter((n) => onList.has(shoppingKey(n)));
    if (fresh.length) addExtras(fresh.join('\n'));
    if (already.length) setNote(`Already on your list: ${already.join(', ')}`);
    setText('');
  };

  const copyList = async () => {
    // Just what to buy, without amounts.
    const left = [
      ...items.filter((i) => !isChecked(i.key)).map((i) => ({ name: i.name, section: i.section })),
      ...[...foodExtras, ...ownExtras]
        .filter((e) => !isChecked(extraKey(e.id)))
        .map((e) => ({ name: e.name, section: e.section ?? 'Other' })),
    ];
    if (!left.length) return setNote('Nothing left to buy.');
    try {
      await Clipboard.setStringAsync(shoppingListText(left, STORE_SECTIONS));
      setNote({
        title: 'Copied the list',
        detail: 'Paste it into a message or your notes',
        done: true,
      });
    } catch {
      setNote('Couldn’t copy the list.');
    }
  };

  const finishShopping = () => {
    const added = tickedFood.length ? addToPantry(tickedFood.join('\n')) : 0;
    clearChecked();
    setNote({
      title: added
        ? `Added ${added} item${added === 1 ? '' : 's'} to your pantry`
        : 'Cleared ticked items',
      done: true,
    });
  };

  const headerRight = () => (
    <Pressable onPress={copyList} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Copy</Text>
    </Pressable>
  );

  const nothingPlanned = !queue.length && !foodExtras.length && !ownExtras.length;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Tabs.Screen options={{ headerRight }} />

        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={add}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="Add an item, e.g. paper towels"
            placeholderTextColor={c.textSecondary}
            style={[
              styles.input,
              { color: c.text, backgroundColor: c.card, borderColor: c.border },
            ]}
          />
          <Button label="Add" onPress={add} disabled={!text.trim()} />
        </View>

        {queue.length && !Features.makeNextTab ? (
          <View style={styles.forRecipes}>
            <Text style={[styles.note, { color: c.textSecondary }]}>Shopping for:</Text>
            <View style={styles.chips}>
              {queue.map((r) => (
                <Chip
                  key={r.id}
                  label={`${r.title}  ✕`}
                  onPress={() => stopShopping(r.id)}
                  accessibilityLabel={`Stop shopping for ${r.title}`}
                />
              ))}
            </View>
          </View>
        ) : queue.length ? (
          <Pressable onPress={() => router.navigate('/next')} accessibilityRole="link">
            <Text style={[styles.note, { color: c.textSecondary }]}>
              For {queue.length} recipe{queue.length === 1 ? '' : 's'} from Make next:{' '}
              <Text style={{ color: c.accent }}>{queue.map((r) => r.title).join(', ')}</Text>
              {pantry.length ? '. Things in your pantry are left out.' : '.'}
            </Text>
          </Pressable>
        ) : null}

        {nothingPlanned ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Your list is empty</Text>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              {Features.mealPlan
                ? 'Plan your meals and tap Review on the Plan tab, or tap “+ Shopping list” on a recipe. Everything it needs shows up here, minus what’s already in your pantry.'
                : 'Tap “+ Shopping list” on a recipe and everything it needs shows up here, minus what’s already in your pantry.'}
            </Text>
            <Button
              label="Find something to cook"
              variant="secondary"
              onPress={() => router.navigate(Features.cookTab ? '/cook' : '/')}
            />
          </View>
        ) : null}

        {queue.length && !items.length ? (
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            You already have everything for these recipes.
          </Text>
        ) : null}

        {STORE_SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          const sectionExtras = foodExtras.filter((e) => e.section === section);
          if (!sectionItems.length && !sectionExtras.length) return null;
          return (
            <View key={section} style={styles.section}>
              <SectionTitle>{SECTION_LABELS[section]}</SectionTitle>
              {sectionItems.map((item) => (
                <ItemRow
                  key={item.key}
                  label={item.name}
                  detail={`for ${item.recipes.join(', ')}`}
                  checked={isChecked(item.key)}
                  onToggle={() => toggleChecked(item.key)}
                />
              ))}
              {sectionExtras.map((e) => (
                <ItemRow
                  key={e.id}
                  label={e.name}
                  detail={e.recipes?.length ? `for ${e.recipes.join(', ')}` : undefined}
                  checked={isChecked(extraKey(e.id))}
                  onToggle={() => toggleChecked(extraKey(e.id))}
                  onRemove={() => removeExtra(e.id)}
                />
              ))}
            </View>
          );
        })}

        {ownExtras.length ? (
          <View style={styles.section}>
            <SectionTitle>Added by you</SectionTitle>
            {ownExtras.map((e) => (
              <ItemRow
                key={e.id}
                label={e.name}
                checked={isChecked(extraKey(e.id))}
                onToggle={() => toggleChecked(extraKey(e.id))}
                onRemove={() => removeExtra(e.id)}
              />
            ))}
          </View>
        ) : null}

        {tickedCount ? (
          <View style={styles.section}>
            <Button
              label={
                tickedFood.length
                  ? `Done: put ${tickedFood.length} ticked in pantry`
                  : `Clear ${tickedCount} ticked`
              }
              onPress={finishShopping}
            />
            {tickedFood.length && tickedCount > tickedFood.length ? (
              <Text style={[styles.note, { color: c.textSecondary }]}>
                Ticked items you added yourself are just removed.
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <Toast message={note} onHide={() => setNote(undefined)} />
    </View>
  );
}

function ItemRow({
  label,
  detail,
  checked,
  onToggle,
  onRemove,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.item, { borderBottomColor: c.border }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={styles.itemMain}>
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={24}
          color={checked ? c.accent : c.textSecondary}
        />
        <View style={styles.itemText}>
          <Text
            style={[
              styles.itemLabel,
              { color: checked ? c.textSecondary : c.text },
              checked && styles.done,
            ]}>
            {label}
          </Text>
          {detail ? (
            <Text style={[styles.itemDetail, { color: c.textSecondary }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}>
          <Ionicons name="close-circle" size={22} color={c.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  forRecipes: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  headerButton: { fontSize: 17, fontWeight: '600', paddingHorizontal: Spacing.four },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six,
  },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  note: { fontSize: 14, lineHeight: 20 },
  section: { gap: Spacing.one },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 21, maxWidth: 360 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
  },
  itemText: { flex: 1, gap: 2 },
  itemLabel: { fontSize: 16 },
  itemDetail: { fontSize: 13 },
  done: { textDecorationLine: 'line-through' },
});
