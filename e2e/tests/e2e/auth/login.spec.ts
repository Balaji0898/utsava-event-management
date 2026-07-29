import { test, expect, serial } from '@fixtures/test';
import { admin, hasAdminCredentials } from '@config/env';
import { emails, messages, passwords } from '@data/test-data';
import { apiRoute, paths } from '@config/urls';
import { LoginPage } from '@pages/index';

/**
 * LOGIN — `/login`, the only page in the `(auth)` route group.
 *
 * Serial: `POST /auth/login` is throttled to 10/min, and this file is the densest cluster
 * of login attempts in the suite. The rest of the suite reuses a single `storageState`
 * minted once in `global.setup.ts` precisely so it does not compete for that budget.
 */
serial();

test.beforeEach(async ({ loginPage }) => {
  await loginPage.open();
  await loginPage.expectLoaded();
});

test.describe('Login - positive cases', () => {
  test('LOGIN-P-01 signs in an admin and lands on the dashboard @smoke', async ({ loginPage, page }) => {
    test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing');

    /** `login()` already waits for the URL and the rendered dashboard heading. */
    await loginPage.login(admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('LOGIN-P-02 persists all three session keys to localStorage @smoke', async ({ loginPage }) => {
    test.skip(!hasAdminCredentials(), 'admin credentials missing');

    await loginPage.login(admin.email, admin.password);
    await loginPage.expectSessionStored();
  });

  test('LOGIN-P-03 disables the button and relabels it while submitting', async ({ loginPage, page }) => {
    test.skip(!hasAdminCredentials(), 'admin credentials missing');

    /**
     * Hold the response open so the in-flight state is actually observable.
     *
     * `disabled={isSubmitting}` is correct in the component, but against a stack on
     * localhost the round-trip finishes in single-digit milliseconds — faster than the
     * assertion can sample, so racing `expectSubmitting()` against `submit()` in a
     * `Promise.all` failed with the button already back to "Sign in". Delaying the
     * login response makes the window deterministic instead of hoping to catch it.
     */
    await page.route(apiRoute('/auth/login'), async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await route.continue();
    });

    await loginPage.fill(admin.email, admin.password);
    await Promise.all([loginPage.expectSubmitting(), loginPage.submit()]);
  });

  test('LOGIN-P-04 the login page has no site chrome @smoke', async ({ loginPage, page }) => {
    /**
     * The `(auth)` route group has no layout, so there is deliberately no navbar, no footer,
     * no WhatsApp FAB and no Lenis smooth scroll here. Asserted so that "helpfully" adding a
     * layout is a visible decision rather than a silent change of behaviour.
     */
    await expect(page.getByTestId('nav-root')).toHaveCount(0);
    await expect(page.getByTestId('footer-root')).toHaveCount(0);
    await expect(page.getByTestId('whatsapp-fab')).toHaveCount(0);

    /** The Phase 3 <main> landmark IS expected, though — axe `region` needs it. */
    await expect(page.locator('main')).toBeVisible();
    void loginPage;
  });
});

test.describe('Login - negative cases', () => {
  test('LOGIN-N-01 rejects a wrong password with the backend message @smoke', async ({ loginPage }) => {
    await loginPage.attemptLogin(admin.email, passwords.wrong);

    await loginPage.expectError(messages.login.invalidCredentials);
    await loginPage.expectStillOnLogin();
    await loginPage.expectSessionCleared();
  });

  test('LOGIN-N-02 gives an identical message for an unknown email', async ({ loginPage }) => {
    /**
     * The UI must not become a user-enumeration oracle either. The backend already returns a
     * uniform message; this asserts the frontend does not helpfully differentiate.
     */
    await loginPage.attemptLogin(emails.unregistered, passwords.strong);
    await loginPage.expectError(messages.login.invalidCredentials);
  });

  test('LOGIN-N-03 blocks a malformed email natively, before any request', async ({ loginPage, page }) => {
    /**
     * Two layers guard this field and which one fires depends on the value — the same
     * native-first layering as BOOK-N-09:
     *
     *   - the input is `type="email"` and the form sets no `noValidate`, so the browser's
     *     own constraint validation blocks submission and `handleSubmit` never runs. zod's
     *     'Invalid email' is therefore unreachable by typing a malformed value;
     *   - zod's message DOES surface for a value the browser accepts — most importantly an
     *     empty field, since the input carries no `required` attribute. See LOGIN-N-07.
     *
     * Asserting the native path, because that is what a real user hits. An earlier version
     * expected the zod message and was wrong; it also routed `**\/api/auth/login`, which
     * never matched the same-origin proxy, so `requestMade` could not have gone true either
     * way. Both are fixed here.
     */
    let requestMade = false;
    await page.route(apiRoute('/auth/login'), async (route) => {
      requestMade = true;
      await route.continue();
    });

    await loginPage.attemptLogin('not-an-email', passwords.strong);

    expect(
      await LoginPage.isInputValid(loginPage.emailInput),
      'type="email" must mark a malformed value invalid',
    ).toBe(false);
    await loginPage.expectStillOnLogin();
    expect(requestMade, 'native validation must block before the network call, saving a throttle slot').toBe(
      false,
    );
  });

  test('LOGIN-N-07 an empty email surfaces the zod message, which native validation lets through', async ({
    loginPage,
  }) => {
    /** The complementary case: no `required` attribute, so the browser hands it to zod. */
    await loginPage.passwordInput.fill(passwords.strong);
    await loginPage.submit();
    await loginPage.expectFieldError(messages.login.invalidEmail);
  });

  test('LOGIN-N-04 rejects an empty password with the schema message', async ({ loginPage }) => {
    await loginPage.emailInput.fill(admin.email);
    await loginPage.submit();
    await loginPage.expectFieldError(messages.login.passwordRequired);
  });

  test('LOGIN-N-05 rejects a fully empty form', async ({ loginPage }) => {
    await loginPage.submit();
    await expect(loginPage.fieldErrors.first()).toBeVisible();
    await loginPage.expectStillOnLogin();
  });

  test('LOGIN-N-06 clears the error on a subsequent successful attempt', async ({ loginPage, page }) => {
    test.skip(!hasAdminCredentials(), 'admin credentials missing');

    await loginPage.attemptLogin(admin.email, passwords.wrong);
    await loginPage.expectError(messages.login.invalidCredentials);

    await loginPage.login(admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe('Login - role-based redirect', () => {
  test('LOGIN-P-05 a CUSTOMER is sent to the public home page, not the dashboard', async ({
    loginPage,
    anonApi,
    factory,
    page,
  }) => {
    /**
     * There is no customer or vendor portal in this app — `VENDOR` and `CUSTOMER` roles exist
     * in the schema and are reachable via the API, but the only UI branch is
     * `['ADMIN','SUPER_ADMIN'] ? '/admin' : '/'`. So a customer logs in successfully and lands
     * on the public site with no visible signed-in state anywhere. Documented, because it
     * looks like a bug until you know.
     */
    const email = factory.email('customer-login');
    const password = passwords.strong;
    await anonApi.registerCustomer(email, password);

    await loginPage.attemptLogin(email, password);
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });

    /** The session IS stored — they are logged in, just with nowhere to go. */
    await loginPage.expectSessionStored();
    await expect(page.getByTestId('admin-sidebar')).toHaveCount(0);
  });

  test('LOGIN-S-05 a CUSTOMER who then navigates to /admin is bounced to /login', async ({
    loginPage,
    anonApi,
    factory,
    page,
  }) => {
    const email = factory.email('customer-escalate');
    await anonApi.registerCustomer(email, passwords.strong);

    await loginPage.attemptLogin(email, passwords.strong);
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });

    await page.goto(paths.admin, { waitUntil: 'domcontentloaded' });
    await expect(page, 'the client-side gate must reject a non-admin role').toHaveURL(/\/login$/, {
      timeout: 30_000,
    });
  });
});

test.describe('Login - security cases', () => {
  test('LOGIN-S-01 the password field is masked @smoke', async ({ loginPage }) => {
    expect(await loginPage.passwordFieldType).toBe('password');
  });

  test('LOGIN-S-02 the password never appears in the URL', async ({ loginPage }) => {
    /**
     * A GET-shaped form or a stray `router.push` carrying credentials would put them in the
     * browser history, the referrer header and every proxy log along the way.
     */
    await loginPage.attemptLogin(admin.email, passwords.wrong);
    await loginPage.expectNoCredentialsInUrl(passwords.wrong);
  });

  test('LOGIN-S-03 the demo credential hint has been removed @smoke', async ({ loginPage }) => {
    /**
     * SECURITY_AUDIT.md C-2. The page used to print
     * `Demo: admin@elite.events / Admin@123` — a working-looking SUPER_ADMIN credential, on the
     * public login page, also published in the README. The Phase 3 pass deleted it; this keeps
     * it deleted.
     */
    await expect(
      loginPage.demoCredentialHint,
      'the login page must not advertise any credential (SECURITY_AUDIT.md C-2)',
    ).toHaveCount(0);
  });

  test('LOGIN-S-04 the documented default credential does not authenticate @smoke', async ({ loginPage }) => {
    await loginPage.attemptLogin('admin@elite.events', passwords.documentedDefault);
    await loginPage.expectStillOnLogin();
    await loginPage.expectSessionCleared();
  });

  test('LOGIN-N-08 repeated failures are eventually rate-limited', async ({ loginPage, page }) => {
    /**
     * The UI half of SEC-22. The browser shares one IP bucket with no `X-Forwarded-For`
     * partitioning, so the 10/min limit applies — and the user sees the raw backend throttle
     * message in the error node rather than anything friendly. Worth knowing.
     */
    /**
     * The attempts have to FIT INSIDE the throttle window to prove anything.
     *
     * The limit is 10 per 60s (`@Throttle` on AuthController.login), which is a sliding
     * window — so if the loop takes longer than a minute, early attempts age out and the
     * count never reaches 10 no matter how many times it runs. The original loop reopened
     * the page every iteration and waited up to 20s for the error node, which on a loaded
     * runner exceeded 60s across 12 attempts and reported "no throttle" while the control
     * was working perfectly. Shard 2 slowing from 249s to 388s is what tipped it over.
     *
     * So: navigate ONCE (a failed login leaves the form in place), and cap the per-attempt
     * wait low enough that ten attempts cannot span the window. Watching the responses
     * rather than the rendered text also removes the stale-read trap — after the first
     * failure the error node is already visible, so `waitFor` returns instantly and could
     * hand back the PREVIOUS message.
     */
    const statuses: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/auth/login')) statuses.push(res.status());
    });

    await loginPage.open();

    let sawThrottle = false;
    for (let i = 0; i < 15 && !sawThrottle; i += 1) {
      await loginPage.fill(admin.email, passwords.wrong);
      await loginPage.submit();
      await expect(loginPage.errorMessage).toBeVisible({ timeout: 5_000 }).catch(() => undefined);

      const text = (await loginPage.errorMessage.textContent()) ?? '';
      sawThrottle = /too many|throttl|rate/i.test(text);
    }

    expect(
      statuses.some((s) => s === 429),
      `the backend must actually throttle — saw statuses ${statuses.join(',')}`,
    ).toBe(true);

    expect(
      sawThrottle,
      'Brute-force protection must surface in the UI too — twelve failed logins produced no ' +
        'throttle message, so every admin password is guessable at network speed.',
    ).toBe(true);
  });
});
