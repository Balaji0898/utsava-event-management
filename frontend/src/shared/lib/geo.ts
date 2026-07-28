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

export function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/** Promisified getCurrentPosition with typed, graceful outcomes. */
export function getCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!geolocationSupported()) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? 'denied'
            : err.code === err.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        resolve({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
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
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
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
      const r = await fetch(
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
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`);
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
