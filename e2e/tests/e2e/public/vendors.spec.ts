import { test, expect } from '@fixtures/test';
import { messages } from '@data/test-data';
import { anchorVendor, seedTotals, seededStudios } from '@data/seed-data';
import { geolocation } from '@config/third-party';

/**
 * VENDORS — the public listing at `/vendors`.
 *
 * Every assertion here follows one rule: **never assert an absolute total or count.**
 * `findAll` returns a global `total` across all rows and other workers create vendors
 * concurrently, so `toHaveCount(n)` and "total === N" are guaranteed to flake. The page
 * objects expose `expectContains` / `expectDoesNotContain` for that reason, and the only
 * exact counts in this file are scoped to a department the test created itself.
 */

test.describe('Vendors listing - positive cases', () => {
  test('VENDORS-P-01 renders the heading, count line and seeded cards @smoke', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await vendorsPage.expectLoaded();

    /** The h1 is the hardcoded "Vendors", not the unused `vendorsPage.title` dictionary key. */
    await expect(vendorsPage.countLine).toContainText(messages.vendors.countSuffix);
    expect(await vendorsPage.reportedTotal()).toBeGreaterThanOrEqual(seedTotals.vendorsAtLeast);

    await vendorsPage.expectContains(anchorVendor.slug);
  });

  test('VENDORS-P-04 formats prices as INR with no decimals @smoke', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await vendorsPage.expectPriceFormat(anchorVendor.slug);

    /** `formatCurrency` uses en-IN, so grouping is 2,50,000 rather than 250,000. */
    await expect(vendorsPage.card(anchorVendor.slug)).not.toContainText(/\.\d{2}\b/);
  });

  test('VENDORS-P-05 a card links to its detail page @smoke', async ({ vendorsPage, vendorDetailPage }) => {
    await vendorsPage.open();
    await vendorsPage.openCard(anchorVendor.slug);
    await vendorDetailPage.expectLoaded(anchorVendor.name);
  });

  test('VENDORS-P-09 filters to a single department via departmentId @smoke', async ({ vendorsPage, factory }) => {
    const dept = await factory.createDepartment();
    const mine = await factory.createVendor({ departmentId: dept.id });

    await vendorsPage.openFiltered({ departmentId: dept.id });

    /** Safe to assert exactly: a department created moments ago holds only my vendor. */
    expect(await vendorsPage.reportedTotal()).toBe(1);
    await vendorsPage.expectContains(mine.slug);
    await vendorsPage.expectDoesNotContain(anchorVendor.slug);
  });

  test('VENDORS-P-10 filters by search across name substrings', async ({ vendorsPage, factory }) => {
    const vendor = await factory.createVendor({ name: factory.name('UniqueSearchTarget') });

    await vendorsPage.openFiltered({ search: vendor.name });
    await vendorsPage.expectContains(vendor.slug);
    await vendorsPage.expectDoesNotContain(seededStudios[1].slug);
  });

  test('VENDORS-P-13 renders a BackButton labelled "Back to home"', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await expect(vendorsPage.backButton).toContainText(messages.vendors.backToHome);
  });
});

test.describe('Vendors listing - empty and edge states', () => {
  test('VENDORS-E-04 shows the empty message when a filter matches nothing @smoke', async ({ vendorsPage }) => {
    await vendorsPage.openFiltered({ search: 'zzz-no-vendor-can-possibly-be-called-this-zzz' });

    await vendorsPage.expectEmpty();
    expect(await vendorsPage.reportedTotal()).toBe(0);
  });

  test('VENDORS-E-01 hides an INACTIVE vendor from the public listing', async ({ vendorsPage, factory }) => {
    const hidden = await factory.createVendor({ status: 'INACTIVE' });

    await vendorsPage.openFiltered({ search: hidden.name });
    await vendorsPage.expectDoesNotContain(hidden.slug);
    await vendorsPage.expectEmpty();
  });

  test('VENDORS-E-02 tolerates malformed query parameters without erroring', async ({ vendorsPage, page }) => {
    /**
     * These are all reachable by hand-editing the URL with no authentication, and `page` is
     * coerced with a bare `Number()` — so `page=abc` becomes `NaN` and reaches Prisma's
     * `skip`. The page must still render.
     */
    for (const query of ['page=abc', 'page=-1', 'page=0', 'page=99999', 'departmentId=nonexistent']) {
      const res = await page.goto(`/vendors?${query}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `?${query} must not error`).toBe(200);
      await expect(vendorsPage.countLine, `?${query} must still render the page shell`).toBeVisible();
    }
  });

  test('VENDORS-E-03 an unknown departmentId yields an empty list, not an error', async ({ vendorsPage }) => {
    await vendorsPage.openFiltered({ departmentId: 'definitely-not-a-department' });
    await vendorsPage.expectEmpty();
  });
});

test.describe('Vendors listing - pagination', () => {
  test('VENDORS-P-11 renders a link for every page, with no windowing', async ({ vendorsPage, page }) => {
    /**
     * Deliberate documentation of a real scaling problem: the public pagination renders ALL
     * page numbers from 1 to `pages`. `PAGE_SIZE` is 12, so at 480 vendors this page emits
     * 40 links. The admin table uses a windowed component instead; this one does not.
     */
    await vendorsPage.open();

    const total = await vendorsPage.reportedTotal();
    const expectedPages = Math.max(1, Math.ceil(total / 12));

    if (expectedPages === 1) {
      /** With `pages <= 1` the whole block is omitted rather than disabled. */
      await vendorsPage.pagination.expectHidden();
      return;
    }

    await expect(vendorsPage.pagination.container).toBeVisible();
    await vendorsPage.expectEveryPageLinked(expectedPages);
    await expect(page.locator('[aria-current="page"]')).toHaveText('1');
  });

  test('VENDORS-P-12 navigating to page 2 shows different vendors @smoke', async ({ vendorsPage }) => {
    await vendorsPage.open();
    const total = await vendorsPage.reportedTotal();
    test.skip(total <= 12, 'fewer than one page of vendors; nothing to paginate');

    const firstPageCards = await vendorsPage.cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid')),
    );

    await vendorsPage.pagination.goToPage(2);

    const secondPageCards = await vendorsPage.cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid')),
    );
    for (const id of secondPageCards) {
      expect(firstPageCards, 'page 2 must not repeat page 1').not.toContain(id);
    }
  });

  test('VENDORS-E-05 pagination preserves the active filters', async ({ vendorsPage, page }) => {
    await vendorsPage.openFiltered({ search: 'Studio', page: 1 });
    const total = await vendorsPage.reportedTotal();
    test.skip(total <= 12, 'not enough matches to paginate');

    await vendorsPage.pagination.goToPage(2);
    expect(page.url(), 'the search filter must survive paging').toContain('search=Studio');
  });
});

test.describe('Vendors listing - proximity search', () => {
  test('VENDORS-P-14 shows the nearby notice when coordinates return results', async ({
    vendorsPage,
    factory,
    useGeolocation,
  }) => {
    await useGeolocation();

    /** A vendor at the exact test coordinates guarantees the proximity query matches. */
    await factory.createVendor({ latitude: geolocation.latitude, longitude: geolocation.longitude });

    await vendorsPage.openFiltered({ lat: geolocation.latitude, lng: geolocation.longitude });
    await vendorsPage.expectNearbyResults();
  });

  test('VENDORS-E-06 falls back to all events when nothing is nearby, and says so', async ({ vendorsPage }) => {
    /**
     * Coordinates in the middle of the Pacific. With `total === 0` the page re-fetches
     * unfiltered and shows "No events found near your location — showing all events instead."
     * — so an empty proximity result must still show a populated list.
     */
    await vendorsPage.openFiltered({ lat: -40, lng: -140 });

    await vendorsPage.expectNearbyFallback();
    await vendorsPage.expectContains(anchorVendor.slug);
  });

  test('VENDORS-E-07 the fallback drops lat/lng from the pagination links', async ({ vendorsPage }) => {
    /**
     * Once the fallback fires, paging must not re-trigger the empty proximity query — so the
     * coordinates are stripped from every page href. Subtle, and exactly the kind of thing a
     * refactor breaks.
     */
    await vendorsPage.openFiltered({ lat: -40, lng: -140 });
    await vendorsPage.expectNearbyFallback();

    const total = await vendorsPage.reportedTotal();
    test.skip(total <= 12, 'no pagination rendered, so there are no hrefs to check');

    await vendorsPage.expectPaginationDropsCoordinates();
  });

  test('VENDORS-E-08 no proximity notice appears without coordinates', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await vendorsPage.expectNoProximityNotice();
  });
});

test.describe('Vendors listing - security', () => {
  test('VENDORS-S-01 a SQL-shaped search string returns an empty list, not an error @smoke', async ({
    vendorsPage,
    page,
  }) => {
    const res = await page.goto(`/vendors?search=${encodeURIComponent("' OR '1'='1")}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(res?.status()).toBe(200);

    /** Prisma parameterises, so the tautology matches nothing rather than everything. */
    await vendorsPage.expectEmpty();
  });

  test('VENDORS-S-02 the seeded data survives a DROP TABLE attempt @smoke', async ({ vendorsPage, page }) => {
    await page.goto(`/vendors?search=${encodeURIComponent('\'; DROP TABLE "Vendor"; --')}`, {
      waitUntil: 'domcontentloaded',
    });

    await vendorsPage.open();
    expect(
      await vendorsPage.reportedTotal(),
      'the Vendor table must still be populated',
    ).toBeGreaterThanOrEqual(seedTotals.vendorsAtLeast);
  });

  test('VENDORS-S-03 no page reveals a database error message', async ({ page }) => {
    for (const query of ['page=abc', 'minPrice=cheap', 'lat=here&lng=there', 'sort=garbage']) {
      await page.goto(`/vendors?${query}`, { waitUntil: 'domcontentloaded' });
      const body = (await page.textContent('body')) ?? '';
      expect(body, `?${query} leaked internals`).not.toMatch(/prisma|PostgresError|Invalid `prisma/i);
    }
  });
});
