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
