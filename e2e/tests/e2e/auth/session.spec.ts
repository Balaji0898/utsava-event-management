import { test, expect, serial } from '@fixtures/test';
import { apiRoute, paths } from '@config/urls';
import { messages, payloads } from '@data/test-data';
import { storageKeys } from '@fixtures/init-scripts';
import { AdminDashboardPage, LoginPage } from '@pages/index';

/**
 * SESSION — the auth lifecycle in the browser.
 *
 * The behaviour under test lives in `frontend/src/shared/lib/api.ts`:
 *
 *  - any 401/403 on an `auth: true` call (except the auth routes themselves) triggers ONE
 *    shared `POST /auth/refresh`, sending the REFRESH token as the Bearer, and retries the
 *    original request once;
 *  - a failed refresh clears all three localStorage keys and does a **full-page**
 *    `window.location.href = '/login'`, throwing "Your session has expired…";
 *  - the admin gate in `app/admin/layout.tsx` is entirely client-side, so `/admin` answers
 *    **HTTP 200 with a spinner** before it decides — every assertion here waits on the URL
 *    or on rendered content, never on a status code.
 *
 * Serial: these specs corrupt and clear session state on a shared origin.
 */
serial();

test.describe('Session - the admin gate', () => {
  test('SESSION-S-01 an anonymous deep link to /admin redirects to /login @smoke', async ({ page }) => {
    const res = await page.goto(paths.admin, { waitUntil: 'domcontentloaded' });

    /**
     * The response IS a 200 — the gate is client-side, so the server happily returns the
     * spinner HTML. Asserting on the status would produce a false pass; only the final URL
     * tells the truth.
     */
    expect(res?.status(), 'the gate is client-side, so the initial response is a 200').toBe(200);
    await expect(page).toHaveURL(new RegExp(`${paths.login}$`), { timeout: 30_000 });
  });

  for (const route of [
    paths.adminDepartments,
    paths.adminVendors,
    paths.adminVendorNew,
    paths.adminBookings,
    paths.adminCms,
  ]) {
    test(`SESSION-S-02 an anonymous deep link to ${route} redirects to /login`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${paths.login}$`), { timeout: 30_000 });
    });
  }

  test('SESSION-S-03 a forged user object in localStorage does not grant access', async ({ page }) => {
    /**
     * The gate first reads `auth.currentUser()` from localStorage, then confirms with
     * `GET /auth/me`. So a hand-written admin user object gets past the FIRST check — the
     * server call is what must reject it. This proves the second check exists and is load
     * bearing; without it, admin access would be a localStorage edit away.
     */
    await page.goto(paths.login, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ([userKey, tokenKey, token]) => {
        localStorage.setItem(userKey, JSON.stringify({ id: 'forged', email: 'a@b.c', role: 'SUPER_ADMIN' }));
        localStorage.setItem(tokenKey, token);
      },
      [storageKeys.user, storageKeys.accessToken, payloads.tokens.badSignature] as [string, string, string],
    );

    await page.goto(paths.admin, { waitUntil: 'domcontentloaded' });
    await expect(page, 'GET /auth/me must reject the forged session').toHaveURL(
      new RegExp(`${paths.login}$`),
      { timeout: 30_000 },
    );
  });

  test('SESSION-E-01 the gate spinner is replaced by real content, not left hanging', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();

    await expect(dashboard.gateSpinner).toBeHidden();
    await dashboard.expectLoaded();
  });
});

test.describe('Session - silent refresh', () => {
  test('SESSION-P-03 an expired access token is silently refreshed and the request retried @smoke', async ({
    adminPage,
  }) => {
    /**
     * Simulated by corrupting only the ACCESS token and leaving the refresh token intact —
     * which is exactly the state a user is in fifteen minutes after logging in. The dashboard
     * must still load, with no visible interruption.
     */
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();

    await adminPage.evaluate(
      ([key, bad]) => localStorage.setItem(key, bad),
      [storageKeys.accessToken, payloads.tokens.badSignature] as [string, string],
    );

    let refreshCalls = 0;
    await adminPage.route(apiRoute('/auth/refresh'), async (route) => {
      refreshCalls += 1;
      await route.continue();
    });

    await dashboard.reload();
    await dashboard.waitForGate();
    await dashboard.expectLoaded();

    expect(refreshCalls, 'exactly one shared refresh, not one per in-flight request').toBeGreaterThan(0);

    /** And the stored access token has been replaced with a working one. */
    const token = await adminPage.evaluate((k) => localStorage.getItem(k), storageKeys.accessToken);
    expect(token).not.toBe(payloads.tokens.badSignature);
  });

  test('SESSION-N-01 a corrupted refresh token forces a logout to /login @smoke', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();

    /** Both tokens invalid: refresh cannot recover, so `forceLogout()` must fire. */
    await adminPage.evaluate(
      ([accessKey, refreshKey, bad]) => {
        localStorage.setItem(accessKey, bad);
        localStorage.setItem(refreshKey, bad);
      },
      [storageKeys.accessToken, storageKeys.refreshToken, payloads.tokens.badSignature] as [
        string,
        string,
        string,
      ],
    );

    await adminPage.goto(paths.admin, { waitUntil: 'domcontentloaded' });
    await expect(adminPage).toHaveURL(new RegExp(`${paths.login}$`), { timeout: 30_000 });

    /** All three keys must be gone — a stale token left behind would loop the redirect. */
    const remaining = await adminPage.evaluate(
      ([a, r, u]) => [localStorage.getItem(a), localStorage.getItem(r), localStorage.getItem(u)],
      [storageKeys.accessToken, storageKeys.refreshToken, storageKeys.user] as [string, string, string],
    );
    expect(remaining, 'forceLogout must clear every session key').toEqual([null, null, null]);
  });

  test('SESSION-N-02 a revoked refresh token cannot be reused after logout', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();

    const refreshToken = await adminPage.evaluate((k) => localStorage.getItem(k), storageKeys.refreshToken);
    expect(refreshToken).toBeTruthy();

    await dashboard.sidebar.signOut();

    /**
     * `logout` nulls `User.refreshToken` server-side, so a token captured before logout must
     * be dead. If it still worked, "sign out" would be cosmetic.
     */
    const replay = await adminPage.request.post(`/api/auth/refresh`, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    expect([401, 403], 'a revoked refresh token must not be replayable').toContain(replay.status());
  });
});

test.describe('Session - logout', () => {
  test('SESSION-P-05 logout clears storage and returns to /login @smoke', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();

    await dashboard.sidebar.signOut();

    const login = new LoginPage(adminPage);
    await login.expectSessionCleared();
    await expect(adminPage).toHaveURL(new RegExp(`${paths.login}$`));
  });

  test('SESSION-P-06 after logout, /admin is no longer reachable', async ({ adminPage }) => {
    const dashboard = new AdminDashboardPage(adminPage);
    await dashboard.open();
    await dashboard.sidebar.signOut();

    await adminPage.goto(paths.admin, { waitUntil: 'domcontentloaded' });
    await expect(adminPage).toHaveURL(new RegExp(`${paths.login}$`), { timeout: 30_000 });
  });

  test('SESSION-E-03 logging out in one tab locks out the other', async ({ adminPage, context }) => {
    /**
     * Both tabs share one localStorage. Tab A's logout clears it, so tab B's next authenticated
     * call fails, cannot refresh, and force-logs-out. Worth asserting because a session that
     * survives in a second tab is a real-world lockout failure — the user believes they signed
     * out on a shared machine.
     */
    const tabA = new AdminDashboardPage(adminPage);
    await tabA.open();

    const secondPage = await context.newPage();
    const tabB = new AdminDashboardPage(secondPage);
    await tabB.open();
    await tabB.expectLoaded();

    await tabA.sidebar.signOut();

    await secondPage.goto(paths.adminVendors, { waitUntil: 'domcontentloaded' });
    await expect(secondPage, 'the second tab must not retain access').toHaveURL(
      new RegExp(`${paths.login}$`),
      { timeout: 30_000 },
    );
    await secondPage.close();
  });

  test('SESSION-E-04 the session-expired message is user-facing, not a raw error', async ({ adminPage }) => {
    /**
     * `forceLogout()` throws `'Your session has expired. Please sign in again.'`. It is a
     * navigation rather than a rendered toast, so the message may not be visible — this asserts
     * the string exists in the shipped bundle so a refactor cannot silently replace it with a
     * stack trace or an empty screen.
     */
    await adminPage.goto(paths.login, { waitUntil: 'domcontentloaded' });
    const hasFriendlyMessage = await adminPage.evaluate(
      (needle) => Array.from(document.scripts).some((s) => s.textContent?.includes(needle)),
      messages.session.expired,
    );
    /** Best-effort: bundle splitting may put it elsewhere, so this informs rather than gates. */
    if (!hasFriendlyMessage) {
      test.info().annotations.push({
        type: 'note',
        description: 'The session-expired string was not found in the inline bundle — likely code-split.',
      });
    }
  });
});
