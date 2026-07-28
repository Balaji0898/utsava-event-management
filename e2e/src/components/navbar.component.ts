import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';

/**
 * The public navbar, from `features/website/components/navbar.tsx`.
 *
 * Notes that matter for locators:
 *  - The link set is Home / **Our Work** / Packages / Services / Contact Us, plus a
 *    `Book Now` CTA. "Our Work" — not "Vendors" — is `nav.vendors` in the dictionary.
 *  - Desktop links live in a `hidden md:flex` container; below `md` they move into a
 *    hamburger panel, so a locator must be viewport-aware.
 *  - `aria-current="page"` marks the active link, and only for non-anchor hrefs
 *    (`isActive` returns false for anything containing '#').
 *  - `Book Now` is wrapped in `Magnetic`, which translates the element toward the
 *    cursor. Harmless under `reducedMotion: 'reduce'`; a source of missed clicks
 *    without it.
 *  - `ThemeToggle` renders an empty `<div className="h-9 w-9" />` until mounted, so
 *    the toggle button does not exist on first paint — hence `waitFor` in
 *    `toggleTheme()`.
 */
export class NavbarComponent {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId(tid.nav.root);
  }

  get logo(): Locator {
    return this.page.getByRole('link', { name: 'Utsava home' });
  }

  link(name: string | RegExp): Locator {
    return this.root.getByRole('link', { name });
  }

  get home(): Locator {
    return this.link(messages.nav.home);
  }

  get ourWork(): Locator {
    return this.link(messages.nav.vendors);
  }

  get packages(): Locator {
    return this.link(messages.nav.packages);
  }

  get services(): Locator {
    return this.link(messages.nav.services);
  }

  get contact(): Locator {
    return this.link(messages.nav.contact);
  }

  get bookNow(): Locator {
    return this.page.getByTestId(tid.nav.bookNow);
  }

  get mobileToggle(): Locator {
    return this.page.getByTestId(tid.nav.mobileToggle);
  }

  get mobileMenu(): Locator {
    return this.page.getByTestId(tid.nav.mobileMenu);
  }

  get languageToggle(): Locator {
    return this.page.getByRole('button', { name: 'Switch language' });
  }

  get themeToggle(): Locator {
    return this.page.getByRole('button', { name: 'Toggle theme' });
  }

  /** The link the app currently considers active. Anchor links never match. */
  get activeLink(): Locator {
    return this.root.locator('a[aria-current="page"]');
  }

  async openMobileMenu(): Promise<void> {
    await this.mobileToggle.click();
    await expect(this.mobileMenu).toBeVisible();
  }

  /** Waits for hydration first — the button is absent on first paint. */
  async toggleTheme(): Promise<void> {
    await this.themeToggle.waitFor({ state: 'visible', timeout: 15_000 });
    await this.themeToggle.click();
  }

  async switchLanguage(): Promise<void> {
    await this.languageToggle.waitFor({ state: 'visible', timeout: 15_000 });
    await this.languageToggle.click();
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.logo).toBeVisible();
  }

  async expectActive(name: string | RegExp): Promise<void> {
    await expect(this.activeLink).toHaveAttribute('aria-current', 'page');
    await expect(this.activeLink).toHaveText(name);
  }
}
