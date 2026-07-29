/**
 * Free, keyless geolocation helpers — browser Geolocation API + OpenStreetMap
 * (Photon primary, Nominatim fallback). No Google Places (that needs a paid
 * key). Everything degrades gracefully: failures never throw to the UI, so
 * manual entry always works.
 */

export type GeoResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' | 'timeout' };

export type Place = { label: string; city: string };

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/** Wall-clock ceiling for a position request, prompt time included. */
const POSITION_TIMEOUT_MS = 12000;

/** Ceiling for the third-party (OSM) lookups — they must never hang the UI. */
const LOOKUP_TIMEOUT_MS = 6000;

export function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/**
 * Current geolocation permission, where the browser exposes it (older Safari
 * doesn't → 'unknown'). Lets callers skip a position request that would only
 * fail, and tell "prompt pending" apart from "already granted".
 */
export async function geolocationPermission(): Promise<GeoPermission> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state as GeoPermission;
  } catch {
    return 'unknown';
  }
}

/**
 * Promisified getCurrentPosition with typed, graceful outcomes.
 *
 * IMPORTANT: the Geolocation API's own `timeout` only starts counting once the
 * user has answered the permission prompt — while the prompt sits unanswered
 * (or the tab isn't focused, so Chrome defers showing it) NEITHER callback ever
 * fires. The outer timer below guarantees the promise always settles, so a
 * caller's loading state can't hang forever.
 */
export function getCurrentPosition(timeoutMs = POSITION_TIMEOUT_MS): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!geolocationSupported()) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }
    let settled = false;
    const finish = (result: GeoResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => finish({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        finish({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300000 },
    );
  });
}

/** fetch with a hard deadline (AbortSignal.timeout isn't in older Safari). */
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function labelFrom(name?: string, state?: string, country?: string): string {
  return Array.from(new Set([name, state, country].filter(Boolean))).join(', ');
}

const reverseCache = new Map<string, Place | null>();

/** lat/lng → nearest city (Photon, then Nominatim). */
export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = reverseCache.get(key);
  if (cached !== undefined) return cached;

  let place: Place | null = null;

  try {
    const r = await fetchWithTimeout(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
    if (r.ok) {
      const p = (await r.json())?.features?.[0]?.properties;
      const city = p?.city || p?.name || p?.county || p?.state;
      if (city) place = { city, label: labelFrom(city, p?.state, p?.country) };
    }
  } catch {
    /* fall through to Nominatim */
  }

  if (!place) {
    try {
      const r = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (r.ok) {
        const d = await r.json();
        const a = d?.address ?? {};
        const city = a.city || a.town || a.village || a.state_district || a.state;
        if (city) place = { city, label: labelFrom(city, a.state, a.country) };
      }
    } catch {
      /* ignore — returns null */
    }
  }

  reverseCache.set(key, place);
  return place;
}

const searchCache = new Map<string, Place[]>();

/** Debounced-by-caller place/city autocomplete (Photon). */
export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cached = searchCache.get(q);
  if (cached) return cached;

  let out: Place[] = [];
  try {
    const r = await fetchWithTimeout(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`,
    );
    if (r.ok) {
      const feats = (await r.json())?.features ?? [];
      const seen = new Set<string>();
      out = feats
        .map((f: any) => {
          const p = f.properties ?? {};
          const city = p.city || p.name || '';
          return { city, label: labelFrom(p.name || p.city, p.state, p.country) };
        })
        .filter((x: Place) => {
          if (!x.city || seen.has(x.label)) return false;
          seen.add(x.label);
          return true;
        });
    }
  } catch {
    /* ignore — empty suggestions, manual entry still works */
  }

  searchCache.set(q, out);
  return out;
}
