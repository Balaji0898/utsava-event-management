import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { PaginationComponent } from '@components/pagination.component';

/**
 * `/admin/vendors` — the vendor table.
 *
 * Reads `GET /vendors?page={n}&limit=10`, which is the **public** endpoint with no
 * auth flag. So the list itself is not access-controlled; only the mutations are.
 * Worth knowing when reasoning about what an anonymous caller can enumerate.
 *
 * Delete fires `confirm('Delete this vendor and all its packages?')` — the only
 * confirm in the app that actually names its cascade.
 *
 * The pagination here is the WINDOWED admin component (`shared/ui/pagination.tsx`,
 * ±2 with disabled bounds), not the public one that renders every page.
 */
export class AdminVendorsListPage extends AdminPage {
  get path(): string {
    return paths.adminVendors;
  }

  readonly pagination = new PaginationComponent(this.page, this.page.getByTestId(tid.vend.pagination), 'admin');

  get table(): Locator {
    return this.testId(tid.vend.table);
  }

  get addButton(): Locator {
    return this.testId(tid.vend.addButton);
  }

  get emptyMessage(): Locator {
    return this.testId(tid.vend.empty);
  }

  row(id: string): Locator {
    return this.testId(tid.vend.row(id));
  }

  rowByName(name: string): Locator {
    return this.table.getByRole('row').filter({ hasText: name });
  }

  editLink(id: string): Locator {
    return this.testId(tid.vend.rowEdit(id));
  }

  deleteButton(id: string): Locator {
    return this.testId(tid.vend.rowDelete(id));
  }

  // ------------------------------------------------------------------ actions

  async startCreate(): Promise<void> {
    await this.addButton.click();
    await expect(this.page).toHaveURL(new RegExp(`${paths.adminVendorNew}$`));
  }

  async openEdit(id: string): Promise<void> {
    await this.editLink(id).click();
    await expect(this.page).toHaveURL(new RegExp(`/admin/vendors/${id}$`));
  }

  async deleteVendor(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.acceptOnce();
    await this.deleteButton(id).click();
    await expect(this.row(id)).toHaveCount(0, { timeout: 30_000 });
  }

  async cancelDelete(id: string): Promise<void> {
    const handler = this.dialogs;
    handler.dismissAll();
    await this.deleteButton(id).click();
    await expect(this.row(id)).toBeVisible();
    handler.dispose();
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.admin.vendors.heading, 2);
    await expect(this.addButton).toBeVisible();
  }

  async expectContains(name: string): Promise<void> {
    await expect(this.rowByName(name).first()).toBeVisible();
  }

  async expectDoesNotContain(name: string): Promise<void> {
    await expect(this.rowByName(name)).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toContainText(messages.admin.vendors.empty);
  }

  async expectColumns(): Promise<void> {
    for (const header of ['Vendor', 'Service', 'Rating', 'From', 'Contact', 'Status', 'Actions']) {
      await expect(this.table.getByRole('columnheader', { name: header })).toBeVisible();
    }
  }

  /**
   * Find a vendor across pages. `limit` is 10 and other workers add records, so a
   * record created moments ago may well not be on page 1.
   */
  async findAcrossPages(name: string, maxPages = 10): Promise<boolean> {
    for (let p = 1; p <= maxPages; p += 1) {
      if (await this.rowByName(name).count()) return true;
      const next = this.pagination.next;
      if (!(await next.isVisible()) || (await next.isDisabled())) return false;
      await next.click();
      await this.waitForLoadingToFinish();
    }
    return false;
  }
}
