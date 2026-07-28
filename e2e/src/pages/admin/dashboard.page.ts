import { expect, type Locator } from '@playwright/test';
import { AdminPage } from '../admin.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';

/**
 * `/admin` — the dashboard.
 *
 * Reads `GET /bookings/stats` (admin-only) and renders four stat cards plus two
 * panels.
 *
 * ⚠️ **The "Revenue (confirmed)" bar chart is hard-coded**: `[40,65,45,80,55,90,70]`
 * for Mon–Sun, with no relationship to any data. So there is nothing to assert about
 * its VALUES, only that it renders. The correctness case is an intentional
 * `test.skip` with that reason recorded, rather than a test that pretends to check
 * something.
 *
 * The error state interpolates the failure: "Could not load stats: {msg}. Make sure
 * the API is running and you are logged in." — which the error-boundary specs induce
 * by route-failing the stats endpoint.
 */
export class AdminDashboardPage extends AdminPage {
  get path(): string {
    return paths.admin;
  }

  /** One of "Total Vendors" | "Departments" | "Categories" | "Bookings". */
  statCard(label: string): Locator {
    return this.testId(tid.dashboard.stat(label));
  }

  /** Numeric value inside a stat card. */
  async statValue(label: string): Promise<number> {
    const text = (await this.statCard(label).textContent()) ?? '';
    const match = /(\d[\d,]*)/.exec(text.replace(label, ''));
    return match ? Number(match[1].replace(/,/g, '')) : -1;
  }

  get errorMessage(): Locator {
    return this.testId(tid.dashboard.error);
  }

  /** Renders a fake, hard-coded chart. Presence only — never values. */
  get revenueCard(): Locator {
    return this.testId(tid.dashboard.revenueCard);
  }

  get bookingStatusCard(): Locator {
    return this.testId(tid.dashboard.statusCard);
  }

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.admin.dashboard.heading, 2);
    for (const label of messages.admin.dashboard.cards) {
      await expect(this.statCard(label)).toBeVisible();
    }
  }

  async expectAllStatsNumeric(): Promise<void> {
    for (const label of messages.admin.dashboard.cards) {
      expect(await this.statValue(label), `${label} must render a number`).toBeGreaterThanOrEqual(0);
    }
  }

  async expectError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 30_000 });
    await expect(this.errorMessage).toContainText(messages.admin.dashboard.errorPrefix);
  }

  async expectPanelsPresent(): Promise<void> {
    await expect(this.revenueCard).toBeVisible();
    await expect(this.bookingStatusCard).toBeVisible();
  }
}
