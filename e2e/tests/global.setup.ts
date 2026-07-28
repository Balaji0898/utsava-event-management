import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { admin, hasAdminCredentials, revalidateSecret, urls } from '@config/env';
import { apiPaths, paths } from '@config/urls';
import { messages } from '@data/test-data';
import { seedTotals } from '@data/seed-data';
import { LoginPage } from '@pages/index';
import { applyDefaultInitScripts, storageKeys } from '@fixtures/init-scripts';
import { mockThirdParties } from '@fixtures/network';

const ADMIN_STATE = path.resolve(__dirname, '../playwright/.auth/admin.json');

/**
 * The `setup` project. Every other project depends on it, so a failure here stops the
 * run instead of producing 400 confusing downstream failures.
 */

/**
 * Health gate.
 *
 * This exists because of one specific trap: `serverApi()` in
 * `frontend/src/shared/lib/api.ts` swallows EVERY error and returns null. So a dead or
 * unseeded backend renders "0 vendors available" + "No vendors found." — an empty
 * state that passes most assertions. Without this gate a broken stack produces a
 * green-ish run with a handful of mysterious failures; with it, the run fails once,
 * here, with a message that says what is wrong.
 */
setup('api and site are up and seeded', async ({ request }) => {
  const departments = await request.get(`${urls.api}${'/api'}${apiPaths.departments.list}`);
  expect(departments.ok(), `GET ${urls.api}/api/departments must return 200 — is the backend up?`).toBeTruthy();

  const depts = (await departments.json()) as unknown[];
  expect(
    Array.isArray(depts) && depts.length >= seedTotals.departmentsAtLeast,
    `Expected at least ${seedTotals.departmentsAtLeast} seeded departments, got ${
      Array.isArray(depts) ? depts.length : 'a non-array'
    }. Did \`prisma migrate reset\` + seed run?`,
  ).toBeTruthy();

  const vendors = await request.get(`${urls.api}/api${apiPaths.vendors.list}?limit=1`);
  expect(vendors.ok(), 'GET /api/vendors must return 200').toBeTruthy();
  const { total } = (await vendors.json()) as { total: number };
  expect(total, 'seeded vendors must exist, or every listing spec will assert an empty page').toBeGreaterThan(0);

  const site = await request.get(urls.base);
  expect(site.status(), `GET ${urls.base} must return 200 — is the frontend up?`).toBe(200);

  /**
   * Blocker E1 guard. A stale `next dev` webpack chunk once made every
   * /vendors/[slug] return HTTP 500 while /vendors stayed 200. Catch that at setup
   * rather than as 27 vendor-detail failures.
   */
  const listing = await request.get(`${urls.base}${paths.vendors}`);
  expect(
    listing.status(),
    `GET ${urls.base}/vendors must return 200. A 500 here usually means a stale .next build — ` +
      'the suite must run against `next build && next start`, never a long-lived `next dev`.',
  ).toBe(200);
});

/**
 * Cache-busting availability.
 *
 * Several journeys write via the admin API and then assert on a public page that reads
 * through `unstable_cache` with `revalidate: 300`. They bust it by POSTing
 * `/api/revalidate`, which is open only while `REVALIDATE_SECRET` is unset — which is
 * what `scripts/stack.mjs` arranges. Assert it here so the failure mode is one clear
 * message rather than a scatter of stale reads.
 */
setup('cache revalidation is reachable', async ({ request }) => {
  const url = revalidateSecret
    ? `${urls.base}${paths.revalidate('all')}&secret=${encodeURIComponent(revalidateSecret)}`
    : `${urls.base}${paths.revalidate('all')}`;

  const res = await request.post(url);
  expect(
    res.ok(),
    `POST /api/revalidate → ${res.status()}.\n` +
      (res.status() === 503
        ? '  503 = the frontend is in production mode with no REVALIDATE_SECRET. `npm run e2e`\n' +
          '  generates one and injects it into both the frontend and the tests; a stack booted by\n' +
          '  hand needs E2E_REVALIDATE_SECRET set to the same value.'
        : res.status() === 401
          ? '  401 = the secret did not match the value the frontend was started with.'
          : '  Cache-busting is unavailable, so admin-writes-then-public-read journeys would\n' +
            '  silently assert against stale data.'),
  ).toBeTruthy();
});

/**
 * Mint the admin `storageState`.
 *
 * ONE real UI login per run. Doing it through the UI rather than the API is deliberate:
 * it exercises the login path once and captures everything the app writes
 * (accessToken, refreshToken, user, locale, theme) without the suite having to know
 * the shape. And because auth is 100% localStorage with zero cookies, storageState
 * round-trips it cleanly.
 *
 * One login also keeps the whole suite comfortably under the `POST /auth/login`
 * 10/min-per-IP throttle.
 */
/**
 * Scoped to a `describe`, NOT to the module.
 *
 * A module-scope `setup.skip()` would skip every test in this file — including the health gate
 * above, which must run unconditionally. It is the thing that stops a dead or unseeded stack from
 * masquerading as a green run.
 *
 * It also cannot go inside the test body: `setup.skip(cond)` there is evaluated only after every
 * fixture has resolved, and resolving `browser` launches one — so a missing credential would cost a
 * browser launch and then fail on it rather than skipping cleanly.
 */
setup.describe('admin session', () => {
  setup.skip(
    !hasAdminCredentials(),
    'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing (password must be >= 8 chars) — see e2e/.env.example',
  );

  setup('authenticate as admin', async ({ browser }) => {
    const context = await browser.newContext();
    await applyDefaultInitScripts(context);
    await mockThirdParties(context);
    const page = await context.newPage();

    const loginPage = new LoginPage(page);
    await loginPage.open();
    await loginPage.expectLoaded();
    await loginPage.attemptLogin(admin.email, admin.password);

    /**
     * Wait on the URL and on rendered content, never on a status code: the admin gate in
     * `app/admin/layout.tsx` is client-side, so `/admin` answers 200 with a
     * "Loading Utsava dashboard…" spinner and only then decides.
     */
    await page.waitForURL(/\/admin$/, { timeout: 45_000 });
    await expect(page.getByText(messages.session.adminLoading)).toBeHidden({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: messages.admin.headerTitle })).toBeVisible();

    const token = await page.evaluate((k) => localStorage.getItem(k), storageKeys.accessToken);
    expect(token, 'login must persist an accessToken to localStorage').toBeTruthy();

    fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
    await context.storageState({ path: ADMIN_STATE });
    await context.close();
  });
});
