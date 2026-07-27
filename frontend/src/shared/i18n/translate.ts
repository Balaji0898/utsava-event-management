/**
 * Live machine translation of dynamic backend content via MyMemory — a free,
 * keyless, CORS-friendly API. Only used when the target locale isn't English.
 *
 * Results are cached in-memory and in localStorage so each unique string is
 * fetched once per browser (the content set is small, keeping us within the
 * free tier). Any failure/limit falls back to the original English text.
 *
 * Swap `fetchTranslation` for a self-hosted LibreTranslate / keyed provider for
 * production-grade reliability & quality.
 */

type Locale = string;

const memCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

const keyFor = (target: Locale, text: string) => `${target}:${text}`;
const lsKey = (target: Locale, text: string) => {
  // short, stable key (djb2 hash) to keep localStorage tidy
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return `utsava_tr_${target}_${(h >>> 0).toString(36)}`;
};

function readLS(target: Locale, text: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(lsKey(target, text));
  } catch {
    return null;
  }
}
function writeLS(target: Locale, text: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lsKey(target, text), value);
  } catch {
    /* quota / private mode — ignore */
  }
}

async function fetchTranslation(text: string, target: Locale): Promise<string> {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(`en|${target}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = await res.json();
  const out = data?.responseData?.translatedText;
  // MyMemory sometimes returns an error sentence in translatedText; guard it.
  if (typeof out !== 'string' || !out || /MYMEMORY WARNING|INVALID/i.test(out)) {
    throw new Error('translate no-result');
  }
  return out;
}

/**
 * Translate `text` into `target`. Returns the original text for English, empty
 * input, or on any failure. Cached across calls and page loads.
 */
export async function translateText(text: string, target: Locale): Promise<string> {
  const trimmed = (text ?? '').trim();
  if (!trimmed || target === 'en') return text;

  const k = keyFor(target, trimmed);
  const mem = memCache.get(k);
  if (mem !== undefined) return mem;

  const stored = readLS(target, trimmed);
  if (stored !== null) {
    memCache.set(k, stored);
    return stored;
  }

  const existing = inFlight.get(k);
  if (existing) return existing;

  const p = fetchTranslation(trimmed, target)
    .then((out) => {
      memCache.set(k, out);
      writeLS(target, trimmed, out);
      inFlight.delete(k);
      return out;
    })
    .catch(() => {
      inFlight.delete(k);
      return text; // graceful fallback to the original
    });

  inFlight.set(k, p);
  return p;
}
