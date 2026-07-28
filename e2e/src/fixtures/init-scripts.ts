import type { BrowserContext } from '@playwright/test';

/**
 * Browser state seeded before any page script runs.
 *
 * `context.addInitScript` executes before every page's own scripts on every
 * navigation, which is exactly the window we need for all three of these.
 */

/** localStorage / sessionStorage keys the app owns. */
export const storageKeys = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'user',
  locale: 'locale',
  theme: 'theme',
  /** Prefix — the translation cache writes one key per (locale, string hash). */
  translationCachePrefix: 'utsava_tr_',
  /** sessionStorage. Set → the launch splash never shows. */
  launched: 'utsava_launched',
} as const;

/**
 * Kill the launch splash.
 *
 * `shared/ui/launch-screen.tsx` renders `#launch-overlay` as
 * `position:fixed; inset:0; z-index:100` over an opaque gradient, fades it with a
 * CSS animation at 1.8s and unmounts it at 2600ms. It is gated on
 * `sessionStorage['utsava_launched']` — and Playwright gives every context fresh
 * session storage, so without this the splash swallows every click for the first
 * ~1.8 seconds of EVERY test in the suite.
 *
 * Setting the flag here is enough and is the cleanest possible fix: the root
 * layout ships a blocking inline `launchGuard` script that reads exactly this key
 * and stamps `data-launched` on <html>, and `globals.css:123` then hides the
 * overlay with `display:none`. Because init scripts run before page scripts, the
 * guard sees the flag on its very first evaluation — no flash, no timing race,
 * and no CSS injected by the test that could mask a real regression.
 *
 * The `data-launched` attribute is also set directly as a belt-and-braces
 * fallback in case the inline guard is ever removed.
 */
export async function suppressLaunchSplash(context: BrowserContext): Promise<void> {
  await context.addInitScript((key: string) => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage disabled — the fallback below still applies */
    }
    // Fallback for the (unlikely) case that the inline launchGuard is gone.
    const stamp = () => document.documentElement?.setAttribute('data-launched', '');
    stamp();
    document.addEventListener('DOMContentLoaded', stamp, { once: true });
  }, storageKeys.launched);
}

/**
 * Pin the locale to English.
 *
 * `shared/i18n/index.tsx` starts at 'en' and only reads localStorage in a
 * `useEffect`, so a persisted 'te' session flashes English first. Worse, in 'te'
 * every backend-sourced string is machine-translated via
 * `api.mymemory.translated.net` and the DOM text is REWRITTEN after load — any
 * text assertion becomes a race against an external HTTP call.
 *
 * So: 'en' everywhere by default, and the handful of i18n specs opt into 'te'
 * explicitly with the translation endpoint mocked.
 */
export async function pinLocale(context: BrowserContext, locale: 'en' | 'te' = 'en'): Promise<void> {
  await context.addInitScript(
    ([key, value]: [string, string]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    [storageKeys.locale, locale] as [string, string],
  );
}

/**
 * Pin the colour theme.
 *
 * `shared/ui/theme-toggle.tsx` renders an empty `<div className="h-9 w-9" />`
 * until mounted, so the "Toggle theme" button does not exist on first paint;
 * and next-themes would otherwise inherit the runner's OS preference and flip
 * half the palette between machines. Pinning it makes both the visual baselines
 * and the contrast assertions deterministic.
 */
export async function pinTheme(context: BrowserContext, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await context.addInitScript(
    ([key, value]: [string, string]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    [storageKeys.theme, theme] as [string, string],
  );
}

/**
 * Install an XSS tripwire.
 *
 * Every XSS spec seeds a probe on `window` and asserts it is still untouched
 * after the payload round-trips through the app. A distinct probe name per spec
 * file keeps parallel runs from reading each other's state.
 */
export async function installXssProbe(context: BrowserContext, probe: string): Promise<void> {
  await context.addInitScript((name: string) => {
    (window as unknown as Record<string, string>)[name] = 'safe';
  }, probe);
}

/** Apply the whole default set. Called by the `page` fixture override. */
export async function applyDefaultInitScripts(
  context: BrowserContext,
  opts: { locale?: 'en' | 'te'; theme?: 'light' | 'dark' } = {},
): Promise<void> {
  await suppressLaunchSplash(context);
  await pinLocale(context, opts.locale ?? 'en');
  await pinTheme(context, opts.theme ?? 'light');
}
