/**
 * A small client for the parts of Supabase the app uses (sign in, synced data, households, shared
 * recipes), written against its REST endpoints so it needs no extra packages. `fetch` is passed in
 * so it can be tested.
 */

export type Session = {
  accessToken: string;
  refreshToken: string;
  /** When the access token stops working, in ms since 1970. */
  expiresAt: number;
  userId: string;
  email: string;
};

export type RemoteRow = { key: string; value: unknown; updatedAt: number };

/** A post as the database returns it. */
export type PostRow = {
  id: string;
  author_id: string;
  recipe: unknown;
  video_path: string;
  poster_path: string | null;
  like_count: number;
  save_count: number;
  created_at: string;
  profiles: { username: string } | null;
};

const MEDIA_BUCKET = 'post-media';
const POST_COLUMNS =
  'id,author_id,recipe,video_path,poster_path,like_count,save_count,created_at,profiles(username)';
export type Household = { id: string; code: string };

export class SupabaseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type FetchLike = typeof fetch;

export type SupabaseConfig = { url: string; key: string };

/** Reads the project URL and publishable key the app was built with, if both are set. */
export function configFromEnv(env: Record<string, string | undefined>): SupabaseConfig | undefined {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.EXPO_PUBLIC_SUPABASE_KEY?.trim();
  return url && key && /^https?:\/\//.test(url) ? { url, key } : undefined;
}

function sessionFrom(body: Record<string, unknown>, now: number): Session | undefined {
  const user = body.user as { id?: string; email?: string } | undefined;
  if (
    typeof body.access_token !== 'string' ||
    typeof body.refresh_token !== 'string' ||
    !user?.id
  ) {
    return undefined;
  }
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: now + expiresIn * 1000,
    userId: user.id,
    email: user.email ?? '',
  };
}

export function createSupabase(config: SupabaseConfig, fetchImpl: FetchLike = fetch) {
  const base = { apikey: config.key, 'Content-Type': 'application/json' };

  async function call(path: string, init: RequestInit, token?: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchImpl(`${config.url}${path}`, {
        ...init,
        headers: { ...base, Authorization: `Bearer ${token ?? config.key}`, ...init.headers },
      });
    } catch {
      throw new SupabaseError('Couldn’t reach the server. Check your connection.', 0);
    }
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const b = (body ?? {}) as Record<string, unknown>;
      const message = [b.msg, b.error_description, b.message, b.error].find(
        (m): m is string => typeof m === 'string' && !!m,
      );
      throw new SupabaseError(message ?? `Request failed (${res.status})`, res.status);
    }
    return body;
  }

  const post = (
    path: string,
    body: unknown,
    token?: string,
    headers: Record<string, string> = {},
  ) => call(path, { method: 'POST', body: JSON.stringify(body), headers }, token);

  return {
    /** Returns the session, or undefined when the project asks the user to confirm their email first. */
    async signUp(email: string, password: string, now = Date.now()): Promise<Session | undefined> {
      const body = (await post('/auth/v1/signup', { email, password })) as Record<string, unknown>;
      return sessionFrom(body ?? {}, now);
    },

    async signIn(email: string, password: string, now = Date.now()): Promise<Session> {
      const body = (await post('/auth/v1/token?grant_type=password', {
        email,
        password,
      })) as Record<string, unknown>;
      const session = sessionFrom(body ?? {}, now);
      if (!session) throw new SupabaseError('Unexpected answer from the server.', 500);
      return session;
    },

    async refresh(refreshToken: string, now = Date.now()): Promise<Session> {
      const body = (await post('/auth/v1/token?grant_type=refresh_token', {
        refresh_token: refreshToken,
      })) as Record<string, unknown>;
      const session = sessionFrom(body ?? {}, now);
      if (!session) throw new SupabaseError('Unexpected answer from the server.', 500);
      return session;
    },

    /** All synced rows for a scope (the user's id, or their household's id). */
    async getData(session: Session, scope: string): Promise<RemoteRow[]> {
      const rows = (await call(
        `/rest/v1/user_data?select=key,value,updated_at&scope=eq.${encodeURIComponent(scope)}`,
        { method: 'GET' },
        session.accessToken,
      )) as { key: string; value: unknown; updated_at: string }[];
      return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: Date.parse(r.updated_at) }));
    },

    async putData(session: Session, scope: string, rows: RemoteRow[]): Promise<void> {
      if (!rows.length) return;
      await post(
        '/rest/v1/user_data?on_conflict=scope,key',
        rows.map((r) => ({
          scope,
          key: r.key,
          value: r.value,
          updated_at: new Date(r.updatedAt).toISOString(),
        })),
        session.accessToken,
        { Prefer: 'resolution=merge-duplicates,return=minimal' },
      );
    },

    async createHousehold(session: Session): Promise<Household> {
      const rows = (await post(
        '/rest/v1/rpc/create_household',
        {},
        session.accessToken,
      )) as Household[];
      return rows[0];
    },

    async joinHousehold(session: Session, code: string): Promise<Household> {
      const rows = (await post(
        '/rest/v1/rpc/join_household',
        { p_code: code },
        session.accessToken,
      )) as Household[];
      return rows[0];
    },

    async leaveHousehold(session: Session): Promise<void> {
      await post('/rest/v1/rpc/leave_household', {}, session.accessToken);
    },

    /** The household the user belongs to, if any. */
    async myHousehold(session: Session): Promise<Household | undefined> {
      const members = (await call(
        '/rest/v1/household_members?select=household_id',
        { method: 'GET' },
        session.accessToken,
      )) as { household_id: string }[];
      if (!members.length) return undefined;
      const rows = (await call(
        `/rest/v1/households?select=id,code&id=eq.${encodeURIComponent(members[0].household_id)}`,
        { method: 'GET' },
        session.accessToken,
      )) as Household[];
      return rows[0];
    },

    /** Publishes a recipe and returns the id that goes in its link. */
    async shareRecipe(session: Session, recipe: unknown): Promise<string> {
      const rows = (await post(
        '/rest/v1/shared_recipes?select=id',
        { recipe },
        session.accessToken,
        { Prefer: 'return=representation' },
      )) as { id: string }[];
      return rows[0].id;
    },

    /** Reads a shared recipe by its link id. No sign-in needed. */
    async getSharedRecipe(id: string): Promise<unknown | undefined> {
      const recipe = await post('/rest/v1/rpc/get_shared_recipe', { p_id: id });
      return recipe ?? undefined;
    },

    // ---------- Discover feed ----------

    /** Public address of a file in the post-media bucket (videos stream from here). */
    mediaUrl(path: string): string {
      return `${config.url}/storage/v1/object/public/${MEDIA_BUCKET}/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
    },

    /** Uploads a video or cover image into the signed-in user's folder. */
    async uploadMedia(
      session: Session,
      path: string,
      body: Blob | ArrayBuffer | Uint8Array,
      contentType: string,
    ): Promise<void> {
      await call(
        `/storage/v1/object/${MEDIA_BUCKET}/${path}`,
        {
          method: 'POST',
          body: body as BodyInit,
          headers: { 'Content-Type': contentType, 'x-upsert': 'false', 'cache-control': '3600' },
        },
        session.accessToken,
      );
    },

    async deleteMedia(session: Session, paths: string[]): Promise<void> {
      if (!paths.length) return;
      await call(
        `/storage/v1/object/${MEDIA_BUCKET}`,
        { method: 'DELETE', body: JSON.stringify({ prefixes: paths }) },
        session.accessToken,
      );
    },

    async getUsername(session: Session): Promise<string | undefined> {
      const rows = (await call(
        `/rest/v1/profiles?select=username&id=eq.${encodeURIComponent(session.userId)}`,
        { method: 'GET' },
        session.accessToken,
      )) as { username: string }[];
      return rows[0]?.username;
    },

    async setUsername(session: Session, username: string): Promise<void> {
      try {
        await post(
          '/rest/v1/profiles?on_conflict=id',
          { id: session.userId, username },
          session.accessToken,
          { Prefer: 'resolution=merge-duplicates,return=minimal' },
        );
      } catch (e) {
        if (e instanceof SupabaseError && e.status === 409) {
          throw new SupabaseError('That username is taken. Try another one.', 409);
        }
        throw e;
      }
    },

    /** Newest posts first; pass `before` (the oldest post's time) to load the next page. */
    async listPosts(
      session: Session | undefined,
      opts: { before?: number; limit?: number } = {},
    ): Promise<PostRow[]> {
      const filters = [
        `select=${POST_COLUMNS}`,
        'order=created_at.desc',
        `limit=${opts.limit ?? 20}`,
        opts.before
          ? `created_at=lt.${encodeURIComponent(new Date(opts.before).toISOString())}`
          : '',
      ].filter(Boolean);
      return (await call(
        `/rest/v1/posts?${filters.join('&')}`,
        { method: 'GET' },
        session?.accessToken,
      )) as PostRow[];
    },

    async getPosts(session: Session | undefined, ids: string[]): Promise<PostRow[]> {
      if (!ids.length) return [];
      return (await call(
        `/rest/v1/posts?select=${POST_COLUMNS}&id=in.(${ids.map(encodeURIComponent).join(',')})`,
        { method: 'GET' },
        session?.accessToken,
      )) as PostRow[];
    },

    /** Post ids ranked by likes or saves, this week or ever. */
    async topPosts(
      session: Session | undefined,
      metric: 'likes' | 'saves',
      period: 'week' | 'all',
      limit = 30,
    ): Promise<{ postId: string; score: number }[]> {
      const rows = (await post(
        '/rest/v1/rpc/top_posts',
        { p_metric: metric, p_period: period, p_limit: limit },
        session?.accessToken,
      )) as { post_id: string; score: number }[];
      return rows.map((r) => ({ postId: r.post_id, score: Number(r.score) }));
    },

    async createPost(
      session: Session,
      post_: { recipe: unknown; videoPath: string; posterPath?: string },
    ): Promise<PostRow> {
      const rows = (await post(
        `/rest/v1/posts?select=${POST_COLUMNS}`,
        {
          recipe: post_.recipe,
          video_path: post_.videoPath,
          poster_path: post_.posterPath ?? null,
        },
        session.accessToken,
        { Prefer: 'return=representation' },
      )) as PostRow[];
      return rows[0];
    },

    async deletePost(session: Session, row: Pick<PostRow, 'id' | 'video_path' | 'poster_path'>) {
      await call(
        `/rest/v1/posts?id=eq.${encodeURIComponent(row.id)}`,
        { method: 'DELETE' },
        session.accessToken,
      );
      await this.deleteMedia(
        session,
        [row.video_path, row.poster_path].filter((p): p is string => !!p),
      );
    },

    /** Which of these posts the user has liked and saved. */
    async myReactions(
      session: Session,
      ids: string[],
    ): Promise<{ liked: string[]; saved: string[] }> {
      if (!ids.length) return { liked: [], saved: [] };
      const q = `?select=post_id&post_id=in.(${ids.map(encodeURIComponent).join(',')})`;
      const [liked, saved] = (await Promise.all([
        call(`/rest/v1/post_likes${q}`, { method: 'GET' }, session.accessToken),
        call(`/rest/v1/post_saves${q}`, { method: 'GET' }, session.accessToken),
      ])) as { post_id: string }[][];
      return { liked: liked.map((r) => r.post_id), saved: saved.map((r) => r.post_id) };
    },

    /** Likes or saves (on = true) or removes it (on = false). */
    async react(session: Session, kind: 'like' | 'save', postId: string, on: boolean) {
      const table = kind === 'like' ? 'post_likes' : 'post_saves';
      if (on) {
        try {
          await post(`/rest/v1/${table}`, { post_id: postId }, session.accessToken, {
            Prefer: 'return=minimal',
          });
        } catch (e) {
          // Already liked/saved (e.g. from another device): that's the state we want.
          if (!(e instanceof SupabaseError && e.status === 409)) throw e;
        }
      } else {
        await call(
          `/rest/v1/${table}?post_id=eq.${encodeURIComponent(postId)}&user_id=eq.${encodeURIComponent(session.userId)}`,
          { method: 'DELETE' },
          session.accessToken,
        );
      }
    },

    async reportPost(session: Session, postId: string, reason: string) {
      try {
        await post(
          '/rest/v1/post_reports',
          { post_id: postId, reason: reason.slice(0, 200) },
          session.accessToken,
          { Prefer: 'return=minimal' },
        );
      } catch (e) {
        if (!(e instanceof SupabaseError && e.status === 409)) throw e; // already reported
      }
    },

    async blockUser(session: Session, userId: string) {
      try {
        await post('/rest/v1/blocks', { blocked_id: userId }, session.accessToken, {
          Prefer: 'return=minimal',
        });
      } catch (e) {
        if (!(e instanceof SupabaseError && e.status === 409)) throw e; // already blocked
      }
    },
  };
}

export type SupabaseClient = ReturnType<typeof createSupabase>;

const SHARE_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Link that opens a shared recipe in the app. */
export function shareLink(id: string): string {
  return `recipeapp://recipe/import?share=${id}`;
}

/** Finds a shared recipe id in a link or in pasted text. */
export function parseShareId(text: string): string | undefined {
  return text.match(SHARE_ID)?.[0].toLowerCase();
}
