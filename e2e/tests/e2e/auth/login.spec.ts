import { test, expect, serial } from '@fixtures/test';
import { admin, hasAdminCredentials } from '@config/env';
import { emails, messages, passwords } from '@data/test-data';
import { paths } from '@config/urls';

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

  test('LOGIN-P-03 disables the button and relabels it while submitting', async ({ loginPage }) => {
    test.skip(!hasAdminCredentials(), 'admin credentials missing');

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

  test('LOGIN-N-03 rejects a malformed email client-side, before any request', async ({ loginPage, page }) => {
    let requestMade = false;
    await page.route('**/api/auth/login', async (route) => {
      requestMade = true;
      await route.continue();
    });

    await loginPage.attemptLogin('not-an-email', passwords.strong);
    await loginPage.expectFieldError(messages.login.invalidEmail);

    expect(requestMade, 'zod must reject before the network call, saving a throttle slot').toBe(false);
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

  test('LOGIN-N-08 repeated failures are eventually rate-limited', async ({ loginPage }) => {
    /**
     * The UI half of SEC-22. The browser shares one IP bucket with no `X-Forwarded-For`
     * partitioning, so the 10/min limit applies — and the user sees the raw backend throttle
     * message in the error node rather than anything friendly. Worth knowing.
     */
    let sawThrottle = false;
    for (let i = 0; i < 12; i += 1) {
      await loginPage.open();
      await loginPage.attemptLogin(admin.email, passwords.wrong);
      await loginPage.errorMessage.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);

      const text = (await loginPage.errorMessage.textContent()) ?? '';
      if (/too many|throttl|rate/i.test(text)) {
        sawThrottle = true;
        break;
      }
    }

    expect(
      sawThrottle,
      'Brute-force protection must surface in the UI too — twelve failed logins produced no ' +
        'throttle message, so every admin password is guessable at network speed.',
    ).toBe(true);
  });
});
