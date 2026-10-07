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

import { Button, confirm, Field, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { useAccount } from '@/store/account';

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ms).toLocaleString();
}

export default function AccountScreen() {
  const c = useTheme();
  const account = useAccount();
  const { session, household, sync } = account;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const run = async (task: () => Promise<string | undefined>, success?: string) => {
    setBusy(true);
    setMessage(undefined);
    const error = await task();
    setBusy(false);
    setMessage(error ? { text: error, error: true } : success ? { text: success } : undefined);
    return !error;
  };

  const headerLeft = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Close</Text>
    </Pressable>
  );

  const body = !account.configured ? (
    <View style={styles.group}>
      <SectionTitle>Sync isn’t set up</SectionTitle>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        This build of the app isn’t connected to an online project yet. See “Sync and sharing” in
        the README: create a Supabase project, run the SQL in supabase/migrations, and set
        EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.
      </Text>
    </View>
  ) : !session ? (
    <View style={styles.group}>
      <SectionTitle>Sign in to sync</SectionTitle>
      <Text style={[styles.body, { color: c.textSecondary }]}>
        Keeps your recipes, pantry, meal plan and shopping list on all your devices. What’s on this
        device when you sign in is kept and merged.
      </Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label="Password"
        hint="At least 6 characters."
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label="Sign in"
            onPress={() => run(() => account.signIn(email, password))}
            disabled={busy || !email.trim() || !password}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="Create account"
            variant="secondary"
            onPress={() => run(() => account.signUp(email, password))}
            disabled={busy || !email.trim() || password.length < 6}
          />
        </View>
      </View>
    </View>
  ) : (
    <>
      <View style={styles.group}>
        <SectionTitle>Signed in</SectionTitle>
        <Text style={[styles.body, { color: c.text }]}>{session.email}</Text>
        <Text style={[styles.body, { color: sync.error ? c.danger : c.textSecondary }]}>
          {sync.syncing
            ? 'Syncing…'
            : sync.error
              ? `Couldn’t sync: ${sync.message}`
              : sync.lastSynced
                ? `Synced ${timeAgo(sync.lastSynced)}`
                : 'Not synced yet'}
        </Text>
        <Text style={[styles.body, { color: c.textSecondary }]}>
          Changes are sent a few seconds after you make them and checked again whenever you open the
          app. If two devices change the same list, the newer change wins. Photos stay on the device
          they were taken on.
        </Text>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label="Sync now"
              variant="secondary"
              onPress={() => account.syncNow()}
              disabled={sync.syncing}
            />
          </View>
          <View style={styles.flex}>
            <Button label="Sign out" variant="secondary" onPress={account.signOut} />
          </View>
        </View>
      </View>

      <View style={styles.group}>
        <SectionTitle>Shared household</SectionTitle>
        {household ? (
          <>
            <Text style={[styles.body, { color: c.textSecondary }]}>
              You share everything (recipes, pantry, meal plan, shopping list) with the people who
              joined with this code:
            </Text>
            <Text selectable style={[styles.code, { color: c.text }]}>
              {household.code}
            </Text>
            <Button
              label="Leave household"
              variant="danger"
              disabled={busy}
              onPress={async () => {
                if (
                  await confirm(
                    'Leave household?',
                    'You’ll go back to your own data. A copy of what’s shared stays on this device.',
                    'Leave',
                  )
                ) {
                  await run(account.leaveHousehold, 'You left the household.');
                }
              }}
            />
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: c.textSecondary }]}>
              Share your recipes, pantry, meal plan and shopping list with a partner or family. Both
              of you see and edit the same things.
            </Text>
            <Button
              label="Start a household"
              disabled={busy}
              onPress={() => run(account.createHousehold, 'Household created. Give them the code.')}
            />
            <Field
              label="Or join with a code"
              hint="Joining uses the household’s pantry and lists; your recipes are added to theirs."
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. 3F9A12BC"
            />
            <Button
              label="Join household"
              variant="secondary"
              disabled={busy || !code.trim()}
              onPress={async () => {
                if (await run(() => account.joinHousehold(code), 'Joined!')) setCode('');
              }}
            />
          </>
        )}
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Account & sync', headerLeft }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {body}
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
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 2 },
});
