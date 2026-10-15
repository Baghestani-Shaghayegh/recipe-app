import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Field, SectionTitle } from '@/components/ui';
import { MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { MAX_VIDEO_SECONDS, normalizeUsername, postProblems, usernameProblem } from '@/lib/feed';
import { chooseVideo, VideoProblem, type PickedVideo } from '@/lib/post-video';
import { useAccount } from '@/store/account';
import { useFeed } from '@/store/feed';
import { useRecipes } from '@/store/recipes';

/** Post a short video of one of your recipes to Discover. */
export default function NewPostScreen() {
  const c = useTheme();
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const { configured, session } = useAccount();
  const feed = useFeed();
  const { recipes } = useRecipes();
  const [checkingName, setCheckingName] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [selected, setSelected] = useState<string | undefined>(recipeId);
  const [video, setVideo] = useState<PickedVideo>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const { loadUsername, username } = feed;

  useEffect(() => {
    if (session) void loadUsername().finally(() => setCheckingName(false));
  }, [session, loadUsername]);

  const sorted = useMemo(
    () =>
      [...recipes].sort(
        (a, b) => postProblems(a).length - postProblems(b).length || b.updatedAt - a.updatedAt,
      ),
    [recipes],
  );
  const recipe = recipes.find((r) => r.id === selected);

  const headerLeft = () => (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.headerButton, { color: c.accent }]}>Cancel</Text>
    </Pressable>
  );

  const page = (body: React.ReactNode) => (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Post a recipe video', headerLeft }} />
      {body}
    </ScrollView>
  );

  if (!configured) {
    return page(
      <Text style={[styles.note, { color: c.textSecondary }]}>
        Posting needs the app’s online account service (Supabase), which isn’t set up in this build.
      </Text>,
    );
  }
  if (!session) {
    return page(
      <View style={styles.group}>
        <Text style={[styles.lead, { color: c.text }]}>Sign in to post</Text>
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Anyone can watch Discover. To share your own recipe videos, sign in first.
        </Text>
        <Button label="Sign in or create account" onPress={() => router.push('/account')} />
      </View>,
    );
  }
  if (checkingName && !username) return page(<ActivityIndicator color={c.accent} />);

  if (!username) {
    const name = normalizeUsername(nameInput);
    const problem = name ? usernameProblem(name) : undefined;
    return page(
      <View style={styles.group}>
        <Text style={[styles.lead, { color: c.text }]}>Pick a username</Text>
        <Text style={[styles.note, { color: c.textSecondary }]}>
          It’s shown on your videos, like @ana_cooks. You can’t use your email.
        </Text>
        <Field
          label="Username"
          value={nameInput}
          onChangeText={(t) => {
            setNameInput(t);
            setError(undefined);
          }}
          placeholder="ana_cooks"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {name && name !== nameInput.trim() ? (
          <Text style={[styles.note, { color: c.textSecondary }]}>Will be saved as @{name}</Text>
        ) : null}
        {problem || error ? (
          <Text style={[styles.error, { color: c.danger }]}>{problem ?? error}</Text>
        ) : null}
        <Button
          label={busy ?? 'Continue'}
          disabled={!name || !!problem || !!busy}
          onPress={async () => {
            setBusy('Saving…');
            const err = await feed.setUsername(name);
            setBusy(undefined);
            if (err) setError(err);
          }}
        />
      </View>,
    );
  }

  const pick = async (source: 'camera' | 'library') => {
    setError(undefined);
    try {
      const v = await chooseVideo(source);
      if (v) setVideo(v);
    } catch (e) {
      setError(e instanceof VideoProblem ? e.message : 'Couldn’t open that video.');
    }
  };

  const publish = async () => {
    if (!recipe || !video) return;
    setError(undefined);
    const r = await feed.publish(recipe, video, setBusy);
    setBusy(undefined);
    if (r.error || !r.post) return setError(r.error ?? 'Couldn’t post it. Please try again.');
    router.replace({ pathname: '/post/[id]', params: { id: r.post.id } });
  };

  return page(
    <>
      <Text style={[styles.note, { color: c.textSecondary }]}>
        Posting as @{username}. Discover is only for recipes: every video comes with its full
        recipe, and posts that aren’t recipes are hidden when people report them.
      </Text>

      <View style={styles.group}>
        <SectionTitle>1. Choose the recipe</SectionTitle>
        {sorted.map((r) => {
          const problems = postProblems(r);
          const isSelected = r.id === selected;
          return (
            <Pressable
              key={r.id}
              disabled={problems.length > 0}
              onPress={() => setSelected(r.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, disabled: problems.length > 0 }}
              style={[
                styles.choice,
                {
                  borderColor: isSelected ? c.accent : c.border,
                  backgroundColor: c.card,
                  opacity: problems.length ? 0.55 : 1,
                },
              ]}>
              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={isSelected ? c.accent : c.textSecondary}
              />
              <View style={styles.flex}>
                <Text style={[styles.choiceTitle, { color: c.text }]}>{r.title}</Text>
                <Text style={[styles.choiceMeta, { color: c.textSecondary }]}>
                  {problems.length
                    ? `Needs ${problems.join(' and ')} before it can be posted`
                    : `${r.ingredients.length} ingredients · ${r.steps.length} steps`}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {!recipes.length ? (
          <Text style={[styles.note, { color: c.textSecondary }]}>Add a recipe first.</Text>
        ) : null}
      </View>

      <View style={styles.group}>
        <SectionTitle>2. Add the video</SectionTitle>
        <Text style={[styles.note, { color: c.textSecondary }]}>
          Up to {MAX_VIDEO_SECONDS} seconds, upright works best.
        </Text>
        {video ? <VideoPreview uri={video.uri} /> : null}
        <View style={styles.row}>
          {Platform.OS !== 'web' ? (
            <View style={styles.flex}>
              <Button label="Record" variant="secondary" onPress={() => pick('camera')} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button
              label={video ? 'Choose another' : 'Choose video'}
              variant="secondary"
              onPress={() => pick('library')}
            />
          </View>
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
      <Button
        label={busy ?? 'Post to Discover'}
        disabled={!recipe || !video || !!busy}
        onPress={publish}
      />
      {!recipe || !video ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          {!recipe && !video
            ? 'Choose a recipe and a video to post.'
            : !recipe
              ? 'Choose which recipe this video is for.'
              : 'Add a video to post.'}
        </Text>
      ) : null}
    </>,
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.preview}
      contentFit="cover"
      nativeControls={false}
      accessibilityLabel="Video preview"
    />
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
  lead: { fontSize: 20, fontWeight: '700' },
  note: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 15, fontWeight: '600' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.two },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.three,
  },
  choiceTitle: { fontSize: 16, fontWeight: '700' },
  choiceMeta: { fontSize: 13 },
  preview: {
    width: 180,
    height: 320,
    borderRadius: 14,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
});
