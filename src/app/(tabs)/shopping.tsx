import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { STORE_SECTIONS } from '@/lib/foods';
import type { Recipe } from '@/lib/recipe';
import { buildShoppingList, shoppingListText } from '@/lib/shopping';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';
import { extraKey, useShopping } from '@/store/shopping';

export default function ShoppingScreen() {
  const c = useTheme();
  const { recipes } = useRecipes();
  const { makeNext, pantry, addToPantry } = useKitchen();
  const { isChecked, toggleChecked, extras, addExtras, removeExtra, clearChecked } = useShopping();
  const [text, setText] = useState('');
  const [note, setNote] = useState<string>();

  const queue = useMemo(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    return makeNext.map((m) => byId.get(m.recipeId)).filter((r): r is Recipe => !!r);
  }, [recipes, makeNext]);
  const items = useMemo(() => buildShoppingList(queue, pantry), [queue, pantry]);

  const tickedItems = items.filter((i) => isChecked(i.key));
  const tickedCount = tickedItems.length + extras.filter((e) => isChecked(extraKey(e.id))).length;

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(undefined), 2500);
    return () => clearTimeout(t);
  }, [note]);

  const add = () => {
    if (!text.trim()) return;
    addExtras(text);
    setText('');
  };

  const copyList = async () => {
    const left = [
      ...items.filter((i) => !isChecked(i.key)),
      ...extras
        .filter((e) => !isChecked(extraKey(e.id)))
        .map((e) => ({ name: e.name, section: 'Other' as const })),
    ];
    if (!left.length) return setNote('Nothing left to buy.');
    try {
      await Clipboard.setStringAsync(shoppingListText(left, STORE_SECTIONS));
      setNote('Copied! Paste it into a message or your notes.');
    } catch {
      setNote('Couldn’t copy the list.');
    }
  };

  const finishShopping = () => {
    const added = tickedItems.length ? addToPantry(tickedItems.map((i) => i.name).join('\n')) : 0;
    clearChecked();
    setNote(
      added
        ? `Added ${added} item${added === 1 ? '' : 's'} to your pantry.`
        : 'Cleared ticked items.',
    );
  };

  const headerRight = () => (
    <Pressable onPress={copyList} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Copy</Text>
    </Pressable>
  );

  const nothingPlanned = !queue.length && !extras.length;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
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
          style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
        />
        <Button label="Add" onPress={add} disabled={!text.trim()} />
      </View>

      {note ? <Text style={[styles.note, { color: c.textSecondary }]}>{note}</Text> : null}

      {queue.length ? (
        <Pressable onPress={() => router.navigate('/next')} accessibilityRole="link">
          <Text style={[styles.note, { color: c.textSecondary }]}>
            For {queue.length} recipe{queue.length === 1 ? '' : 's'} in Make next:{' '}
            <Text style={{ color: c.accent }}>{queue.map((r) => r.title).join(', ')}</Text>
            {pantry.length ? '. Things in your pantry are left out.' : '.'}
          </Text>
        </Pressable>
      ) : null}

      {nothingPlanned ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Your list is empty</Text>
          <Text style={[styles.emptyText, { color: c.textSecondary }]}>
            Add recipes to Make next and everything you need shows up here, minus what’s already in
            your pantry.
          </Text>
          <Button
            label="Find something to cook"
            variant="secondary"
            onPress={() => router.navigate('/cook')}
          />
        </View>
      ) : null}

      {queue.length && !items.length ? (
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          You already have everything for your Make next recipes.
        </Text>
      ) : null}

      {STORE_SECTIONS.map((section) => {
        const sectionItems = items.filter((i) => i.section === section);
        if (!sectionItems.length) return null;
        return (
          <View key={section} style={styles.section}>
            <SectionTitle>{section}</SectionTitle>
            {sectionItems.map((item) => (
              <ItemRow
                key={item.key}
                label={item.quantity ? `${item.quantity} ${item.name}` : item.name}
                detail={`for ${item.recipes.join(', ')}`}
                checked={isChecked(item.key)}
                onToggle={() => toggleChecked(item.key)}
              />
            ))}
          </View>
        );
      })}

      {extras.length ? (
        <View style={styles.section}>
          <SectionTitle>Added by you</SectionTitle>
          {extras.map((e) => (
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
              tickedItems.length
                ? `Done: put ${tickedItems.length} ticked in pantry`
                : `Clear ${tickedCount} ticked`
            }
            onPress={finishShopping}
          />
          {tickedItems.length && tickedCount > tickedItems.length ? (
            <Text style={[styles.note, { color: c.textSecondary }]}>
              Ticked items you added yourself are just removed.
            </Text>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
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
