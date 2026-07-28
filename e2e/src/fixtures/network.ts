import type { BrowserContext, Route } from '@playwright/test';
import { blockedHosts, nominatimStub, photonStub, thirdPartyHosts } from '@config/third-party';

/**
 * One place for every third-party host the app reaches from the browser.
 *
 * Without this the suite silently depends on five external services, and on
 * `api.mymemory.translated.net` in particular — which the i18n layer calls for
 * every backend-sourced string and which then MUTATES the rendered text. A text
 * assertion racing a free-tier translation API is not fixable by retrying.
 *
 * Route handlers are registered on the context, so they survive navigation and
 * apply to popups too (the booking form's privacy-policy link opens a new tab).
 */

export type NetworkOptions = {
  /**
   * Abort remote images and fonts. On by default — they are decorative, Next
   * reserves their layout box either way, and aborting them saves real time.
   * The `visual` project turns this OFF, because there the images are the
   * subject; those specs mask the image regions instead.
   */
  blockDecorative?: boolean;
  /** Record every third-party URL the page attempted. Used by an assertion spec. */
  recordAttempts?: string[];
};

/**
 * Deterministic stand-in for the MyMemory translation API.
 *
 * Echoing the input back means the `te` locale renders identical text to `en` for
 * backend-sourced strings, so a spec can exercise the translation code path
 * without its assertions depending on a translation. The dictionary-driven
 * (static) strings still switch to Telugu, which is what the i18n specs check.
 */
async function fulfillTranslate(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const q = url.searchParams.get('q') ?? '';
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      responseData: { translatedText: q, match: 1 },
      responseStatus: 200,
      matches: [{ translation: q, quality: '100' }],
    }),
  });
}

/**
 * Install the full set. Idempotent per context.
 */
export async function mockThirdParties(context: BrowserContext, opts: NetworkOptions = {}): Promise<void> {
  const { blockDecorative = true, recordAttempts } = opts;

  const note = (url: string) => {
    if (recordAttempts) recordAttempts.push(url);
  };

  // --- stubbed: the app's behaviour depends on the response shape -------------
  await context.route(thirdPartyHosts.translate, async (route) => {
    note(route.request().url());
    await fulfillTranslate(route);
  });

  await context.route(thirdPartyHosts.photon, async (route) => {
    note(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(photonStub) });
  });

  await context.route(thirdPartyHosts.nominatim, async (route) => {
    note(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nominatimStub) });
  });

  // --- blocked: decorative only ----------------------------------------------
  if (blockDecorative) {
    for (const pattern of blockedHosts) {
      await context.route(pattern, async (route) => {
        note(route.request().url());
        await route.abort();
      });
    }
  }
}

/**
 * A 1x1 transparent PNG, served in place of remote images.
 *
 * Used by the `visual` project instead of aborting: an aborted <img> renders the
 * browser's broken-image glyph, which differs across platforms and would poison
 * every baseline. A real, tiny, identical PNG renders identically everywhere.
 */
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+XJPLTQAAAABJRU5ErkJggg==',
  'base64',
);

/** Replace every remote image with a deterministic placeholder. For visual specs. */
export async function stubRemoteImages(context: BrowserContext): Promise<void> {
  for (const pattern of [thirdPartyHosts.unsplash, thirdPartyHosts.dicebear, thirdPartyHosts.pravatar]) {
    await context.route(pattern, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG }),
    );
  }
}

/**
 * Fail the test if the page reaches ANY un-mocked external host.
 *
 * Catches a new third-party dependency being introduced without the suite
 * noticing — the failure mode being a slow, intermittently-flaky suite that
 * nobody can explain.
 */
export async function forbidUnmockedExternalHosts(
  context: BrowserContext,
  allowedHosts: readonly string[],
  onViolation: (url: string) => void,
): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return '';
      }
    })();
    const isLocal = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host);
    const isAllowed = allowedHosts.some((h) => host.endsWith(h));
    const isData = url.startsWith('data:') || url.startsWith('blob:');
    if (!isLocal && !isAllowed && !isData) onViolation(url);
    await route.fallback();
  });
}

/**
 * Simulate the API being unreachable.
 *
 * Worth its own helper because of a specific trap: `serverApi()` in
 * `frontend/src/shared/lib/api.ts` swallows every failure and returns null, so a
 * dead backend renders "Nothing to show yet." / "0 listings available" instead of
 * an error. The error-boundary specs use this to prove which surfaces degrade
 * silently — and which correctly surface an error.
 */
export async function breakApi(context: BrowserContext, apiOrigin: string): Promise<void> {
  await context.route(`${apiOrigin}/api/**`, (route) => route.abort('connectionrefused'));
}

/** Force a specific API path to a given status — for error-state specs. */
export async function failApiPath(
  context: BrowserContext,
  apiOrigin: string,
  path: string,
  status = 500,
  body: unknown = { statusCode: status, message: 'Injected failure' },
): Promise<void> {
  await context.route(`${apiOrigin}/api${path}*`, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}
