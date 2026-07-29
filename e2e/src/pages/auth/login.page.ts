import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../base.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { storageKeys } from '@fixtures/init-scripts';

/**
 * `/login` — the only page in the `(auth)` route group.
 *
 * Deliberately extends `BasePage`, not `SitePage`: the `(auth)` group has **no
 * layout file**, so there is no navbar, no footer, no WhatsApp FAB and no Lenis
 * smooth scroll here. A spec asserting the navbar on this page is asserting a
 * fiction.
 *
 * Form: react-hook-form + zod
 *   `{ email: z.string().email(), password: z.string().min(1, 'Password required') }`
 * Both inputs get a DOM `name` from `register()`, so `input[name="email"]` works even
 * without a testid — but the labels are SIBLINGS with no `htmlFor`, so `getByLabel`
 * does not, which is why the Phase 3 pass adds the association.
 *
 * Post-login routing is role-based and happens client-side:
 *   role ∈ {ADMIN, SUPER_ADMIN} → `/admin`;  anything else → `/`.
 * There is no vendor or customer portal, so a CUSTOMER login lands on the public
 * home page with no visible signed-in state anywhere.
 *
 * `POST /auth/login` is throttled to **10/min per IP**. This page object is used by
 * `global.setup.ts` exactly once per run to mint a `storageState`; specs that log in
 * repeatedly must be `@serial` and use per-worker IP partitioning.
 *
 * A `Hero3D` WebGL canvas floats above the card, which is why the config passes
 * SwiftShader flags — without them the canvas retries acquiring a context forever.
 */
export class LoginPage extends BasePage {
  get path(): string {
    return paths.login;
  }

  get form(): Locator {
    return this.testId(tid.login.form);
  }

  get emailInput(): Locator {
    return this.testId(tid.login.email);
  }

  get passwordInput(): Locator {
    return this.testId(tid.login.password);
  }

  get submitButton(): Locator {
    return this.testId(tid.login.submit);
  }

  /** The single server-side error node — carries the backend `message` verbatim. */
  get errorMessage(): Locator {
    return this.testId(tid.login.error);
  }

  /**
   * zod's per-field errors.
   *
   * Selected by their stable `id` (`login-email-error`, `login-password-error`), NOT by
   * colour class. These were `p.text-red-500`, which silently matched nothing the moment
   * the WCAG contrast work changed those paragraphs to `text-red-600 dark:text-red-400` —
   * a restyle should never be able to break a test's ability to find an element. The
   * form-level error carries no id, so it is correctly excluded here.
   */
  get emailFieldError(): Locator {
    return this.form.locator('p[id$="-error"]').first();
  }

  get fieldErrors(): Locator {
    return this.form.locator('p[id$="-error"]');
  }

  /**
   * SECURITY_AUDIT.md C-2: the page prints `Demo: admin@elite.events / Admin@123`.
   * Phase 3 deletes it; `LOGIN-S-04` asserts it is gone, so this locator exists to
   * be asserted ABSENT.
   */
  get demoCredentialHint(): Locator {
    return this.page.getByText(messages.login.staleDemoHint);
  }

  async fill(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /** Fill and submit without waiting for an outcome — for negative cases. */
  async attemptLogin(email: string, password: string): Promise<void> {
    await this.fill(email, password);
    await this.submit();
  }

  /**
   * Log in and wait for the admin dashboard.
   *
   * Waits on the URL and on rendered content, never on a status code: the admin gate
   * is client-side, so `/admin` answers 200 with a spinner before it decides.
   */
  async login(email: string, password: string): Promise<void> {
    await this.attemptLogin(email, password);
    await this.page.waitForURL(/\/admin$/, { timeout: 30_000 });
    await expect(this.page.getByRole('heading', { name: messages.admin.headerTitle })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByText(messages.session.adminLoading)).toBeHidden();
  }

  /** A non-admin role lands on `/` — the app has no portal for VENDOR or CUSTOMER. */
  async loginAsNonAdmin(email: string, password: string): Promise<void> {
    await this.attemptLogin(email, password);
    await this.page.waitForURL(new RegExp(`${this.page.url().split('/login')[0]}/?$`), { timeout: 30_000 });
  }

  // ------------------------------------------------------------------ assertions

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.login.heading, 1);
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toHaveText(messages.login.submit);
  }

  async expectError(text: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(text);
  }

  async expectFieldError(text: string | RegExp): Promise<void> {
    await expect(this.fieldErrors.filter({ hasText: text })).toBeVisible();
  }

  /** The button is disabled and relabelled while `isSubmitting`. */
  async expectSubmitting(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
    await expect(this.submitButton).toContainText(messages.login.submitting);
  }

  async expectStillOnLogin(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${paths.login}$`));
  }

  /** No credential may ever reach the query string. */
  async expectNoCredentialsInUrl(password: string): Promise<void> {
    expect(this.page.url()).not.toContain(password);
    expect(this.page.url()).not.toContain(encodeURIComponent(password));
  }

  get passwordFieldType(): Promise<string | null> {
    return this.passwordInput.getAttribute('type');
  }

  // ------------------------------------------------------------ session state

  /** All three auth keys, read straight out of localStorage. */
  async readSession(): Promise<{ accessToken: string | null; refreshToken: string | null; user: string | null }> {
    return {
      accessToken: await this.localStorageItem(storageKeys.accessToken),
      refreshToken: await this.localStorageItem(storageKeys.refreshToken),
      user: await this.localStorageItem(storageKeys.user),
    };
  }

  async expectSessionStored(): Promise<void> {
    const session = await this.readSession();
    expect(session.accessToken, 'accessToken must be persisted').toBeTruthy();
    expect(session.refreshToken, 'refreshToken must be persisted').toBeTruthy();
    expect(session.user, 'user must be persisted').toBeTruthy();
  }

  async expectSessionCleared(): Promise<void> {
    const session = await this.readSession();
    expect(session.accessToken).toBeNull();
    expect(session.refreshToken).toBeNull();
    expect(session.user).toBeNull();
  }
}
