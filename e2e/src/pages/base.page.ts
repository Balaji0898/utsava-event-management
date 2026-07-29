import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { Dialogs } from '@fixtures/dialogs';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { revalidateSecret } from '@config/env';
import { messages } from '@data/test-data';

/**
 * Root of the page-object hierarchy.
 *
 * Conventions (mirroring the sibling Playright suite):
 *  - locators are exposed as GETTERS returning `Locator`, never as fields, so they
 *    are resolved lazily at use time and survive re-renders;
 *  - every method carries an explicit return type;
 *  - assertions live here as composites (`expectHeading`, `expectVisible`) so
 *    specs read as behaviour rather than as selector plumbing;
 *  - the JSDoc on each class documents the app quirks that shaped it.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Route this page object represents, e.g. `/vendors`. */
  abstract get path(): string;

  private dialogHandler: Dialogs | null = null;

  /**
   * Native `confirm()`/`prompt()` handling bound to THIS page.
   *
   * Deliberately owned by the page object rather than supplied by a fixture. A
   * fixture cannot know which page it is for, and the admin specs run against
   * `adminPage` — a different `Page` in a different `BrowserContext` from the
   * default `page`. A `Dialogs` built on the wrong one registers its listener
   * where the dialog never fires, Playwright then auto-dismisses the real
   * `confirm()`, and `remove()` in the admin UI silently returns without
   * deleting anything. That is exactly how ADMDEPT-P-04 failed, and how
   * ADMDEPT-N-02 passed for the wrong reason — its expected dismiss coincided
   * with the accidental one.
   *
   * Bound to `this.page` by construction, so it cannot be wired to the wrong one.
   */
  get dialogs(): Dialogs {
    this.dialogHandler ??= new Dialogs(this.page);
    return this.dialogHandler;
  }

  // ---------------------------------------------------------------- navigation

  /**
   * Navigate here and wait for the DOM.
   *
   * `waitUntil: 'domcontentloaded'` rather than `'networkidle'` on purpose: the
   * `(site)` layout runs a permanent Lenis `requestAnimationFrame` loop and every
   * page mounts either a WebGL `useFrame` loop or the BrandLoader's 1800ms message
   * interval — the network may idle but the page never does, so `networkidle` is
   * either a no-op or a needless 500ms wait.
   */
  async open(query: Record<string, string> = {}): Promise<Response | null> {
    const qs = new URLSearchParams(query).toString();
    return this.page.goto(`${this.path}${qs ? `?${qs}` : ''}`, { waitUntil: 'domcontentloaded' });
  }

  async openRaw(url: string): Promise<Response | null> {
    return this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  get url(): string {
    return this.page.url();
  }

  async expectOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${this.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?|/|$)`));
  }

  /**
   * Assert the current URL against an arbitrary pattern.
   *
   * Exists so specs can check where a navigation landed without reaching into the page
   * object's `page` — which stays protected on purpose, to keep selector logic inside the
   * page objects where it belongs.
   */
  async expectUrlMatches(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  /** Wait for a fixed period. Only for asserting that something does NOT happen over time. */
  async waitFor(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  // ------------------------------------------------------------------- helpers

  protected testId(id: string): Locator {
    return this.page.getByTestId(id);
  }

  get heading(): Locator {
    return this.page.getByRole('heading').first();
  }

  async expectHeading(name: string | RegExp, level?: 1 | 2 | 3): Promise<void> {
    await expect(this.page.getByRole('heading', { name, level })).toBeVisible();
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  link(name: string | RegExp): Locator {
    return this.page.getByRole('link', { name });
  }

  /**
   * `BackButton` appears above the h1 on most public pages with a per-page label
   * ("Back to home", "Back to work", "Back"). It calls `router.back()` when there
   * is history and falls back to a fixed href otherwise.
   */
  get backButton(): Locator {
    return this.testId(tid.common.backButton);
  }

  // --------------------------------------------------------- loading & caching

  /**
   * Wait for every route-level loading state to clear.
   *
   * `(site)/loading.tsx` and the four route-level skeleton shells render
   * `role="status"` nodes containing an `.sr-only` "Loading…", and `BrandLoader`
   * rotates four messages on a 1800ms interval. Waiting for the status region to
   * detach is more reliable than waiting for content, because `serverApi()`
   * swallows failures and renders an EMPTY page rather than erroring — so
   * "content appeared" and "the request failed" look identical.
   */
  async waitForLoadingToFinish(): Promise<void> {
    const loader = this.page.getByRole('status').filter({ hasText: messages.loading.srOnly });
    await loader.first().waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {
      /* never appeared — the page was already rendered */
    });
  }

  /**
   * Bust Next's data cache, then reload.
   *
   * Public pages read through `unstable_cache` with `revalidate: 300` even when the
   * route is `force-dynamic`. Admin writes DO fire `POST /api/revalidate`, but
   * fire-and-forget and un-awaited — so a test that writes via the API or the admin
   * UI and then asserts on a public page is racing a cache. Calling revalidate
   * ourselves and awaiting it removes the race.
   *
   * Authenticated with the per-run secret that `scripts/run-e2e.mjs` generates and hands to
   * both the frontend and the tests, so the suite exercises the same authenticated path
   * production uses. (It previously relied on the route falling open when
   * `REVALIDATE_SECRET` was unset — the route now fails closed under NODE_ENV=production,
   * which `next start` sets.) Against an externally-booted stack the secret is empty and the
   * call relies on the route's non-production affordance instead.
   */
  async revalidate(tag: 'departments' | 'vendors' | 'packages' | 'cms' | 'all' = 'all'): Promise<void> {
    const url = revalidateSecret
      ? `${paths.revalidate(tag)}&secret=${encodeURIComponent(revalidateSecret)}`
      : paths.revalidate(tag);

    const res = await this.page.request.post(url);
    if (!res.ok()) {
      throw new Error(
        `POST /api/revalidate?tag=${tag} → ${res.status()}.\n` +
          (res.status() === 503
            ? '  503 = the frontend is in production mode with no REVALIDATE_SECRET, so the route\n' +
              '  correctly refuses. Run via `npm run e2e`, which generates and injects one.'
            : '  401 = the secret did not match. E2E_REVALIDATE_SECRET must equal the value the\n' +
              '  frontend was started with — see scripts/run-e2e.mjs.'),
      );
    }
  }

  /** Bust the cache and reload — the correct way to observe a write on a public page. */
  async reloadFresh(tag: 'departments' | 'vendors' | 'packages' | 'cms' | 'all' = 'all'): Promise<void> {
    await this.revalidate(tag);
    await this.reload();
    await this.waitForLoadingToFinish();
  }

  // -------------------------------------------------------------- browser state

  async localStorageItem(key: string): Promise<string | null> {
    return this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value] as [string, string]);
  }

  async removeLocalStorageItem(key: string): Promise<void> {
    await this.page.evaluate((k) => localStorage.removeItem(k), key);
  }

  /** Read an `window.__*Probe` XSS tripwire. 'safe' means nothing executed. */
  async readXssProbe(name: string): Promise<string | undefined> {
    return this.page.evaluate((n) => (window as unknown as Record<string, string>)[n], name);
  }

  /**
   * Native form validity — used where the app relies on the browser rather than on
   * zod (VendorForm's `required` attributes, the testimonial form's `required`).
   */
  static async isInputValid(input: Locator): Promise<boolean> {
    return input.evaluate((el) => (el as HTMLInputElement).checkValidity());
  }

  /** Screenshot-stability helper: settle layout after scroll/animation. */
  async settle(ms = 250): Promise<void> {
    await this.page.waitForTimeout(ms);
  }
}
