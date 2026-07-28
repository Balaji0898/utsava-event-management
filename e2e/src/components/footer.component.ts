import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';

/**
 * The public footer.
 *
 * Its phone and email come from the `site-contact` CMS block via
 * `SiteContactProvider`, which the `(site)` layout fetches with a 2.5-second budget
 * and ZERO retries. So on a slow API the footer legitimately renders hard-coded
 * fallback values rather than the CMS ones — which is exactly the divergence bug B9
 * describes for `phoneDisplay`.
 *
 * This is also the observable end of the CMS-propagation journey: editing contact
 * details in /admin/cms must change the footer, the contact section and the
 * WhatsApp FAB on every public page.
 */
export class FooterComponent {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId(tid.footer.root);
  }

  /** `tel:` link — driven by the CMS `phone` field (digits only). */
  get phoneLink(): Locator {
    return this.page.getByTestId(tid.footer.phone);
  }

  /** `mailto:` link — driven by the CMS `email` field. */
  get emailLink(): Locator {
    return this.page.getByTestId(tid.footer.email);
  }

  link(name: string | RegExp): Locator {
    return this.root.getByRole('link', { name });
  }

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async expectPhone(digits: string): Promise<void> {
    await expect(this.phoneLink).toHaveAttribute('href', `tel:${digits}`);
  }

  async expectEmail(address: string): Promise<void> {
    await expect(this.emailLink).toHaveAttribute('href', `mailto:${address}`);
  }
}
