import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Field } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { fetchInstagramPost, InstagramError, parseInstagramUrl } from '@/lib/instagram';
import { saveRemotePhoto } from '@/lib/photos';
import { recipeDraftFromText } from '@/lib/recipe-text';
import { fetchWebsiteRecipe, parseWebUrl, WebsiteError } from '@/lib/website';
import { setRecipeDraft } from '@/store/draft';

// Browsers block reading Instagram and recipe sites from another site, so on the web the text is pasted.
const CAN_FETCH = Platform.OS !== 'web';

export default function ImportScreen() {
  const c = useTheme();
  // A link can also arrive as recipeapp://recipe/import?url=…
  const params = useLocalSearchParams<{ url?: string }>();
  const [link, setLink] = useState(params.url ?? '');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const autoFetched = useRef(false);

  const parsedLink = parseInstagramUrl(link);
  const webUrl = parsedLink ? undefined : parseWebUrl(link);

  const openDraft = (text: string, extra: { author?: string; photoUri?: string } = {}) => {
    const draft = recipeDraftFromText(text, {
      ...extra,
      sourceUrl: parsedLink?.url ?? webUrl ?? (link.trim() || undefined),
    });
    const key = setRecipeDraft(draft);
    router.replace({ pathname: '/recipe/edit', params: { draft: key } });
  };

  const fetchFromLink = async (url = link) => {
    setMessage(undefined);
    setLoading(true);
    try {
      if (parseInstagramUrl(url)) {
        const post = await fetchInstagramPost(url);
        const photoUri = post.imageUrl
          ? await saveRemotePhoto(post.imageUrl).catch(() => undefined)
          : undefined;
        openDraft(post.caption, { author: post.author, photoUri });
      } else {
        const { imageUrl, ...draft } = await fetchWebsiteRecipe(url);
        const photoUri = imageUrl
          ? await saveRemotePhoto(imageUrl).catch(() => undefined)
          : undefined;
        router.replace({
          pathname: '/recipe/edit',
          params: { draft: setRecipeDraft({ ...draft, photoUri }) },
        });
      }
    } catch (e) {
      const text =
        e instanceof InstagramError || e instanceof WebsiteError
          ? e.message
          : 'Something went wrong reading that link.';
      setMessage({ text: `${text} You can paste the recipe text below instead.`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (CAN_FETCH && params.url && parseInstagramUrl(params.url) && !autoFetched.current) {
      autoFetched.current = true;
      fetchFromLink(params.url);
    }
    // Only for a link passed in when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url]);

  const pasteInto = async (set: (s: string) => void) => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) set(text);
      else setMessage({ text: 'Nothing to paste. Copy something first.' });
    } catch {
      setMessage({ text: 'Couldn’t read the clipboard. Long-press the box and choose Paste.' });
    }
  };

  const headerLeft = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Cancel</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Import a recipe', headerLeft }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.group}>
          <Field
            label="Recipe link"
            hint="An Instagram post or reel, or any recipe website. Instagram: Share → Copy link."
            value={link}
            onChangeText={(t) => {
              setLink(t);
              setMessage(undefined);
            }}
            placeholder="https://…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label="Paste link"
                variant="secondary"
                onPress={() =>
                  pasteInto((t) => setLink(parseInstagramUrl(t)?.url ?? parseWebUrl(t) ?? t.trim()))
                }
              />
            </View>
            {CAN_FETCH ? (
              <View style={styles.flex}>
                <Button
                  label="Get recipe"
                  onPress={() => fetchFromLink()}
                  disabled={(!parsedLink && !webUrl) || loading}
                />
              </View>
            ) : null}
          </View>
          {link.trim() && !parsedLink && !webUrl ? (
            <Text style={[styles.message, { color: c.danger }]}>
              That doesn’t look like a link. It should start with https://
            </Text>
          ) : null}
          {!CAN_FETCH ? (
            <Text style={[styles.message, { color: c.textSecondary }]}>
              In the browser the app can’t open other sites itself. The link will be saved with the
              recipe. Paste the recipe text below to fill in the rest.
            </Text>
          ) : null}
          {loading ? (
            <View style={styles.row}>
              <ActivityIndicator color={c.accent} />
              <Text style={[styles.message, { color: c.textSecondary }]}>Reading the page…</Text>
            </View>
          ) : null}
          {message ? (
            <Text style={[styles.message, { color: message.error ? c.danger : c.textSecondary }]}>
              {message.text}
            </Text>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: c.border }]} />

        <View style={styles.group}>
          <Field
            label={CAN_FETCH ? 'Or paste the recipe text' : 'Recipe text'}
            hint="The recipe text from the post or page. Headings like “Ingredients” and “Method” help."
            value={caption}
            onChangeText={setCaption}
            multiline
            placeholder={
              'Garlic noodles\n\nIngredients:\n200 g spaghetti\n2 tbsp butter\n\nMethod:\n1. Cook the noodles…'
            }
            style={styles.captionBox}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label="Paste caption"
                variant="secondary"
                onPress={() => pasteInto(setCaption)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Create recipe"
                onPress={() => openDraft(caption)}
                disabled={!caption.trim() || loading}
              />
            </View>
          </View>
          <Text style={[styles.message, { color: c.textSecondary }]}>
            You’ll see the recipe before it’s saved, so you can fix anything that came out wrong.
          </Text>
        </View>
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
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  flex: { flex: 1 },
  message: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  captionBox: { minHeight: 180 },
});
