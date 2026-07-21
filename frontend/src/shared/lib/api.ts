const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Cache tags for public content. Each cached response is stored under one of
 * these; invalidate a tag (via /api/revalidate) to force the next request to
 * re-fetch that slice of data instead of serving the cached copy.
 */
export const CACHE_TAGS = {
  departments: 'departments',
  vendors: 'vendors',
  packages: 'packages',
  cms: 'cms',
} as const;

type FetchOptions = RequestInit & { auth?: boolean };

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

// ---- Refresh-token handling -------------------------------------------------
// A single in-flight refresh is shared across concurrent 401/403s so we only
// hit /auth/refresh once even if several requests expire at the same time.
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.accessToken) return false;
    localStorage.setItem('accessToken', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function forceLogout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  // send admins back to login (avoid redirect loop if already there)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

/**
 * Map a mutated backend path to the cache tag it affects. Vendors, departments,
 * packages and uploads all cross-reference each other on the public site (e.g.
 * a vendor edit changes department counts and nested packages), so those bust
 * everything with "all"; CMS content is isolated.
 */
function tagForMutatedPath(path: string): string | null {
  if (/^\/(auth|bookings)/.test(path)) return null; // no public-cache impact
  if (path.startsWith('/cms')) return CACHE_TAGS.cms;
  if (/^\/(vendors|departments|packages|uploads)/.test(path)) return 'all';
  return null;
}

/**
 * After a successful admin mutation, ask Next to invalidate the affected cache
 * tag(s). Fire-and-forget: never blocks or fails the original request.
 */
function bustCacheAfterMutation(path: string, method?: string, token?: string | null) {
  if (typeof window === 'undefined') return;
  const verb = (method ?? 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return;
  const tag = tagForMutatedPath(path);
  if (!tag) return;
  void fetch(`/api/revalidate?tag=${tag}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    keepalive: true,
  }).catch(() => {
    /* best-effort; the time-based fallback still refreshes the cache */
  });
}

export async function api<T = any>(
  path: string,
  options: FetchOptions = {},
  _retried = false,
): Promise<T> {
  const { auth: useAuth, headers, ...rest } = options;
  const token = useAuth ? getToken() : null;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  // Access token expired/blocked → try one refresh + retry, then give up.
  // Exclude only the endpoints that must never trigger a refresh (would recurse
  // or are public): /auth/refresh, /auth/login, /auth/register, /auth/logout.
  // /auth/me IS allowed to refresh so the session can self-heal after idle.
  const isAuthError = res.status === 401 || res.status === 403;
  const noRefresh = /^\/auth\/(refresh|login|register|logout)/.test(path);
  if (isAuthError && useAuth && !_retried && !noRefresh && typeof window !== 'undefined') {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return api<T>(path, options, true); // retry once with the new access token
    }
    forceLogout();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }

  // A successful admin create/update/delete means the underlying public data
  // changed — bust the relevant cache tag(s) so the site reflects it right away
  // instead of waiting for the time-based fallback. Fire-and-forget.
  bustCacheAfterMutation(path, rest.method, token);

  return res.json();
}

// Server-side helper (no auth token; used by RSC for public data).
//
// Public GET data is cached with `unstable_cache` (Next's Data Cache), keyed by
// path and stored under cache *tags*. This is independent of a page's render
// mode, so pages can render dynamically at request time (always showing live
// data, never an empty page baked at build) while still being served from cache
// on repeat requests/navigations — the backend is only hit when the cache is
// empty, its tag is invalidated (see /api/revalidate), or the time fallback
// elapses.
//
// IMPORTANT: the fetch THROWS on failure so a cold/slow-backend miss is never
// cached — the caller gets null (renders gracefully empty) and the very next
// request retries and warms the cache once the backend is up.
import { unstable_cache } from 'next/cache';

type ServerApiOptions = {
  /**
   * Time-based fallback for the cache, in seconds. The cached value is reused
   * for this long before a background refresh; use `revalidateTag` (via
   * /api/revalidate) to refresh sooner when the data actually changes.
   * Default: 300s (5 min).
   */
  revalidate?: number;
  /** Cache tags this response is stored under, for on-demand invalidation. */
  tags?: string[];
  /** Per-attempt timeout in ms before aborting. Default 10000ms. */
  timeoutMs?: number;
  /**
   * Number of retries after the first attempt. Default 2 — enough total time
   * (~30s) for a cold/idle backend (e.g. Render free tier) to wake on the first
   * request, while the branded loader covers the wait. Successful data is then
   * cached so subsequent loads are fast.
   */
  retries?: number;
};

/** Fetch JSON with a bounded timeout + retries. Throws on any failure. */
async function fetchJsonOrThrow<T>(
  url: string,
  timeoutMs: number,
  retries: number,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // no-store here: caching is handled one layer up by unstable_cache, so we
      // don't want the fetch Data Cache to also cache (including failures).
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) {
        // 5xx can be a transient cold start — retry; 4xx won't get better.
        if (res.status >= 500 && attempt < retries) {
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
        throw new Error(`Request failed (${res.status})`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) continue;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error('Request failed');
}

export async function serverApi<T = any>(
  path: string,
  { revalidate = 300, tags = [], timeoutMs = 10000, retries = 2 }: ServerApiOptions = {},
): Promise<T | null> {
  const url = `${API_URL}/api${path}`;
  // Cache the successful result across requests, keyed by path, under `tags`.
  const getCached = unstable_cache(
    () => fetchJsonOrThrow<T>(url, timeoutMs, retries),
    ['serverApi', path],
    { revalidate, tags },
  );
  try {
    return await getCached();
  } catch {
    // Miss/failure is not cached (the fn threw) — render empty, retry next time.
    return null;
  }
}

export const auth = {
  async login(email: string, password: string) {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  /** Explicit refresh (used on app/admin mount to validate the session). */
  refresh() {
    return refreshOnce();
  },

  async logout() {
    const token = getToken();
    // Clear client state immediately so the UI logs out right away.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
    // Best-effort server-side revoke of the stored refresh token (plain fetch,
    // so it never triggers the auto-refresh/redirect logic above).
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* ignore */
      }
    }
  },

  currentUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  },
};
