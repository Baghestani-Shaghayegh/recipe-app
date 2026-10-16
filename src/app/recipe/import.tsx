import Ionicons from '@expo/vector-icons/Ionicons';
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
  TextInput,
  View,
} from 'react-native';

import { Spacing, useTheme } from '@/constants/theme';
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

/** The link inside some pasted text, if there is one. */
const linkIn = (text: string) =>
  (shareIdFrom(text) ? text.trim() : undefined) ??
  parseInstagramUrl(text)?.url ??
  parseYoutubeUrl(text) ??
  parseTiktokUrl(text) ??
  parseWebUrl(text);

// Browsers block reading Instagram and recipe sites from another site, so on the web the text is pasted.
const CAN_FETCH = Platform.OS !== 'web';

export default function ImportScreen() {
  const c = useTheme();
  // A link can also arrive as recipeapp://recipe/import?url=…
  const params = useLocalSearchParams<{ url?: string; share?: string }>();
  const { fetchSharedRecipe } = useAccount();
  const [link, setLink] = useState(params.url ?? params.share ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const autoFetched = useRef(false);

  const shareId = shareIdFrom(link);
  const [focused, setFocused] = useState(false);
  const parsedLink = parseInstagramUrl(link);
  const videoUrl = parsedLink ? undefined : (parseYoutubeUrl(link) ?? parseTiktokUrl(link));
  const webUrl = parsedLink || videoUrl ? undefined : parseWebUrl(link);
  const isLink = !!(shareId || parsedLink || videoUrl || webUrl);
  const notALink = !!link.trim() && !isLink;
  const canAdd = isLink && !loading;

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
      setMessage({ text: `${text} You can add it with “Write it yourself” instead.`, error: true });
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

  const headerRight = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Cancel</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: 'Paste a link',
          headerTitleAlign: 'center',
          headerLeft: () => null,
          headerBackVisible: false,
          headerRight,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: c.chip }]}>
            <Ionicons name="link" size={30} color={c.accent} />
          </View>
          <Text style={[styles.heroTitle, { color: c.text }]}>Save a recipe from a link</Text>
          <Text style={[styles.heroText, { color: c.textSecondary }]}>
            Share your recipe link from Instagram, TikTok or YouTube
          </Text>
          <View style={styles.sources}>
            {SOURCES.map((s) => (
              <View
                key={s.label}
                style={[styles.source, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name={s.icon} size={16} color={c.text} />
                <Text style={[styles.sourceText, { color: c.text }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: c.card,
                borderColor: focused ? c.accent : c.border,
              },
            ]}>
            <Ionicons name="link-outline" size={20} color={c.textSecondary} />
            <TextInput
              value={link}
              onChangeText={(t) => {
                // Pasted share text often has words around the link: keep just the link.
                setLink(/\s/.test(t.trim()) ? (linkIn(t) ?? t) : t);
                setMessage(undefined);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => canAdd && fetchFromLink()}
              placeholder="Paste a link here"
              placeholderTextColor={c.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              accessibilityLabel="Recipe link"
              style={[styles.input, { color: c.text }]}
            />
            {link ? (
              <Pressable
                onPress={() => {
                  setLink('');
                  setMessage(undefined);
                }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear link">
                <Ionicons name="close-circle" size={20} color={c.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          {CAN_FETCH || shareId ? (
            <Pressable
              onPress={() => fetchFromLink()}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityLabel="Add recipe"
              accessibilityState={{ disabled: !canAdd, busy: loading }}
              style={({ pressed }) => [
                styles.addButton,
                {
                  backgroundColor: c.accent,
                  opacity: !canAdd && !loading ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}>
              {loading ? <ActivityIndicator color={c.accentText} /> : null}
              <Text style={[styles.addButtonText, { color: c.accentText }]}>
                {loading ? 'Reading the recipe…' : 'Add recipe'}
              </Text>
            </Pressable>
          ) : null}

          {notALink ? (
            <Notice
              tone="error"
              text="That doesn’t look like a link. It should start with https://"
            />
          ) : null}
          {message ? <Notice tone={message.error ? 'error' : 'info'} text={message.text} /> : null}
          {!CAN_FETCH ? (
            <Notice tone="info" text="Saving from a link works in the app on your phone." />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A soft coloured card for a short message under the link box. */
function Notice({ tone, text }: { tone: 'error' | 'info'; text: string }) {
  const c = useTheme();
  const error = tone === 'error';
  return (
    <View
      style={[styles.notice, { backgroundColor: error ? c.dangerSoft : c.chip }]}
      accessibilityLiveRegion="polite">
      <Ionicons
        name={error ? 'alert-circle' : 'information-circle'}
        size={18}
        color={error ? c.danger : c.textSecondary}
      />
      <Text style={[styles.noticeText, { color: error ? c.danger : c.text }]}>{text}</Text>
    </View>
  );
}

const SOURCES: { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { label: 'Instagram', icon: 'logo-instagram' },
  { label: 'TikTok', icon: 'logo-tiktok' },
  { label: 'YouTube', icon: 'logo-youtube' },
];

const styles = StyleSheet.create({
  headerButton: { fontSize: 17, paddingHorizontal: Spacing.two },
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.five,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingBottom: Spacing.six * 2,
  },
  hero: { alignItems: 'center', gap: Spacing.two },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  heroText: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  sources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceText: { fontSize: 13, fontWeight: '600' },
  group: { gap: Spacing.three },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    minHeight: 56,
  },
  // The box's border shows focus, so the browser's own outline is turned off.
  input: { flex: 1, fontSize: 16, paddingVertical: 14, outlineWidth: 0 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 54,
    borderRadius: 16,
  },
  addButtonText: { fontSize: 17, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
