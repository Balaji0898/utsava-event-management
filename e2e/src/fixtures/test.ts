import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

import { ApiClient } from './api-client';
import { Axe } from './axe';
import { applyDefaultInitScripts, installXssProbe } from './init-scripts';
import { mockThirdParties, stubRemoteImages } from './network';
import { DataFactory } from '@data/factory';
import { admin, canMutateData, hasAdminCredentials, run, urls } from '@config/env';
import { geolocation } from '@config/third-party';
import {
  AdminBookingsPage,
  AdminCmsPage,
  AdminDashboardPage,
  AdminDepartmentsPage,
  AdminVendorFormPage,
  AdminVendorsListPage,
  BookPage,
  HomePage,
  LegalPage,
  LoginPage,
  PackagesPage,
  TestimonialsPage,
  VendorDetailPage,
  VendorsListPage,
} from '@pages/index';

const ADMIN_STATE = path.resolve(__dirname, '../../playwright/.auth/admin.json');

/**
 * Throttler-bucket octet for one test: 1-254, see `ApiClient.forwardedFor`.
 *
 * Derived from the test id rather than a counter, so it is STABLE across retries —
 * a retry that landed in a fresh bucket would mask a genuine rate-limit failure —
 * while still distinct between tests, which is what stops one spec from spending
 * another's `register` or `login` budget.
 */
function bucketFor(testId: string): number {
  let hash = 0;
  for (const ch of testId) hash = (hash * 31 + ch.charCodeAt(0)) % 254;
  return hash + 1;
}

/**
 * The single import point for every spec.
 *
 *   import { test, expect } from '@fixtures/test';
 *
 * `expect` is re-exported here on purpose, so a spec never imports from
 * `@playwright/test` directly — the same convention as the sibling Playright suite.
 * It keeps every spec on the fixture-aware `test` object and makes an accidental
 * bare-Playwright import obvious in review.
 */

type Fixtures = {
  // --- page objects -----------------------------------------------------------
  homePage: HomePage;
  vendorsPage: VendorsListPage;
  vendorDetailPage: VendorDetailPage;
  packagesPage: PackagesPage;
  bookPage: BookPage;
  testimonialsPage: TestimonialsPage;
  privacyPage: LegalPage;
  termsPage: LegalPage;
  loginPage: LoginPage;

  // --- admin page objects (require `adminPage`) -------------------------------
  dashboardPage: AdminDashboardPage;
  departmentsPage: AdminDepartmentsPage;
  adminVendorsPage: AdminVendorsListPage;
  vendorFormPage: AdminVendorFormPage;
  bookingsPage: AdminBookingsPage;
  cmsPage: AdminCmsPage;

  // --- capabilities ----------------------------------------------------------
  /** An admin-authenticated `Page` in its own context, from the stored storageState. */
  adminPage: Page;
  /** Admin-authenticated API client. */
  api: ApiClient;
  /** Unauthenticated API client — for RBAC and public-endpoint cases. */
  anonApi: ApiClient;
  /** axe-core scanner with the known-violation register applied. */
  axe: Axe;
  /** Prefixed record creation with automatic teardown. */
  factory: DataFactory;
  /** Seed an XSS tripwire on `window` and read it back. */
  xssProbe: (name: string) => Promise<void>;
  /** Grant geolocation and set a position on this context. */
  useGeolocation: (coords?: { latitude: number; longitude: number }) => Promise<void>;
  /** Serve deterministic placeholders instead of aborting remote images. */
  keepRemoteImages: () => Promise<void>;
};

type WorkerFixtures = {
  /**
   * The admin access token, minted once per worker.
   *
   * `POST /auth/login` is throttled to **10/min**, so this is worker-scoped and
   * cached: one login per worker, not one per test.
   */
  adminToken: string;

  /**
   * A CUSTOMER identity, minted once per worker.
   *
   * The RBAC sweep needs a non-admin token to exercise `RolesGuard`'s negative
   * branch — the only way to prove 403 rather than 200, since the app has no
   * customer UI at all. `POST /auth/register` is throttled to **5/min**, so this is
   * worker-scoped and cached: one registration per worker, not one per test.
   */
  customerToken: string;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  // ---------------------------------------------------------------------------
  // context: neutralise every environmental hazard in one place
  // ---------------------------------------------------------------------------

  context: async ({ context }, use) => {
    await applyDefaultInitScripts(context);
    await mockThirdParties(context);
    await use(context);
  },

  // ---------------------------------------------------------------------------
  // page objects — one-liners, so a spec declares what it needs and nothing more
  // ---------------------------------------------------------------------------

  homePage: async ({ page }, use) => use(new HomePage(page)),
  vendorsPage: async ({ page }, use) => use(new VendorsListPage(page)),
  vendorDetailPage: async ({ page }, use) => use(new VendorDetailPage(page)),
  packagesPage: async ({ page }, use) => use(new PackagesPage(page)),
  bookPage: async ({ page }, use) => use(new BookPage(page)),
  testimonialsPage: async ({ page }, use) => use(new TestimonialsPage(page)),
  privacyPage: async ({ page }, use) => use(new LegalPage(page, 'privacy')),
  termsPage: async ({ page }, use) => use(new LegalPage(page, 'terms')),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),

  /**
   * An admin-authenticated page.
   *
   * Loads the `storageState` captured by `global.setup.ts` into a fresh context. Auth
   * is 100% localStorage (zero cookies), so storageState round-trips it perfectly —
   * and reusing it means the whole suite performs exactly ONE login, keeping us well
   * under the `POST /auth/login` 10/min limit.
   */
  adminPage: async ({ browser }, use) => {
    test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing — see e2e/.env.example');

    const context: BrowserContext = await browser.newContext({ storageState: ADMIN_STATE });
    await applyDefaultInitScripts(context);
    await mockThirdParties(context);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  dashboardPage: async ({ adminPage }, use) => use(new AdminDashboardPage(adminPage)),
  departmentsPage: async ({ adminPage }, use) => use(new AdminDepartmentsPage(adminPage)),
  adminVendorsPage: async ({ adminPage }, use) => use(new AdminVendorsListPage(adminPage)),
  vendorFormPage: async ({ adminPage }, use) => use(new AdminVendorFormPage(adminPage)),
  bookingsPage: async ({ adminPage }, use) => use(new AdminBookingsPage(adminPage)),
  cmsPage: async ({ adminPage }, use) => use(new AdminCmsPage(adminPage)),

  // ---------------------------------------------------------------------------
  // API clients
  // ---------------------------------------------------------------------------

  /**
   * Admin-authenticated client, built from the worker-cached `adminToken`.
   *
   * Deliberately does NOT log in per test. `POST /auth/login` is throttled to 10/min
   * and this fixture is the most widely used in the suite, so a login per test blew
   * the budget within seconds and surfaced as a 429 on some unrelated spec —
   * whichever one happened to be running when the bucket emptied. The browser side
   * already avoided this by minting one `storageState` in `global.setup.ts`; this is
   * the same economy for the API side.
   *
   * The context is still per-test, so nothing leaks between tests except the token.
   */
  api: async ({ playwright, adminToken }, use, testInfo) => {
    test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing — see e2e/.env.example');

    const ctx = await playwright.request.newContext({ baseURL: urls.api });
    await use(new ApiClient(ctx, testInfo.workerIndex, adminToken, undefined, bucketFor(testInfo.testId)));
    await ctx.dispose();
  },

  anonApi: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: urls.api });
    await use(new ApiClient(ctx, testInfo.workerIndex, null, undefined, bucketFor(testInfo.testId)));
    await ctx.dispose();
  },

  /**
   * The admin access token, minted ONCE per worker.
   *
   * `POST /auth/login` is throttled to 10/min. Worker-scoped for the same reason
   * `customerToken` is: one credential exchange per worker rather than one per test.
   *
   * Tradeoff: the token carries `JWT_ACCESS_TTL` (900s via scripts/stack.mjs) and
   * `ApiClient` does not re-authenticate on a 401, so a worker whose tests run for
   * more than 15 minutes of wall-clock would start seeing 401s. Observed shard
   * execution is 30-150s, so the headroom is wide — but if that ever changes, raise
   * `E2E_JWT_ACCESS_TTL` rather than reverting to a login per test.
   */
  adminToken: [
    async ({ playwright }, use, workerInfo) => {
      /**
       * Yield empty rather than skipping here: `test.skip()` needs a test context and
       * this is worker-scoped. The `api` fixture that consumes this does the skip,
       * which is where it was before and where it still belongs.
       */
      if (!hasAdminCredentials()) {
        await use('');
        return;
      }

      const ctx = await playwright.request.newContext({ baseURL: urls.api });
      const client = new ApiClient(ctx, workerInfo.workerIndex, null);
      const { accessToken } = await client.login(admin.email, admin.password);
      await use(accessToken);
      await ctx.dispose();
    },
    { scope: 'worker' },
  ],

  customerToken: [
    async ({ playwright }, use, workerInfo) => {
      const ctx = await playwright.request.newContext({ baseURL: urls.api });
      const client = new ApiClient(ctx, workerInfo.workerIndex, null);
      /** Deterministic per worker, so a retried attempt reuses the same account. */
      const email = `e2e-customer-w${workerInfo.workerIndex}-${run.id}@utsava.test`.toLowerCase();
      const password = 'E2eCustomer!2026';

      let token = '';
      try {
        token = (await client.registerCustomer(email, password)).accessToken;
      } catch {
        /**
         * Already registered (a retried attempt, or a reused branch) — `register`
         * returns 403 'Email already registered' in that case, so just log in.
         */
        token = (await client.login(email, password)).accessToken;
      }
      await use(token);
      await ctx.dispose();
    },
    { scope: 'worker' },
  ],

  // ---------------------------------------------------------------------------
  // capabilities
  // ---------------------------------------------------------------------------

  /**
   * REMOVED — use `<pageObject>.dialogs` instead.
   *
   * A fixture cannot know which page it belongs to. This one bound to the default
   * `page`, while every admin spec drives `adminPage` — a different `Page` in a
   * different context. The listener was registered where the dialog never fired,
   * Playwright auto-dismissed the real `confirm()`, and the admin UI's `remove()`
   * returned early without deleting. `BasePage.dialogs` is bound to its own page by
   * construction, so it cannot be wired to the wrong one.
   */

  axe: async ({ page }, use) => use(new Axe(page)),

  /**
   * Per-test data factory.
   *
   * Test-scoped rather than worker-scoped, deliberately: within one run every worker
   * queries the SAME database, so a record surviving its own test would show up in
   * another test's listing assertions. Per-test reverse-order cleanup keeps every
   * list clean; `global.teardown.ts`'s prefix sweep only catches what a hard-killed
   * worker orphaned.
   */
  factory: async ({ api }, use, testInfo) => {
    test.skip(
      !canMutateData(),
      'Refusing to write: E2E_SKIP_DB is set, so the database may not be disposable. ' +
        'Run through `npm run e2e` for an ephemeral Neon branch.',
    );

    /** `E2E-<runId>-w<worker>-t<titleHash>` — see DataFactory's JSDoc for why. */
    const titleHash = Buffer.from(testInfo.titlePath.join('|'))
      .toString('base64url')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6);
    const prefix = `E2E-${run.id}-w${testInfo.workerIndex}-t${titleHash}`;

    const factory = new DataFactory(api, prefix);
    await use(factory);
    await factory.cleanup();
  },

  xssProbe: async ({ context, page }, use) => {
    await use(async (name: string) => {
      await installXssProbe(context, name);
      /** Re-seed on the current document too — init scripts only apply to new ones. */
      await page.evaluate((n) => {
        (window as unknown as Record<string, string>)[n] = 'safe';
      }, name);
    });
  },

  /**
   * Geolocation for the "near me" specs.
   *
   * `frontend/next.config.mjs` sets `Permissions-Policy: geolocation=(self)`, so the
   * API is available to same-origin code — the permission still has to be granted on
   * the context.
   */
  useGeolocation: async ({ context }, use) => {
    await use(async (coords = geolocation) => {
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation(coords);
    });
  },

  /**
   * For the `visual` project: serve a real 1x1 PNG instead of aborting remote images.
   * An aborted `<img>` renders the browser's broken-image glyph, which differs across
   * platforms and would poison every baseline.
   */
  keepRemoteImages: async ({ context }, use) => {
    await use(async () => {
      await stubRemoteImages(context);
    });
  },
});

export { expect };

/**
 * Mark a spec file serial. Use it when a file:
 *   - hits a throttled route (login 10/min, register 5/min, bookings 8/min,
 *     testimonial-submit 5/min), or
 *   - mutates shared state: any CMS singleton (`site-contact`, `home-stats`,
 *     `legal-*`), or a vendor's `featured` flag (which demotes a sibling).
 */
export function serial(): void {
  test.describe.configure({ mode: 'serial' });
}
