import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Chip } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { daysLeft, describeExpiry, EXPIRY_OPTIONS, expiryIn, USE_SOON_DAYS } from '@/lib/expiry';
import { useKitchen } from '@/store/kitchen';

export default function PantryScreen() {
  const c = useTheme();
  const { pantry, addToPantry, removeFromPantry, expiry, setExpiry } = useKitchen();
  const [editing, setEditing] = useState<string>();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string>();

  const sorted = useMemo(() => [...pantry].sort((a, b) => a.localeCompare(b)), [pantry]);

  const add = () => {
    if (!text.trim()) return;
    const added = addToPantry(text);
    setMessage(added ? undefined : 'Already in your pantry.');
    setText('');
  };

  const header = (
    <View style={styles.header}>
      <Text style={[styles.intro, { color: c.textSecondary }]}>
        Add what you have at home. Salt, pepper, oil and water are always counted as there.
      </Text>
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setMessage(undefined);
          }}
          onSubmitEditing={add}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder="eggs, milk, rice…"
          placeholderTextColor={c.textSecondary}
          autoCapitalize="none"
          style={[styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]}
        />
        <Button label="Add" onPress={add} disabled={!text.trim()} />
      </View>
      {message ? <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text> : null}
      {pantry.length ? (
        <Pressable onPress={() => router.navigate('/cook')} accessibilityRole="link">
          <Text style={[styles.link, { color: c.accent }]}>See what I can make →</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={[styles.itemBlock, { borderBottomColor: c.border }]}>
            <View style={styles.item}>
              <Pressable
                style={styles.itemMain}
                onPress={() => setEditing(editing === item ? undefined : item)}
                accessibilityRole="button"
                accessibilityLabel={`Best-before date for ${item}`}>
                <Text style={[styles.itemText, { color: c.text }]}>{item}</Text>
                {expiry[item] ? (
                  <Text
                    style={[
                      styles.expiry,
                      {
                        color: daysLeft(expiry[item]) <= USE_SOON_DAYS ? c.danger : c.textSecondary,
                      },
                    ]}>
                    {describeExpiry(daysLeft(expiry[item]))}
                  </Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => removeFromPantry(item)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}>
                <Ionicons name="close-circle" size={22} color={c.textSecondary} />
              </Pressable>
            </View>
            {editing === item ? (
              <View style={styles.expiryRow}>
                <Text style={[styles.expiry, { color: c.textSecondary }]}>Use within</Text>
                {EXPIRY_OPTIONS.map((o) => (
                  <Chip
                    key={o.days}
                    label={o.label}
                    selected={expiry[item] === expiryIn(o.days)}
                    onPress={() => {
                      setExpiry(item, expiryIn(o.days));
                      setEditing(undefined);
                    }}
                  />
                ))}
                {expiry[item] ? (
                  <Chip
                    label="No date"
                    onPress={() => {
                      setExpiry(item, undefined);
                      setEditing(undefined);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textSecondary }]}>Your pantry is empty.</Text>
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  intro: { fontSize: 15, lineHeight: 21 },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  message: { fontSize: 14 },
  link: { fontSize: 15, fontWeight: '600' },
  itemBlock: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemMain: { flex: 1, gap: 2 },
  expiry: { fontSize: 13 },
  expiryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  itemText: { fontSize: 16, textTransform: 'capitalize' },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: Spacing.five },
});
