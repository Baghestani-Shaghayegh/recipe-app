import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/action-sheet';
import { Button } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { compactCount, type FeedPost } from '@/lib/feed';
import { isStaple, pantryHas } from '@/lib/pantry';
import { formatMinutes, totalMinutes } from '@/lib/recipe';
import { useAccount } from '@/store/account';
import { useFeed } from '@/store/feed';
import { useKitchen } from '@/store/kitchen';

// The player is an imperative object owned by expo-video; changing it is how you control it.
function setPlayerMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

const REPORT_REASONS = ['Not a recipe', 'Spam or ads', 'Offensive or unsafe', 'Something else'];

/**
 * One full-screen recipe video. Plays while `active`; tap to mute or unmute.
 * The recipe opens in a sheet, so it's always one tap away from the video.
 */
export function Reel({
  post,
  active,
  height,
  muted,
  onToggleMute,
  onMessage,
}: {
  post: FeedPost;
  active: boolean;
  height: number;
  muted: boolean;
  onToggleMute: () => void;
  onMessage: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useAccount();
  const feed = useFeed();
  const [showRecipe, setShowRecipe] = useState(false);
  const [menu, setMenu] = useState<'closed' | 'main' | 'report'>('closed');
  const [playing, setPlaying] = useState(false);

  const player = useVideoPlayer(post.videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEventListener(player, 'playingChange', ({ isPlaying }) => setPlaying(isPlaying));

  useEffect(() => setPlayerMuted(player, muted), [player, muted]);

  // Only the reel on screen plays; the recipe sheet pauses it.
  useEffect(() => {
    if (active && !showRecipe) player.play();
    else player.pause();
  }, [player, active, showRecipe]);

  const { likeCount, saveCount } = feed.stats(post);
  const liked = feed.isLiked(post.id);
  const saved = feed.isSaved(post.id);
  const mine = session?.userId === post.authorId;
  const minutes = totalMinutes(post.recipe);
  const meta = [post.recipe.category, minutes !== undefined ? formatMinutes(minutes) : undefined]
    .filter(Boolean)
    .join(' · ');

  const like = async () => {
    const err = await feed.toggleLike(post);
    if (err) onMessage(err);
  };
  const save = async () => {
    const wasSaved = saved;
    const err = await feed.toggleSave(post);
    if (err) onMessage(err);
    else if (!wasSaved) onMessage('Saved to My Recipes');
  };

  return (
    <View style={[styles.reel, { height }]}>
      {post.posterUrl ? (
        <Image
          source={{ uri: post.posterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onToggleMute}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Turn sound on' : 'Turn sound off'}
      />
      {active && !playing ? (
        <View pointerEvents="none" style={styles.center}>
          <Ionicons name="play" size={56} color="rgba(255,255,255,0.8)" />
        </View>
      ) : null}

      <View style={[styles.rail, { bottom: 120 + insets.bottom }]}>
        <RailButton
          icon={liked ? 'heart' : 'heart-outline'}
          color={liked ? '#FF5A5F' : '#fff'}
          label={compactCount(likeCount)}
          a11y={liked ? 'Unlike' : 'Like'}
          onPress={like}
        />
        <RailButton
          icon={saved ? 'bookmark' : 'bookmark-outline'}
          color={saved ? '#FBBF24' : '#fff'}
          label={compactCount(saveCount)}
          a11y={saved ? 'Saved' : 'Save to my recipes'}
          onPress={save}
        />
        <RailButton
          icon={muted ? 'volume-mute' : 'volume-high'}
          color="#fff"
          a11y={muted ? 'Turn sound on' : 'Turn sound off'}
          onPress={onToggleMute}
        />
        <RailButton
          icon="ellipsis-horizontal"
          color="#fff"
          a11y="More"
          onPress={() => setMenu('main')}
        />
      </View>

      <View style={[styles.caption, { paddingBottom: Spacing.four + insets.bottom }]}>
        <Text style={styles.username}>@{post.username}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {post.recipe.title}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <Pressable
          onPress={() => setShowRecipe(true)}
          style={({ pressed }) => [styles.recipeButton, pressed && { opacity: 0.8 }]}
          accessibilityRole="button">
          <Ionicons name="list" size={16} color="#1F1A17" />
          <Text style={styles.recipeButtonText}>
            Recipe · {post.recipe.ingredients?.length ?? 0} ingredients
          </Text>
        </Pressable>
      </View>

      <RecipeSheet
        post={post}
        visible={showRecipe}
        saved={saved}
        onSave={save}
        onClose={() => setShowRecipe(false)}
      />
      <ActionSheet
        visible={menu !== 'closed'}
        onClose={() => setMenu('closed')}
        title={menu === 'report' ? 'Why are you reporting this?' : undefined}
        actions={
          menu === 'report'
            ? REPORT_REASONS.map((reason) => ({
                label: reason,
                onPress: async () => {
                  setMenu('closed');
                  const err = await feed.report(post, reason);
                  onMessage(err ?? 'Thanks. We’ll hide it if others report it too.');
                },
              }))
            : mine
              ? [
                  {
                    label: 'Delete my post',
                    danger: true,
                    onPress: async () => {
                      setMenu('closed');
                      const err = await feed.remove(post);
                      onMessage(err ?? 'Post deleted.');
                    },
                  },
                ]
              : [
                  { label: 'Report this post', onPress: () => setMenu('report') },
                  {
                    label: `Block @${post.username}`,
                    danger: true,
                    onPress: async () => {
                      setMenu('closed');
                      const err = await feed.block(post);
                      onMessage(err ?? `You won’t see @${post.username} any more.`);
                    },
                  },
                ]
        }
      />
    </View>
  );
}

function RailButton({
  icon,
  color,
  label,
  a11y,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label?: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={styles.railButton}>
      <Ionicons name={icon} size={30} color={color} style={styles.shadow} />
      {label !== undefined ? <Text style={styles.railLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function RecipeSheet({
  post,
  visible,
  saved,
  onSave,
  onClose,
}: {
  post: FeedPost;
  visible: boolean;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const { pantry } = useKitchen();
  const r = post.recipe;
  const minutes = totalMinutes(r);
  const facts = [
    r.servings ? `Serves ${r.servings}` : undefined,
    minutes !== undefined ? formatMinutes(minutes) : undefined,
    r.category,
  ].filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Close recipe" />
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={[styles.grabber, { backgroundColor: c.border }]} />
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>{r.title}</Text>
            <Text style={[styles.sheetMeta, { color: c.textSecondary }]}>
              @{post.username}
              {facts.length ? `  ·  ${facts.join('  ·  ')}` : ''}
            </Text>
            <Button
              label={saved ? '✓ Saved to My Recipes' : 'Save to My Recipes'}
              variant={saved ? 'secondary' : 'primary'}
              onPress={onSave}
            />

            <Text style={[styles.sheetSection, { color: c.text }]}>Ingredients</Text>
            {(r.ingredients ?? []).map((ing, i) => {
              const have = pantry.length > 0 && !isStaple(ing.name) && pantryHas(pantry, ing.name);
              return (
                <View key={i} style={styles.row}>
                  <Text style={[styles.bullet, { color: have ? c.accent : c.textSecondary }]}>
                    {have ? '✓' : '•'}
                  </Text>
                  <Text style={[styles.body, { color: c.text }]}>{ing.text}</Text>
                </View>
              );
            })}

            <Text style={[styles.sheetSection, { color: c.text }]}>Steps</Text>
            {(r.steps ?? []).map((step, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.stepNumber, { color: c.accent }]}>{i + 1}</Text>
                <Text style={[styles.body, { color: c.text }]}>{step}</Text>
              </View>
            ))}
            {r.notes ? (
              <>
                <Text style={[styles.sheetSection, { color: c.text }]}>Notes</Text>
                <Text style={[styles.body, { color: c.text }]}>{r.notes}</Text>
              </>
            ) : null}
            <Button label="Close" variant="secondary" onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const shadowText = {
  textShadowColor: 'rgba(0,0,0,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  reel: { width: '100%', backgroundColor: '#000', overflow: 'hidden' },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: { position: 'absolute', right: Spacing.three, alignItems: 'center', gap: Spacing.five },
  railButton: { alignItems: 'center', gap: 2 },
  railLabel: { color: '#fff', fontSize: 13, fontWeight: '700', ...shadowText },
  shadow: shadowText,
  caption: {
    position: 'absolute',
    left: 0,
    right: 72,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
  },
  username: { color: '#fff', fontSize: 15, fontWeight: '700', ...shadowText },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', ...shadowText },
  meta: { color: 'rgba(255,255,255,0.9)', fontSize: 14, ...shadowText },
  recipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  recipeButtonText: { color: '#1F1A17', fontSize: 14, fontWeight: '700' },
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: Spacing.two },
  sheetContent: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six },
  sheetTitle: { fontSize: 24, fontWeight: '800' },
  sheetMeta: { fontSize: 14 },
  sheetSection: { fontSize: 18, fontWeight: '700', marginTop: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  bullet: { fontSize: 16, lineHeight: 24, minWidth: 18, textAlign: 'center' },
  stepNumber: { fontSize: 16, fontWeight: '800', lineHeight: 24, minWidth: 18 },
  body: { flex: 1, fontSize: 16, lineHeight: 24 },
});
