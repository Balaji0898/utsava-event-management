import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';
import { Dialogs } from '@fixtures/dialogs';

/**
 * `PackagesManager` (`features/admin/components/packages-manager.tsx`), rendered only
 * on `/admin/vendors/[id]` — so it is reachable only AFTER a vendor exists, which is
 * why a create spec conveniently lands here.
 *
 * Quirks:
 *  - inputs are placeholder-only, and the features textarea's placeholder is
 *    **multi-line** (`"Features (one per line)\n2 Photographers\nDrone\nAlbum"`),
 *    which makes placeholder-based locators genuinely awkward — hence testids;
 *  - features are split on `\n` before being POSTed, so a multi-line value becomes an
 *    array and blank lines matter;
 *  - the client guard is `if (!name || !price) return` — a silent no-op with no error;
 *  - the delete button is an **unlabelled** `Trash2` (axe `button-name`, bug B4) and
 *    fires `confirm('Delete package?')`.
 */
export class PackagesManagerComponent {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByTestId(tid.pkg.manager);
  }

  get nameInput(): Locator {
    return this.page.getByTestId(tid.pkg.name);
  }

  get priceInput(): Locator {
    return this.page.getByTestId(tid.pkg.price);
  }

  /** Newline-separated; the component splits on '\n'. */
  get featuresInput(): Locator {
    return this.page.getByTestId(tid.pkg.features);
  }

  get popularCheckbox(): Locator {
    return this.page.getByTestId(tid.pkg.popular);
  }

  get addButton(): Locator {
    return this.page.getByTestId(tid.pkg.submit);
  }

  get list(): Locator {
    return this.page.getByTestId(tid.pkg.list);
  }

  row(id: string): Locator {
    return this.page.getByTestId(tid.pkg.row(id));
  }

  rowByName(name: string): Locator {
    return this.list.locator('li, [data-testid^="pkg-row-"]').filter({ hasText: name });
  }

  deleteButton(id: string): Locator {
    return this.page.getByTestId(tid.pkg.rowDelete(id));
  }

  popularChip(id: string): Locator {
    return this.page.getByTestId(tid.pkg.rowPopularChip(id));
  }

  // ------------------------------------------------------------------ actions

  async add(values: { name: string; price: string; features?: string[]; popular?: boolean }): Promise<void> {
    await this.nameInput.fill(values.name);
    await this.priceInput.fill(values.price);
    if (values.features?.length) await this.featuresInput.fill(values.features.join('\n'));
    if (values.popular) await this.popularCheckbox.check();
    await this.addButton.click();
    await expect(this.rowByName(values.name).first()).toBeVisible({ timeout: 30_000 });
  }

  /** Click Add with a missing field — the `if (!name || !price) return` guard. */
  async submitIncomplete(values: { name?: string; price?: string }): Promise<void> {
    if (values.name !== undefined) await this.nameInput.fill(values.name);
    if (values.price !== undefined) await this.priceInput.fill(values.price);
    await this.addButton.click();
  }

  async deletePackage(id: string, dialogs?: Dialogs): Promise<void> {
    const handler = dialogs ?? new Dialogs(this.page);
    handler.acceptOnce();
    await this.deleteButton(id).click();
    await expect(this.row(id)).toHaveCount(0, { timeout: 30_000 });
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: messages.admin.packages.heading })).toBeVisible();
  }

  async expectContains(name: string): Promise<void> {
    await expect(this.rowByName(name).first()).toBeVisible();
  }

  async expectDoesNotContain(name: string): Promise<void> {
    await expect(this.rowByName(name)).toHaveCount(0);
  }

  /** Features arrive as an array, so each line must render as its own item. */
  async expectFeatures(name: string, features: string[]): Promise<void> {
    const row = this.rowByName(name).first();
    for (const feature of features) await expect(row).toContainText(feature);
  }

  async expectPopular(id: string): Promise<void> {
    await expect(this.popularChip(id)).toHaveText(messages.admin.packages.popularChip);
  }

  /** Nothing happens, and nothing explains why. */
  async expectSilentAddFailure(countBefore: number): Promise<void> {
    await expect(this.list.locator('[data-testid^="pkg-row-"]')).toHaveCount(countBefore);
  }
}
