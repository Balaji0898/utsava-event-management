// Backend origin used ONLY server-side (RSC / route handlers). Prefer a
// server-only var so it isn't shipped to the browser; fall back to the existing
// public var so current deployments keep working.
const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Same-origin path the browser hits; Next rewrites it to the backend server-side
// (see next.config.mjs). The backend origin never appears in a browser request.
const CLIENT_PROXY_BASE = '/api/backend';

/**
 * Resolve the URL for an API call. In the browser we go through the same-origin
 * reverse proxy (no CORS, backend host hidden); on the server we call the
 * backend directly. `path` starts with "/" (e.g. "/vendors").
 */
export function apiUrl(path: string): string {
  return typeof window === 'undefined'
    ? `${BACKEND_URL}/api${path}`
    : `${CLIENT_PROXY_BASE}${path}`;
}

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

type FetchOptions = RequestInit & {
  auth?: boolean;
  /**
   * Optional deadline in ms, covering the headers and the body. Without one, a
   * cold/hanging backend leaves the returned promise pending indefinitely — and
   * any loading UI awaiting it spinning forever. Combines with a caller `signal`:
   * whichever fires first aborts the request.
   */
  timeoutMs?: number;
};

/** A failed API call. `status` is absent when no usable HTTP response arrived. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Response validators, so a malformed payload counts as a failure. */
export const isList = (data: unknown): boolean => Array.isArray(data);
export const isPage = (data: unknown): boolean => Array.isArray((data as any)?.data);

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Query strings are dropped: they can hold a visitor's coordinates or search
 * text, and `section` already says which call this was.
 */
function logTarget(section: string | undefined, path: string) {
  return `[api] section=${section ?? 'unknown'} path=${path.split('?')[0]}`;
}

function failureReason(err: unknown): string {
  if ((err as Error)?.name === 'AbortError') return 'timed out or aborted';
  const cause = (err as { cause?: { code?: string } })?.cause?.code;
  const message = err instanceof Error ? err.message : String(err);
  return cause ? `${message} (${cause})` : message;
}

/** Timeouts, network errors, malformed payloads, 5xx and 429 can all heal. */
function isRetryable(err: unknown): boolean {
  const status = err instanceof ApiError ? err.status : undefined;
  return status === undefined || status >= 500 || status === 429;
}

function isDynamicBailout(err: unknown): boolean {
  return (err as { digest?: string })?.digest === 'DYNAMIC_SERVER_USAGE';
}

/** Waits `ms`, ending early if `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done, { once: true });
  });
}

type RetryOptions = {
  retries: number;
  /** Wait before retry N; the last entry repeats. */
  backoffMs: number[];
  section?: string;
  path: string;
  signal?: AbortSignal | null;
};

/**
 * Runs `attempt` until it succeeds, spacing retries out so that a backend which
 * is restarting gets time to come back. Without the wait, every retry lands
 * inside the same few milliseconds of the same outage.
 */
async function withRetry<T>(
  attempt: () => Promise<T>,
  { retries, backoffMs, section, path, signal }: RetryOptions,
): Promise<T> {
  const target = logTarget(section, path);
  for (let tries = 0; ; tries++) {
    if (isDev) console.debug(`${target} request attempt=${tries + 1}`);
    try {
      const result = await attempt();
      if (isDev) console.debug(`${target} ok attempt=${tries + 1}`);
      return result;
    } catch (err) {
      // Neither is a failure: the caller walked away, or Next is using a throw to
      // mark this page as dynamic during the build.
      if (signal?.aborted || isDynamicBailout(err)) throw err;
      console.warn(
        `${target} failed attempt=${tries + 1}/${retries + 1} ` +
          `status=${(err as ApiError).status ?? 'none'} reason=${failureReason(err)}`,
      );
      if (tries >= retries || !isRetryable(err)) throw err;
      await sleep(backoffMs[Math.min(tries, backoffMs.length - 1)], signal);
    }
  }
}

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
    const res = await fetch(apiUrl('/auth/refresh'), {
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

export async function api<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs, ...rest } = options;
  if (!timeoutMs) return request<T>(path, rest);

  // See FetchOptions.timeoutMs. The timer stays armed until the body has been
  // read, because a stalled body hangs a caller just as a stalled response does.
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  if (rest.signal?.aborted) abort();
  rest.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await request<T>(path, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    rest.signal?.removeEventListener('abort', abort);
  }
}

async function request<T>(
  path: string,
  options: Omit<FetchOptions, 'timeoutMs'>,
  _retried = false,
): Promise<T> {
  const { auth: useAuth, headers, ...rest } = options;
  const token = useAuth ? getToken() : null;

  const res = await fetch(apiUrl(path), {
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
      return request<T>(path, options, true); // retry once with the new access token
    }
    forceLogout();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
  }

  // A successful admin create/update/delete means the underlying public data
  // changed — bust the relevant cache tag(s) so the site reflects it right away
  // instead of waiting for the time-based fallback. Fire-and-forget.
  bustCacheAfterMutation(path, rest.method, token);

  return parseJsonSafe(res) as Promise<T>;
}

/**
 * Parse a response body as JSON, tolerating an EMPTY body. NestJS serializes a
 * `null`/`undefined`/void return as a zero-length body, and `res.json()` would
 * then throw "Unexpected end of JSON input". Returns null for an empty body.
 */
async function parseJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type ReadOptions = {
  /** Section name for logs. */
  section?: string;
  /** Rejects a malformed payload, which is then retried like any failure. */
  validate?: (data: unknown) => boolean;
  /** Per-attempt deadline in ms. */
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
};

/**
 * Backoff for browser reads. With the 12s default deadline, four attempts span
 * about 65s, which outlasts the 30-60s cold start of a sleeping backend
 * (DEPLOYMENT.md, "Free-tier note").
 */
const CLIENT_BACKOFF_MS = [2000, 5000, 10000];

/** Public GET from the browser, retried through transient failures. */
export function apiRead<T>(
  path: string,
  { section, validate, timeoutMs = 12000, retries = 3, signal }: ReadOptions = {},
): Promise<T> {
  return withRetry(
    async () => {
      const data = await api<T>(path, { timeoutMs, signal });
      if (validate && !validate(data)) throw new ApiError('Unexpected response shape');
      return data;
    },
    { retries, backoffMs: CLIENT_BACKOFF_MS, section, path, signal },
  );
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
  /** Section name for logs. */
  section?: string;
  /**
   * Rejects a malformed payload. Runs inside the cached function, so a bad
   * response is treated as a failure and never stored.
   */
  validate?: (data: unknown) => boolean;
};

/** Outcome of a server read; `failed` tells "no data" apart from "couldn't load". */
export type ServerResult<T> = { data: T | null; failed: boolean };

const SERVER_BACKOFF_MS = [500, 1500];

/**
 * Parse a server-side response. An empty body is a genuine null (see
 * parseJsonSafe), but anything else that isn't JSON came from something other
 * than the API, such as a platform error page, and must not reach the cache.
 */
function parseJsonStrict(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('Response was not JSON');
  }
}

/** Fetch JSON once with a bounded timeout. Throws on any failure. */
async function fetchJsonOrThrow<T>(
  url: string,
  timeoutMs: number,
  validate?: (data: unknown) => boolean,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // no-store here: caching is handled one layer up by unstable_cache, so we
    // don't want the fetch Data Cache to also cache (including failures).
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
    const data = parseJsonStrict(await res.text());
    if (validate && !validate(data)) throw new ApiError('Unexpected response shape');
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Like `serverApi`, but reports whether the read failed. */
export async function serverRead<T = any>(
  path: string,
  { revalidate = 300, tags = [], timeoutMs = 10000, retries = 2, section, validate }: ServerApiOptions = {},
): Promise<ServerResult<T>> {
  // Server-side: call the backend directly (never through the browser proxy).
  const url = apiUrl(path);
  // Cache the successful result across requests, keyed by path, under `tags`.
  const getCached = unstable_cache(
    () =>
      withRetry(() => fetchJsonOrThrow<T>(url, timeoutMs, validate), {
        retries,
        backoffMs: SERVER_BACKOFF_MS,
        section,
        path,
      }),
    ['serverApi', path],
    { revalidate, tags },
  );
  try {
    return { data: await getCached(), failed: false };
  } catch {
    // Miss/failure is not cached (the fn threw) — render empty, retry next time.
    return { data: null, failed: true };
  }
}

export async function serverApi<T = any>(
  path: string,
  options: ServerApiOptions = {},
): Promise<T | null> {
  return (await serverRead<T>(path, options)).data;
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
        await fetch(apiUrl('/auth/logout'), {
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
