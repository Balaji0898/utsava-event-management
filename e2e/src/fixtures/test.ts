import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

import { ApiClient } from './api-client';
import { Dialogs } from './dialogs';
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
  /** Native confirm/prompt handling. */
  dialogs: Dialogs;
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

  api: async ({ playwright }, use, testInfo) => {
    test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing — see e2e/.env.example');

    const ctx = await playwright.request.newContext({ baseURL: urls.api });
    const client = new ApiClient(ctx, testInfo.workerIndex);
    await client.login(admin.email, admin.password);
    await use(client);
    await ctx.dispose();
  },

  anonApi: async ({ playwright }, use, testInfo) => {
    const ctx = await playwright.request.newContext({ baseURL: urls.api });
    await use(new ApiClient(ctx, testInfo.workerIndex, null));
    await ctx.dispose();
  },

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

  dialogs: async ({ page }, use) => {
    const dialogs = new Dialogs(page);
    await use(dialogs);
    dialogs.dispose();
  },

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
