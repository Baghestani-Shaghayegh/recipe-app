import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reel } from '@/components/reel';
import { Fonts, Spacing } from '@/constants/theme';
import type { FeedPost } from '@/lib/feed';
import { useFeed } from '@/store/feed';

/** One recipe video on its own (opened from Top, or after posting). */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { loadPost, posts } = useFeed();
  const [post, setPost] = useState<FeedPost | null>();
  const [height, setHeight] = useState(0);
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void loadPost(id).then((p) => setPost(p ?? null));
  }, [id, loadPost]);

  // Deleted, reported or blocked from this screen: it's gone from the feed, so go back.
  const gone = post && !posts.some((p) => p.id === post.id);
  useEffect(() => {
    if (gone && message) {
      const t = setTimeout(() => router.back(), 1200);
      return () => clearTimeout(t);
    }
  }, [gone, message]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(undefined), 2500);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <View
      style={styles.screen}
      onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      <Stack.Screen options={{ headerShown: false }} />
      {post && height ? (
        <Reel
          post={post}
          height={height}
          active
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onMessage={setMessage}
        />
      ) : post === null ? (
        <View style={styles.center}>
          <Text style={styles.text}>This video isn’t available any more.</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, { top: insets.top + Spacing.two }]}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>
      {message ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  text: { fontFamily: Fonts.regular, color: '#fff', fontSize: 16, textAlign: 'center' },
  back: {
    position: 'absolute',
    left: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  toast: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
    maxWidth: '85%',
  },
  toastText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold, textAlign: 'center' },
});
