import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  mediaPath,
  recipeFromPost,
  toPostRecipe,
  type FeedPost,
  type PostRecipe,
} from '@/lib/feed';
import type { PickedVideo } from '@/lib/post-video';
import { readFileBytes } from '@/lib/post-video';
import type { Recipe } from '@/lib/recipe';
import type { PostRow, SupabaseClient } from '@/lib/supabase';

import { accountErrorMessage, useAccount } from './account';
import { useRecipes } from './recipes';

export type TopMetric = 'saves' | 'likes';
export type TopPeriod = 'week' | 'all';
export type RankedPost = { post: FeedPost; score: number };

type FeedContextValue = {
  /** False when the app has no server set up, so there's no feed. */
  available: boolean;
  posts: FeedPost[];
  loading: boolean;
  /** No older posts left to load. */
  reachedEnd: boolean;
  error?: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadTop: (
    metric: TopMetric,
    period: TopPeriod,
  ) => Promise<{ ranked: RankedPost[]; error?: string }>;
  loadPost: (id: string) => Promise<FeedPost | undefined>;

  /** Current like/save counts (includes taps made since the post was loaded). */
  stats: (post: FeedPost) => { likeCount: number; saveCount: number };
  isLiked: (id: string) => boolean;
  isSaved: (id: string) => boolean;
  /** Returns a message when it couldn't (e.g. not signed in). */
  toggleLike: (post: FeedPost) => Promise<string | undefined>;
  /** Saving copies the recipe into your box (and counts it when signed in). */
  toggleSave: (post: FeedPost) => Promise<string | undefined>;
  report: (post: FeedPost, reason: string) => Promise<string | undefined>;
  block: (post: FeedPost) => Promise<string | undefined>;
  remove: (post: FeedPost) => Promise<string | undefined>;

  username?: string;
  /** Loads the signed-in user's username (undefined until they pick one). */
  loadUsername: () => Promise<string | undefined>;
  setUsername: (name: string) => Promise<string | undefined>;
  publish: (
    recipe: Recipe,
    video: PickedVideo,
    onProgress: (step: string) => void,
  ) => Promise<{ post?: FeedPost; error?: string }>;
};

const FeedContext = createContext<FeedContextValue | null>(null);
const PAGE = 15;

function toPost(row: PostRow, api: SupabaseClient): FeedPost {
  return {
    id: row.id,
    authorId: row.author_id,
    username: row.profiles?.username ?? 'cook',
    recipe: row.recipe as PostRecipe,
    videoUrl: api.mediaUrl(row.video_path),
    posterUrl: row.poster_path ? api.mediaUrl(row.poster_path) : undefined,
    likeCount: row.like_count,
    saveCount: row.save_count,
    createdAt: Date.parse(row.created_at),
  };
}

export function FeedProvider({ children }: { children: React.ReactNode }) {
  const { api, session, withSession, freshSession } = useAccount();
  const { addRecipe } = useRecipes();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [error, setError] = useState<string>();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [username, setUsernameState] = useState<string>();
  const loadingRef = useRef(false);
  // Count changes from this device's taps, by post id. Kept apart from the loaded posts so the
  // same post shows the same numbers in the feed, Top and its own screen.
  const [deltas, setDeltas] = useState<Record<string, { likes: number; saves: number }>>({});

  const bump = useCallback((id: string, kind: 'likes' | 'saves', by: number) => {
    setDeltas((prev) => {
      const d = prev[id] ?? { likes: 0, saves: 0 };
      return { ...prev, [id]: { ...d, [kind]: d[kind] + by } };
    });
  }, []);

  const stats = useCallback(
    (post: FeedPost) => ({
      likeCount: Math.max(0, post.likeCount + (deltas[post.id]?.likes ?? 0)),
      saveCount: Math.max(0, post.saveCount + (deltas[post.id]?.saves ?? 0)),
    }),
    [deltas],
  );

  const setIn = (set: (f: (prev: Set<string>) => Set<string>) => void, id: string, on: boolean) =>
    set((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const loadReactions = useCallback(
    async (ids: string[]) => {
      const s = await freshSession().catch(() => undefined);
      if (!api || !s || !ids.length) return;
      try {
        const r = await api.myReactions(s, ids);
        setLiked((prev) => new Set([...prev, ...r.liked]));
        setSaved((prev) => new Set([...prev, ...r.saved]));
      } catch {
        // Hearts just show as not-liked; tapping still works.
      }
    },
    [api, freshSession],
  );

  const fetchPage = useCallback(
    async (before?: number) => {
      if (!api || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(undefined);
      try {
        const s = await freshSession().catch(() => undefined);
        const rows = await api.listPosts(s, { before, limit: PAGE });
        const page = rows.map((r) => toPost(r, api));
        if (!before) {
          // A fresh first page: counts and hearts come from the server again (maybe for a
          // different person than before).
          setDeltas({});
          setLiked(new Set());
          setSaved(new Set());
        }
        setPosts((prev) => {
          if (!before) return page;
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.filter((p) => !seen.has(p.id))];
        });
        setReachedEnd(rows.length < PAGE);
        void loadReactions(page.map((p) => p.id));
      } catch (e) {
        setError(accountErrorMessage(e));
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [api, freshSession, loadReactions],
  );

  const refresh = useCallback(() => fetchPage(undefined), [fetchPage]);
  const loadMore = useCallback(async () => {
    if (reachedEnd || !posts.length) return;
    await fetchPage(posts[posts.length - 1].createdAt);
  }, [fetchPage, posts, reachedEnd]);

  const loadTop = useCallback(
    async (metric: TopMetric, period: TopPeriod) => {
      if (!api) return { ranked: [], error: 'The feed isn’t set up in this build of the app.' };
      try {
        const s = await freshSession().catch(() => undefined);
        const top = await api.topPosts(s, metric, period);
        const rows = await api.getPosts(
          s,
          top.map((t) => t.postId),
        );
        const byId = new Map(rows.map((r) => [r.id, toPost(r, api)]));
        const ranked = top
          .map((t) => ({ post: byId.get(t.postId), score: t.score }))
          .filter((r): r is RankedPost => !!r.post);
        void loadReactions(ranked.map((r) => r.post.id));
        return { ranked };
      } catch (e) {
        return { ranked: [], error: accountErrorMessage(e) };
      }
    },
    [api, freshSession, loadReactions],
  );

  // Read through a ref so loadPost keeps one identity: screens that load a post on open
  // shouldn't load it again (and lose it) every time the feed changes.
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadPost = useCallback(
    async (id: string) => {
      const known = postsRef.current.find((p) => p.id === id);
      if (known || !api) return known;
      try {
        const s = await freshSession().catch(() => undefined);
        const row = (await api.getPosts(s, [id]))[0];
        if (!row) return undefined;
        const p = toPost(row, api);
        setPosts((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
        void loadReactions([p.id]);
        return p;
      } catch {
        return undefined;
      }
    },
    [api, freshSession, loadReactions],
  );

  const isLiked = useCallback((id: string) => liked.has(id), [liked]);
  const isSaved = useCallback((id: string) => saved.has(id), [saved]);

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      if (!session) return 'Sign in to like recipes.';
      const on = !liked.has(post.id);
      setIn(setLiked, post.id, on);
      bump(post.id, 'likes', on ? 1 : -1);
      const r = await withSession((s) => api!.react(s, 'like', post.id, on));
      if (r.error) {
        setIn(setLiked, post.id, !on);
        bump(post.id, 'likes', on ? -1 : 1);
      }
      return r.error;
    },
    [session, liked, bump, withSession, api],
  );

  const toggleSave = useCallback(
    async (post: FeedPost) => {
      const on = !saved.has(post.id);
      setIn(setSaved, post.id, on);
      // The copy in your box stays even if you un-save: you may have changed it.
      if (on) addRecipe(recipeFromPost(post));
      if (!session) return undefined; // Saved on this device; nothing to count.
      bump(post.id, 'saves', on ? 1 : -1);
      const r = await withSession((s) => api!.react(s, 'save', post.id, on));
      if (r.error) bump(post.id, 'saves', on ? -1 : 1);
      return r.error;
    },
    [saved, addRecipe, session, bump, withSession, api],
  );

  const report = useCallback(
    async (post: FeedPost, reason: string) => {
      const r = await withSession((s) => api!.reportPost(s, post.id, reason));
      if (r.error) return r.error;
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      return undefined;
    },
    [withSession, api],
  );

  const block = useCallback(
    async (post: FeedPost) => {
      const r = await withSession((s) => api!.blockUser(s, post.authorId));
      if (r.error) return r.error;
      setPosts((prev) => prev.filter((p) => p.authorId !== post.authorId));
      return undefined;
    },
    [withSession, api],
  );

  const remove = useCallback(
    async (post: FeedPost) => {
      const pathOf = (url?: string) =>
        url ? decodeURIComponent(url.split('/object/public/post-media/')[1] ?? '') : null;
      const r = await withSession((s) =>
        api!.deletePost(s, {
          id: post.id,
          video_path: pathOf(post.videoUrl) ?? '',
          poster_path: pathOf(post.posterUrl),
        }),
      );
      if (r.error) return r.error;
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      return undefined;
    },
    [withSession, api],
  );

  const loadUsername = useCallback(async () => {
    const r = await withSession((s) => api!.getUsername(s));
    setUsernameState(r.value);
    return r.value;
  }, [withSession, api]);

  const setUsername = useCallback(
    async (name: string) => {
      const r = await withSession((s) => api!.setUsername(s, name));
      if (!r.error) setUsernameState(name);
      return r.error;
    },
    [withSession, api],
  );

  const publish = useCallback(
    async (recipe: Recipe, video: PickedVideo, onProgress: (step: string) => void) => {
      const r = await withSession(async (s) => {
        onProgress('Uploading video…');
        const videoPath = mediaPath(s.userId, video.ext);
        await api!.uploadMedia(s, videoPath, await readFileBytes(video.uri), video.mimeType);
        let posterPath: string | undefined;
        if (video.posterUri) {
          onProgress('Uploading cover…');
          posterPath = mediaPath(s.userId, 'jpg');
          try {
            await api!.uploadMedia(
              s,
              posterPath,
              await readFileBytes(video.posterUri),
              'image/jpeg',
            );
          } catch {
            posterPath = undefined; // The video alone is enough.
          }
        }
        onProgress('Posting…');
        try {
          return await api!.createPost(s, { recipe: toPostRecipe(recipe), videoPath, posterPath });
        } catch (e) {
          // Don't leave an orphaned upload behind.
          await api!
            .deleteMedia(
              s,
              [videoPath, posterPath].filter((p): p is string => !!p),
            )
            .catch(() => undefined);
          throw e;
        }
      });
      if (!r.value) return { error: r.error };
      const post = toPost(r.value, api!);
      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      return { post };
    },
    [withSession, api],
  );

  const value = useMemo<FeedContextValue>(
    () => ({
      available: !!api,
      posts,
      loading,
      reachedEnd,
      error,
      refresh,
      loadMore,
      loadTop,
      loadPost,
      stats,
      isLiked,
      isSaved,
      toggleLike,
      toggleSave,
      report,
      block,
      remove,
      username,
      loadUsername,
      setUsername,
      publish,
    }),
    [
      api,
      posts,
      loading,
      reachedEnd,
      error,
      refresh,
      loadMore,
      loadTop,
      loadPost,
      stats,
      isLiked,
      isSaved,
      toggleLike,
      toggleSave,
      report,
      block,
      remove,
      username,
      loadUsername,
      setUsername,
      publish,
    ],
  );

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext);
  if (!ctx) throw new Error('useFeed must be used inside <FeedProvider>');
  return ctx;
}
