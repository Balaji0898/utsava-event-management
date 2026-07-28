import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';

/**
 * `/packages` — every package across every vendor, flat.
 *
 * `force-dynamic`, no filters, no pagination. Cards show name, `formatCurrency(price)`
 * and the feature list, get `ring-2 ring-brand-500` when `popular`, and each CTA
 * ("Book now") links to `/book?vendorId=..&packageId=..`.
 *
 * Because it is unpaginated and unfiltered, this page shows EVERY package in the
 * database — including ones other workers created moments ago. So assertions are
 * always "contains mine", never "has N".
 */
export class PackagesPage extends SitePage {
  get path(): string {
    return paths.packages;
  }

  get cards(): Locator {
    return this.page.locator('[class*="card"]').filter({ has: this.page.getByRole('link', { name: messages.packages.bookNow }) });
  }

  card(packageName: string): Locator {
    return this.cards.filter({ hasText: packageName });
  }

  bookNowFor(packageName: string): Locator {
    return this.card(packageName).getByRole('link', { name: messages.packages.bookNow });
  }

  get emptyMessage(): Locator {
    return this.page.getByText(messages.packages.empty);
  }

  async bookPackage(packageName: string): Promise<void> {
    await this.bookNowFor(packageName).first().click();
    await expect(this.page).toHaveURL(/\/book\?.*packageId=/);
  }

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.packages.title, 1);
    await expect(this.page.getByText(messages.packages.subtitle)).toBeVisible();
  }

  async expectContains(packageName: string): Promise<void> {
    await expect(this.card(packageName).first()).toBeVisible();
  }

  async expectDoesNotContain(packageName: string): Promise<void> {
    await expect(this.card(packageName)).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }

  /** The `popular` flag renders as a brand ring rather than as text. */
  async expectPopularHighlight(packageName: string): Promise<void> {
    await expect(this.card(packageName).first()).toHaveClass(/ring-2/);
  }
}
