import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reel } from '@/components/reel';
import { Button, Chip } from '@/components/ui';
import { Fonts, MaxContentWidth, Spacing, useTheme } from '@/constants/theme';
import { DIETS, type DietId } from '@/lib/diet';
import { compactCount, filterFeed, hasFilters, type FeedFilters, type FeedPost } from '@/lib/feed';
import { CATEGORIES, TIME_FILTERS } from '@/lib/recipe';
import { useAccount } from '@/store/account';
import { useFeed, type RankedPost, type TopMetric, type TopPeriod } from '@/store/feed';
import { useKitchen } from '@/store/kitchen';

type Mode = 'feed' | 'top';

export default function DiscoverScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const feed = useFeed();
  const [mode, setMode] = useState<Mode>('feed');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>({});

  if (!feed.available) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <Ionicons name="play-circle-outline" size={56} color={c.textSecondary} />
        <Text style={[styles.emptyTitle, { color: c.text }]}>Discover isn’t set up yet</Text>
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          The recipe video feed needs the app’s online account service (Supabase). See “Sync and
          sharing” in the README to connect it.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: mode === 'feed' ? '#000' : c.background }]}>
      {mode === 'feed' ? <FeedView filters={filters} /> : <TopView />}

      {/* Top bar floats over the video. */}
      <View
        style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}
        pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View style={[styles.segment, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
            {(['feed', 'top'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                style={[styles.segmentItem, mode === m && { backgroundColor: '#fff' }]}>
                <Text style={[styles.segmentText, { color: mode === m ? '#1F1A17' : '#fff' }]}>
                  {m === 'feed' ? 'For you' : 'Top'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.topActions}>
            {mode === 'feed' ? (
              <Pressable
                onPress={() => setShowFilters((s) => !s)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Filters"
                style={[styles.roundButton, hasFilters(filters) && { backgroundColor: c.primary }]}>
                <Ionicons name="options-outline" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push('/post/new')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Post a recipe video"
              style={[styles.roundButton, { backgroundColor: c.primary }]}>
              <Ionicons name="add" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
        {mode === 'feed' && showFilters ? (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onClose={() => setShowFilters(false)}
          />
        ) : null}
      </View>
    </View>
  );
}

function FeedView({ filters }: { filters: FeedFilters }) {
  const feed = useFeed();
  const { loaded: accountLoaded, session } = useAccount();
  const viewer = session?.userId;
  const { pantry } = useKitchen();
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  const [activeId, setActiveId] = useState<string>();
  const [muted, setMuted] = useState(true);
  const [message, setMessage] = useState<string>();
  const { refresh, posts, loading, error, reachedEnd, loadMore } = feed;

  // Load once sign-in is restored (blocks and likes depend on who's watching), and again when
  // someone signs in or out. Pulling down refreshes too.
  useEffect(() => {
    if (accountLoaded) void refresh();
  }, [accountLoaded, viewer, refresh]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(undefined), 2500);
    return () => clearTimeout(t);
  }, [message]);

  const visible = useMemo(() => filterFeed(posts, filters, pantry), [posts, filters, pantry]);
  const active = activeId && visible.some((p) => p.id === activeId) ? activeId : visible[0]?.id;

  // FlatList needs this callback to stay the same for the list's whole life.
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedPost>[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.item) setActiveId(first.item.id);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <Reel
        post={item}
        height={height}
        active={focused && item.id === active}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        onMessage={setMessage}
      />
    ),
    [height, focused, active, muted],
  );

  return (
    <View style={styles.flex} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {height > 0 && visible.length ? (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={1.5}
          onRefresh={() => void refresh()}
          refreshing={false}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      ) : (
        <FeedEmpty
          loading={loading}
          error={error}
          filtered={posts.length > 0}
          canLoadMore={!reachedEnd}
          onRetry={() => void refresh()}
          onLoadMore={() => void loadMore()}
        />
      )}
      {message ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function FeedEmpty({
  loading,
  error,
  filtered,
  canLoadMore,
  onRetry,
  onLoadMore,
}: {
  loading: boolean;
  error?: string;
  filtered: boolean;
  canLoadMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return (
    <View style={styles.centered}>
      <Ionicons
        name={error ? 'cloud-offline-outline' : 'restaurant-outline'}
        size={48}
        color="#fff"
      />
      <Text style={[styles.emptyTitle, styles.light]}>
        {error
          ? 'Couldn’t load the feed'
          : filtered
            ? 'Nothing matches these filters'
            : 'No recipe videos yet'}
      </Text>
      <Text style={[styles.emptyText, styles.lightSecondary]}>
        {error
          ? error
          : filtered
            ? 'Try fewer filters, or load more videos.'
            : 'Be the first: tap + to post a short video of one of your recipes.'}
      </Text>
      {error ? <Button label="Try again" onPress={onRetry} /> : null}
      {!error && filtered && canLoadMore ? (
        <Button label="Load more videos" onPress={onLoadMore} />
      ) : null}
      {!error && !filtered ? (
        <Button label="Post a recipe video" onPress={() => router.push('/post/new')} />
      ) : null}
    </View>
  );
}

function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: FeedFilters;
  onChange: (f: FeedFilters) => void;
  onClose: () => void;
}) {
  const c = useTheme();
  const { pantry } = useKitchen();
  const toggleDiet = (d: DietId) => {
    const diets = filters.diets ?? [];
    onChange({
      ...filters,
      diets: diets.includes(d) ? diets.filter((x) => x !== d) : [...diets, d],
    });
  };
  return (
    <View style={[styles.panel, { backgroundColor: c.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        <Chip
          label="✓ I can make it"
          selected={!!filters.canMake}
          onPress={() => onChange({ ...filters, canMake: !filters.canMake })}
        />
        {TIME_FILTERS.map((t) => (
          <Chip
            key={t.maxMinutes}
            label={t.label}
            selected={filters.maxMinutes === t.maxMinutes}
            onPress={() =>
              onChange({
                ...filters,
                maxMinutes: filters.maxMinutes === t.maxMinutes ? undefined : t.maxMinutes,
              })
            }
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={cat}
            selected={filters.category === cat}
            onPress={() =>
              onChange({ ...filters, category: filters.category === cat ? undefined : cat })
            }
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}>
        {DIETS.map((d) => (
          <Chip
            key={d.id}
            label={d.label}
            selected={!!filters.diets?.includes(d.id)}
            onPress={() => toggleDiet(d.id)}
          />
        ))}
      </ScrollView>
      {filters.canMake && !pantry.length ? (
        <Text style={[styles.panelNote, { color: c.textSecondary }]}>
          Add what you have to your Pantry first.
        </Text>
      ) : null}
      <View style={styles.panelButtons}>
        {hasFilters(filters) ? (
          <Pressable onPress={() => onChange({})} accessibilityRole="button">
            <Text style={[styles.panelLink, { color: c.accent }]}>Clear</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={[styles.panelLink, { color: c.accent }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TopView() {
  const c = useTheme();
  const { loaded: accountLoaded, session } = useAccount();
  const viewer = session?.userId;
  const insets = useSafeAreaInsets();
  const feed = useFeed();
  const [metric, setMetric] = useState<TopMetric>('saves');
  const [period, setPeriod] = useState<TopPeriod>('week');
  // Results are kept with the ranking they're for, so switching shows a spinner until the new one loads.
  const [result, setResult] = useState<{ key: string; ranked: RankedPost[]; error?: string }>();
  const key = `${metric}:${period}`;
  const { loadTop } = feed;

  useEffect(() => {
    if (!accountLoaded) return;
    let current = true;
    void loadTop(metric, period).then((r) => {
      if (current) setResult({ key: `${metric}:${period}`, ranked: r.ranked, error: r.error });
    });
    return () => {
      current = false;
    };
  }, [accountLoaded, viewer, loadTop, metric, period]);

  const ranked = result?.key === key ? result.ranked : undefined;
  const error = result?.key === key ? result.error : undefined;

  const unit = metric === 'saves' ? 'save' : 'like';
  const when = period === 'week' ? ' this week' : '';

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.topContent, { paddingTop: insets.top + 64 }]}>
      <View style={styles.chipRow}>
        <Chip label="Most saved" selected={metric === 'saves'} onPress={() => setMetric('saves')} />
        <Chip label="Most liked" selected={metric === 'likes'} onPress={() => setMetric('likes')} />
      </View>
      <View style={styles.chipRow}>
        <Chip label="This week" selected={period === 'week'} onPress={() => setPeriod('week')} />
        <Chip label="All time" selected={period === 'all'} onPress={() => setPeriod('all')} />
      </View>

      {!ranked ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: Spacing.six }} />
      ) : error ? (
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>{error}</Text>
      ) : !ranked.length ? (
        <Text style={[styles.emptyText, { color: c.textSecondary }]}>
          No {unit}s{when} yet. Recipes show up here once people {unit} them.
        </Text>
      ) : (
        ranked.map((r, i) => (
          <Pressable
            key={r.post.id}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: r.post.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.rankRow,
              { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={[styles.rank, { color: i < 3 ? c.accent : c.textSecondary }]}>
              {i + 1}
            </Text>
            {r.post.posterUrl ? (
              <Image
                source={{ uri: r.post.posterUrl }}
                style={styles.rankThumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.rankThumb, styles.thumbEmpty, { backgroundColor: c.chip }]}>
                <Ionicons name="play" size={20} color={c.textSecondary} />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={[styles.rankTitle, { color: c.text }]} numberOfLines={2}>
                {r.post.recipe.title}
              </Text>
              <Text style={[styles.rankMeta, { color: c.textSecondary }]}>@{r.post.username}</Text>
              <Text style={[styles.rankScore, { color: c.accent }]}>
                {compactCount(r.score)} {unit}
                {r.score === 1 ? '' : 's'}
                {when}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.bold, textAlign: 'center' },
  emptyText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 360,
  },
  light: { color: '#fff' },
  lightSecondary: { color: 'rgba(255,255,255,0.8)' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segmentItem: { paddingVertical: 6, paddingHorizontal: Spacing.four, borderRadius: 999 },
  segmentText: { fontSize: 15, fontFamily: Fonts.bold },
  topActions: { flexDirection: 'row', gap: Spacing.two },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  panelNote: { fontFamily: Fonts.regular, fontSize: 13 },
  panelButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  panelLink: { fontSize: 15, fontFamily: Fonts.bold, paddingVertical: Spacing.one },
  chipRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
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
  topContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.six,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.two,
  },
  rank: { fontSize: 22, fontFamily: Fonts.extrabold, width: 32, textAlign: 'center' },
  rankThumb: { width: 64, height: 86, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rankTitle: { fontSize: 16, fontFamily: Fonts.bold },
  rankMeta: { fontFamily: Fonts.regular, fontSize: 13 },
  rankScore: { fontSize: 14, fontFamily: Fonts.bold, marginTop: 2 },
});
