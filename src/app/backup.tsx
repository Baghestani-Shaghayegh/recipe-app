import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
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

import { Button, Field, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { createBackup, parseBackup } from '@/lib/backup';
import { useKitchen } from '@/store/kitchen';
import { useRecipes } from '@/store/recipes';

export default function BackupScreen() {
  const c = useTheme();
  const { recipes, addRecipes } = useRecipes();
  const { pantry, addToPantry } = useKitchen();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(createBackup({ recipes, pantry }));
      setMessage({ text: 'Copied! Paste it into a note or email to yourself to keep it safe.' });
    } catch {
      setMessage({ text: 'Couldn’t copy the backup.', error: true });
    }
  };

  const pasteBackup = async () => {
    try {
      const pasted = await Clipboard.getStringAsync();
      if (pasted) setText(pasted);
      else setMessage({ text: 'Nothing to paste. Copy your backup first.' });
    } catch {
      setMessage({ text: 'Couldn’t read the clipboard. Long-press the box and choose Paste.' });
    }
  };

  const restore = () => {
    const parsed = parseBackup(text);
    if (!parsed.ok) return setMessage({ text: parsed.error, error: true });
    const added = addRecipes(parsed.data.recipes);
    const pantryAdded = addToPantry(parsed.data.pantry.join('\n'));
    setText('');
    setMessage({
      text: `Restored ${added} recipe${added === 1 ? '' : 's'} and ${pantryAdded} pantry item${
        pantryAdded === 1 ? '' : 's'
      }. Anything you already had was kept.`,
    });
  };

  const headerLeft = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Close</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerLeft }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <SectionTitle>Back up</SectionTitle>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Copies your {recipes.length} recipe{recipes.length === 1 ? '' : 's'} and your pantry as
            text. Photos stay on this device and aren’t included.
          </Text>
          <Button label="Copy backup" onPress={copy} />
        </View>

        <View style={styles.group}>
          <SectionTitle>Restore</SectionTitle>
          <Field
            label="Paste a backup"
            hint="Recipes you already have are kept; only new ones are added."
            value={text}
            onChangeText={(t) => {
              setText(t);
              setMessage(undefined);
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.box}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button label="Paste" variant="secondary" onPress={pasteBackup} />
            </View>
            <View style={styles.flex}>
              <Button label="Restore" onPress={restore} disabled={!text.trim()} />
            </View>
          </View>
        </View>

        {message ? (
          <Text style={[styles.body, { color: message.error ? c.danger : c.textSecondary }]}>
            {message.text}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerButton: { fontSize: 17, paddingHorizontal: Spacing.two },
  content: {
    padding: Spacing.four,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six * 2,
  },
  group: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  body: { fontSize: 15, lineHeight: 21 },
  box: { minHeight: 140 },
});
