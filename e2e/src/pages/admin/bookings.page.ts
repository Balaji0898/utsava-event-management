import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

/**
 * `/admin/bookings`.
 *
 * `GET /bookings` returns a **flat array** — no pagination, no filters, no search, no
 * sorting. So on a database with a few hundred bookings this page renders all of
 * them, and a spec can never assert a row count. The missing pagination/filter cases
 * are recorded as intentional skips rather than as failures.
 *
 * Status changes go through a per-row `<select>` → `PATCH /bookings/{id}/status`, then
 * a full reload. There is **no confirmation dialog**, so a mis-click is immediately
 * destructive — worth noting, and worth a test that the change actually persists.
 *
 * Two known defects show up here:
 *  - B3: the status `<select>` has `outline-none` with no replacement focus style and
 *    no accessible name (WCAG 2.4.7 and 4.1.2). Phase 3 adds the label.
 *  - B5: the table wrapper is `overflow-x-auto` with no `tabIndex`, so keyboard users
 *    cannot scroll it at narrow widths.
 *
 * The Date column renders via `toLocaleDateString()`, so it is locale-dependent —
 * which is why the config pins `locale: 'en-IN'` and `timezoneId: 'Asia/Kolkata'`.
 */
export class AdminBookingsPage extends AdminPage {
  get path(): string {
    return paths.adminBookings;
  }

  get table(): Locator {
    return this.testId(tid.booking.table);
  }

  get emptyMessage(): Locator {
    return this.testId(tid.booking.empty);
  }

  row(id: string): Locator {
    return this.testId(tid.booking.row(id));
  }

  /** Bookings have no delete endpoint, so locating by customer email is the handle. */
  rowByEmail(email: string): Locator {
    return this.table.getByRole('row').filter({ hasText: email });
  }

  statusSelect(id: string): Locator {
    return this.testId(tid.booking.rowStatus(id));
  }

  /** Carries `data-status` so the badge is readable without relying on colour. */
  statusBadge(id: string): Locator {
    return this.testId(tid.booking.rowBadge(id));
  }

  /**
   * Deliberately expected to resolve to zero elements.
   *
   * `GET /bookings` returns a flat array with no query parameters, so this page has no
   * pagination, filter, sort or search controls at all. The absence is asserted rather than
   * assumed, so that adding pagination becomes a visible change to this spec.
   */
  get paginationControls(): Locator {
    return this.page.getByRole('navigation', { name: /pagination/i });
  }

  // ------------------------------------------------------------------ actions

  /** No confirm dialog — the change applies immediately, then the page reloads. */
  async setStatus(id: string, status: BookingStatus): Promise<void> {
    await this.statusSelect(id).selectOption(status);
    await this.waitForLoadingToFinish();
    await expect(this.statusBadge(id)).toHaveAttribute('data-status', status, { timeout: 30_000 });
  }

  async currentStatus(id: string): Promise<string | null> {
    return this.statusBadge(id).getAttribute('data-status');
  }

  // --------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.admin.bookings.heading, 2);
  }

  async expectContains(email: string): Promise<void> {
    await expect(this.rowByEmail(email).first()).toBeVisible();
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toHaveText(messages.admin.bookings.empty);
  }

  async expectColumns(): Promise<void> {
    for (const header of messages.admin.bookings.columns) {
      await expect(this.table.getByRole('columnheader', { name: header })).toBeVisible();
    }
  }

  /** Every status the enum allows must be offered. */
  async expectAllStatusOptions(id: string): Promise<void> {
    const options = await this.statusSelect(id).locator('option').evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).value),
    );
    for (const status of messages.admin.bookings.statuses) expect(options).toContain(status);
  }

  async expectStatus(id: string, status: BookingStatus): Promise<void> {
    await expect(this.statusBadge(id)).toHaveAttribute('data-status', status);
  }

  /**
   * Bug B3, asserted rather than assumed: the select carries no accessible name.
   * Flip this to a positive assertion once Phase 3's aria-label lands.
   */
  async expectStatusSelectHasAccessibleName(id: string): Promise<void> {
    const name = await this.statusSelect(id).getAttribute('aria-label');
    expect(name, 'the booking status select needs an accessible name (WCAG 4.1.2)').toBeTruthy();
  }

  /** Bug B5: the scroll container must be keyboard-reachable. */
  async expectScrollContainerFocusable(): Promise<void> {
    const wrapper = this.table.locator('xpath=..');
    await expect(wrapper).toHaveAttribute('tabindex', '0');
  }
}
