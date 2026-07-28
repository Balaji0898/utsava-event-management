import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';

/**
 * The admin sidebar, from `features/admin/components/sidebar.tsx`.
 *
 * Two things to know:
 *
 *  - It is `hidden md:flex` and **nothing replaces it below `md`**, so admin is
 *    unnavigable on mobile. `expectAbsentOnMobile()` asserts that current reality
 *    rather than pretending a menu exists.
 *
 *  - The link labelled **"Departments"** navigates to a page whose own heading says
 *    **"Categories"**. That mismatch is real; both strings are in `messages` so a
 *    spec can assert each in its own place without one being "wrong".
 *
 * The active indicator is a framer-motion `layoutId="active-nav"` span that slides
 * between links across renders — under `reducedMotion: 'reduce'` it snaps, which is
 * why an active-state assertion is safe.
 */
export class SidebarComponent {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId(tid.admin.sidebar);
  }

  get dashboard(): Locator {
    return this.page.getByTestId(tid.admin.navLink('dashboard'));
  }

  /** Labelled "Departments" — the destination page is headed "Categories". */
  get departments(): Locator {
    return this.page.getByTestId(tid.admin.navLink('departments'));
  }

  get vendors(): Locator {
    return this.page.getByTestId(tid.admin.navLink('vendors'));
  }

  get bookings(): Locator {
    return this.page.getByTestId(tid.admin.navLink('bookings'));
  }

  get cms(): Locator {
    return this.page.getByTestId(tid.admin.navLink('cms'));
  }

  get logout(): Locator {
    return this.page.getByTestId(tid.admin.logout);
  }

  /**
   * Logout clears all three localStorage keys, fires a best-effort
   * `POST /auth/logout`, then `router.push('/login')`. The storage clear happens
   * FIRST, so the logout request may well 401 — that is by design and not a bug.
   */
  async signOut(): Promise<void> {
    await this.logout.click();
    await expect(this.page).toHaveURL(/\/login$/, { timeout: 20_000 });
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  /** Documents the missing mobile nav rather than skipping over it. */
  async expectAbsentOnMobile(): Promise<void> {
    await expect(this.root).toBeHidden();
  }

  async expectActive(label: string): Promise<void> {
    await expect(this.root.locator('a[aria-current="page"]')).toContainText(label);
  }

  async expectAllLinks(): Promise<void> {
    for (const [locator, label] of [
      [this.dashboard, 'Dashboard'],
      [this.departments, messages.admin.departments.sidebarLabel],
      [this.vendors, 'Vendors'],
      [this.bookings, 'Bookings'],
      [this.cms, 'CMS'],
    ] as const) {
      await expect(locator).toBeVisible();
      await expect(locator).toContainText(label);
    }
  }
}
