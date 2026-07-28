import { expect, type Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { SidebarComponent } from '@components/sidebar.component';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';
import { paths } from '@config/urls';

/**
 * Any page under `/admin`.
 *
 * Two quirks shape everything here:
 *
 *  1. **The auth gate is client-side only.** `app/admin/layout.tsx` reads
 *     `auth.currentUser()` from localStorage, redirects to `/login` when the role
 *     is not ADMIN/SUPER_ADMIN, and otherwise calls `GET /auth/me` to confirm.
 *     Until that resolves it renders a spinner reading "Loading Utsava dashboard…".
 *     So a direct hit on `/admin` while anonymous returns **HTTP 200 with spinner
 *     HTML** and only then redirects — every assertion must wait on the URL or the
 *     rendered content, never on a status code.
 *
 *  2. **There is no mobile navigation.** The Sidebar is `hidden md:flex`, and no
 *     hamburger replaces it, so below 768px admin is unnavigable. The responsive
 *     specs assert that as current behaviour rather than pretending otherwise.
 *
 * Also note `Hero3D` (a @react-three/fiber Canvas with an infinite `useFrame` loop)
 * is mounted in the admin header on EVERY admin page, so admin specs carry a
 * continuous CPU cost. That is why the config passes SwiftShader flags.
 */
export abstract class AdminPage extends BasePage {
  readonly sidebar = new SidebarComponent(this.page);

  /** "Loading Utsava dashboard…" — the client-side gate's pending state. */
  get gateSpinner(): Locator {
    return this.testId(tid.admin.loading);
  }

  get headerTitle(): Locator {
    return this.page.getByRole('heading', { name: messages.admin.headerTitle });
  }

  /**
   * Wait until the client-side gate has resolved and the page content is real.
   *
   * Called by every admin page's `open()`. Without it, assertions run against the
   * spinner and fail with a confusing "expected heading, got nothing".
   */
  async waitForGate(): Promise<void> {
    await expect(this.gateSpinner).toBeHidden({ timeout: 30_000 });
    await this.expectOnPage();
  }

  async open(query: Record<string, string> = {}): Promise<null> {
    await super.open(query);
    await this.waitForGate();
    await this.waitForLoadingToFinish();
    return null;
  }

  /**
   * Assert the gate bounced us to /login.
   *
   * Used by the anonymous-deep-link specs. Note the redirect is a client-side
   * `router.replace`, so the initial response is a 200 and only the final URL tells
   * the truth.
   */
  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${paths.login}$`), { timeout: 30_000 });
  }

  /**
   * Wait for a `Saved ✓` indicator.
   *
   * It is removed by a `setTimeout` after exactly 2000ms, so this must be awaited
   * promptly after the save click — a slow assertion chain in between will miss it.
   * Three CMS panels share the behaviour.
   */
  async expectSavedIndicator(): Promise<void> {
    await expect(this.testId(tid.cms.saved).first()).toBeVisible({ timeout: 15_000 });
  }

  /** The indicator has expired. Proves the 2s window rather than assuming it. */
  async expectSavedIndicatorGone(): Promise<void> {
    await expect(this.testId(tid.cms.saved).first()).toBeHidden({ timeout: 10_000 });
  }
}
