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
import { recipeFromShared } from '@/lib/share';
import { parseShareId } from '@/lib/supabase';
import { useAccount } from '@/store/account';
import { fetchVideoPost, parseTiktokUrl, parseYoutubeUrl, VideoError } from '@/lib/video';
import { fetchWebsiteRecipe, parseWebUrl, WebsiteError } from '@/lib/website';
import { setRecipeDraft } from '@/store/draft';

/** A shared-recipe id, when the text holds a recipeapp:// share link or is just the id. */
const shareIdFrom = (text: string) =>
  /recipeapp:\/\/recipe\/import\?share=|^[0-9a-f-]{36}$/i.test(text.trim())
    ? parseShareId(text)
    : undefined;

// Browsers block reading Instagram and recipe sites from another site, so on the web the text is pasted.
const CAN_FETCH = Platform.OS !== 'web';

export default function ImportScreen() {
  const c = useTheme();
  // A link can also arrive as recipeapp://recipe/import?url=…
  const params = useLocalSearchParams<{ url?: string; share?: string }>();
  const { fetchSharedRecipe } = useAccount();
  const [link, setLink] = useState(params.url ?? params.share ?? '');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const autoFetched = useRef(false);

  const shareId = shareIdFrom(link);
  const parsedLink = parseInstagramUrl(link);
  const videoUrl = parsedLink ? undefined : (parseYoutubeUrl(link) ?? parseTiktokUrl(link));
  const webUrl = parsedLink || videoUrl ? undefined : parseWebUrl(link);

  const openDraft = (
    text: string,
    extra: { author?: string; photoUri?: string; site?: string; sourceUrl?: string } = {},
  ) => {
    const draft = recipeDraftFromText(text, {
      ...extra,
      sourceUrl:
        extra.sourceUrl ?? parsedLink?.url ?? videoUrl ?? webUrl ?? (link.trim() || undefined),
    });
    const key = setRecipeDraft(draft);
    router.replace({ pathname: '/recipe/edit', params: { draft: key } });
  };

  const fetchFromLink = async (url = link) => {
    setMessage(undefined);
    setLoading(true);
    try {
      const sid = shareIdFrom(url);
      if (sid) {
        const { recipe, error } = await fetchSharedRecipe(sid);
        const draft = recipeFromShared(recipe);
        if (!draft) throw new Error(error ?? 'That link doesn’t hold a recipe.');
        router.replace({ pathname: '/recipe/edit', params: { draft: setRecipeDraft(draft) } });
      } else if (parseInstagramUrl(url)) {
        const post = await fetchInstagramPost(url);
        const photoUri = post.imageUrl
          ? await saveRemotePhoto(post.imageUrl).catch(() => undefined)
          : undefined;
        openDraft(post.caption, { author: post.author, photoUri });
      } else if (parseYoutubeUrl(url) || parseTiktokUrl(url)) {
        const post = await fetchVideoPost(url);
        const photoUri = post.imageUrl
          ? await saveRemotePhoto(post.imageUrl).catch(() => undefined)
          : undefined;
        openDraft(post.caption, {
          author: post.author,
          photoUri,
          site: post.site,
          sourceUrl: post.url,
        });
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
        e instanceof Error && shareIdFrom(url)
          ? e.message
          : e instanceof InstagramError || e instanceof WebsiteError || e instanceof VideoError
            ? e.message
            : 'Something went wrong reading that link.';
      setMessage({ text: `${text} You can paste the recipe text below instead.`, error: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.share && !autoFetched.current) {
      autoFetched.current = true;
      fetchFromLink(params.share);
    } else if (CAN_FETCH && params.url && parseInstagramUrl(params.url) && !autoFetched.current) {
      autoFetched.current = true;
      fetchFromLink(params.url);
    }
    // Only for a link passed in when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url, params.share]);

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
            hint="An Instagram, TikTok or YouTube video, or any recipe website. Use Share → Copy link."
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
                  pasteInto((t) =>
                    setLink(
                      (shareIdFrom(t) ? t.trim() : undefined) ??
                        parseInstagramUrl(t)?.url ??
                        parseYoutubeUrl(t) ??
                        parseTiktokUrl(t) ??
                        parseWebUrl(t) ??
                        t.trim(),
                    ),
                  )
                }
              />
            </View>
            {CAN_FETCH || shareId ? (
              <View style={styles.flex}>
                <Button
                  label="Get recipe"
                  onPress={() => fetchFromLink()}
                  disabled={(!shareId && !parsedLink && !videoUrl && !webUrl) || loading}
                />
              </View>
            ) : null}
          </View>
          {link.trim() && !shareId && !parsedLink && !videoUrl && !webUrl ? (
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
