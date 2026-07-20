const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
  return res.json();
}

// Server-side helper (no auth token; used by RSC for public data)
export async function serverApi<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
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
