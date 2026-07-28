import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { PaginationComponent } from '@components/pagination.component';

/**
 * `/vendors` — the public listing. A server component.
 *
 * Things that shape every spec here:
 *
 *  - **There is no filter UI on this page.** Filters arrive purely as query params,
 *    produced elsewhere: the home hero search form and the department cards. The
 *    page's own copy even says "Filter by department from the home page." So a
 *    filtering spec navigates by URL, it does not click controls that do not exist.
 *
 *  - Params consumed: `departmentId`, `search`, `city`, `page`, `lat`+`lng`.
 *    `PAGE_SIZE` is 12. Note the home hero also submits a `date` field which this
 *    page **never reads** — an asserted dead end, not an oversight to work around.
 *
 *  - **Proximity fallback.** With `lat`&`lng` present, if `total === 0` the page
 *    re-fetches unfiltered and shows "No events found near your location — showing
 *    all events instead."; with results it shows "Showing events near your current
 *    location." Once the fallback fires, `lat`/`lng` are DROPPED from the pagination
 *    hrefs so paging does not re-trigger the empty proximity query.
 *
 *  - **Pagination renders every page number**, 1..pages, with no windowing. Forty
 *    pages means forty links. `← Prev` / `Next →` appear only when applicable, and
 *    the whole block is absent when `pages <= 1`.
 *
 *  - `serverApi` swallows errors and returns null, so a dead backend renders
 *    "0 vendors available" + "No vendors found." rather than an error. Never treat
 *    the empty state as proof of anything without a health check.
 */
export class VendorsListPage extends SitePage {
  get path(): string {
    return paths.vendors;
  }

  readonly pagination = new PaginationComponent(this.page, this.page.getByTestId(tid.vendors.pagination), 'public');

  get list(): Locator {
    return this.testId(tid.vendors.list);
  }

  /** The "{total} vendors available. …" line. */
  get countLine(): Locator {
    return this.testId(tid.vendors.count);
  }

  get emptyMessage(): Locator {
    return this.testId(tid.vendors.empty);
  }

  /** The amber pill that appears only for a `lat`/`lng` request. */
  get proximityNotice(): Locator {
    return this.testId(tid.vendors.proximityNotice);
  }

  /** Address exactly one card — the only parallel-safe way to assert on a listing. */
  card(slug: string): Locator {
    return this.testId(tid.vendors.card(slug));
  }

  get cards(): Locator {
    return this.list.getByRole('link');
  }

  /** The cover `<img>` uses `alt={v.name}`, which is a reliable per-card handle. */
  cardImage(name: string): Locator {
    return this.list.getByRole('img', { name });
  }

  // -------------------------------------------------------------------- actions

  async openFiltered(params: {
    departmentId?: string;
    search?: string;
    city?: string;
    page?: number;
    lat?: number;
    lng?: number;
  }): Promise<void> {
    const q = new URLSearchParams();
    if (params.departmentId) q.set('departmentId', params.departmentId);
    if (params.search) q.set('search', params.search);
    if (params.city) q.set('city', params.city);
    if (params.page) q.set('page', String(params.page));
    if (params.lat !== undefined) q.set('lat', String(params.lat));
    if (params.lng !== undefined) q.set('lng', String(params.lng));
    await this.openRaw(`${paths.vendors}?${q.toString()}`);
    await this.waitForLoadingToFinish();
  }

  async openCard(slug: string): Promise<void> {
    await this.card(slug).click();
    await expect(this.page).toHaveURL(new RegExp(`/vendors/${slug}$`));
  }

  /** Total as the page reports it — parsed out of the count line, not counted. */
  async reportedTotal(): Promise<number> {
    const text = (await this.countLine.textContent()) ?? '';
    const match = /(\d+)\s+vendors available/.exec(text);
    return match ? Number(match[1]) : -1;
  }

  // ----------------------------------------------------------------- assertions

  async expectLoaded(): Promise<void> {
    await this.expectHeading(messages.vendors.title, 1);
    await expect(this.countLine).toBeVisible();
  }

  /**
   * Prefer this over any count assertion.
   *
   * `total` is global across all rows and other workers are creating vendors
   * concurrently, so `toHaveCount(n)` and "total === N" are guaranteed to flake.
   */
  async expectContains(slug: string): Promise<void> {
    await expect(this.card(slug)).toBeVisible();
  }

  async expectDoesNotContain(slug: string): Promise<void> {
    await expect(this.card(slug)).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
    await expect(this.emptyMessage).toHaveText(messages.vendors.empty);
  }

  async expectNearbyResults(): Promise<void> {
    await expect(this.proximityNotice).toBeVisible();
    await expect(this.proximityNotice).toContainText(messages.vendors.nearWithResults);
  }

  async expectNearbyFallback(): Promise<void> {
    await expect(this.proximityNotice).toBeVisible();
    await expect(this.proximityNotice).toContainText(messages.vendors.nearNoResults);
  }

  async expectNoProximityNotice(): Promise<void> {
    await expect(this.proximityNotice).toHaveCount(0);
  }

  /** Once the fallback fires, paging links must no longer carry lat/lng. */
  async expectPaginationDropsCoordinates(): Promise<void> {
    const hrefs = await this.pagination.container.getByRole('link').evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    for (const href of hrefs) {
      expect(href, `pagination href must not carry proximity params: ${href}`).not.toMatch(/[?&](lat|lng)=/);
    }
  }

  /** Documents the no-windowing behaviour: every page gets its own link. */
  async expectEveryPageLinked(pages: number): Promise<void> {
    expect(await this.pagination.pageLinkCount()).toBe(pages);
  }

  /** Prices render via `formatCurrency` — INR, en-IN, zero decimals. */
  async expectPriceFormat(slug: string): Promise<void> {
    await expect(this.card(slug)).toContainText(messages.vendors.from);
    await expect(this.card(slug)).toContainText(/₹\s?[\d,]+/);
  }
}
