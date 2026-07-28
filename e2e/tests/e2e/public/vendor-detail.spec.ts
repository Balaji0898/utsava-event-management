import { test, expect } from '@fixtures/test';
import { anchorVendor, seededStudioPackages } from '@data/seed-data';
import { messages } from '@data/test-data';

/**
 * VDETAIL — `/vendors/[slug]`.
 *
 * VDETAIL-P-01 exists because of a real incident: a stale `next dev` webpack chunk made
 * every vendor-detail URL return HTTP 500 (`Cannot find module
 * './vendor-chunks/framer-motion.js'`) while `/vendors` stayed 200. Nothing in the suite
 * would have caught it, because every other spec on this page would have failed with a
 * confusing locator timeout rather than pointing at the status code. So the first case
 * asserts the status code explicitly, and `scripts/stack.mjs` additionally health-gates
 * `/vendors` at boot.
 */

test.describe('Vendor detail - positive cases', () => {
  test('VDETAIL-P-01 returns HTTP 200 and renders the vendor name @smoke', async ({ vendorDetailPage }) => {
    const status = await vendorDetailPage.openSlug(anchorVendor.slug);

    expect(
      status,
      'A 500 here means a stale .next build. The suite must run against `next build && next start`, ' +
        'never a long-lived `next dev` — see scripts/stack.mjs.',
    ).toBe(200);

    await vendorDetailPage.expectLoaded(anchorVendor.name);
  });

  test('VDETAIL-P-02 shows the department, rating and review count', async ({ vendorDetailPage, page }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);

    await expect(vendorDetailPage.rating).toContainText(/\d+(\.\d+)?\s*\(\d+ reviews\)/);
    await expect(page.getByText(anchorVendor.department, { exact: false }).first()).toBeVisible();
  });

  test('VDETAIL-P-03 marks a verified vendor with a labelled badge', async ({ vendorDetailPage }) => {
    /** Every seeded vendor is `verified: true`. The badge is now `role="img"` with a name. */
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectVerified();
  });

  test('VDETAIL-P-04 omits the verified badge for an unverified vendor', async ({ vendorDetailPage, factory }) => {
    const plain = await factory.createVendor({ verified: false });
    await vendorDetailPage.openSlug(plain.slug);
    await vendorDetailPage.expectNotVerified();
  });

  test('VDETAIL-P-11 lists the packages with prices and features @smoke', async ({ vendorDetailPage, page }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectPackagesVisible();

    for (const pkg of seededStudioPackages) {
      await expect(page.getByText(pkg.name, { exact: false }).first()).toBeVisible();
    }
    /** `Premium` is the seeded `popular` tier, badged "Most popular". */
    await expect(vendorDetailPage.popularBadge).toBeVisible();
  });

  test('VDETAIL-P-12 a package CTA carries both ids into the booking form', async ({
    vendorDetailPage,
    factory,
    page,
  }) => {
    const vendor = await factory.createVendor();
    const pkg = await factory.createPackage(vendor.id);

    await vendorDetailPage.openSlug(vendor.slug);
    await vendorDetailPage.bookPackage(pkg.id);

    expect(page.url()).toContain(`vendorId=${vendor.id}`);
    expect(page.url()).toContain(`packageId=${pkg.id}`);
  });

  test('VDETAIL-P-13 shows reviews, falling back to "Customer" for anonymous authors', async ({
    vendorDetailPage,
  }) => {
    /** Each seeded vendor has exactly one review with `authorName: 'Happy Customer'`. */
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectReviewsVisible();
  });

  test('VDETAIL-P-14 links back to the listing', async ({ vendorDetailPage }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectBackToWorkLink();
  });
});

test.describe('Vendor detail - negative and edge cases', () => {
  test('VDETAIL-N-01 an unknown slug renders the framework 404 @smoke', async ({ vendorDetailPage }) => {
    /**
     * `notFound()` is called, and there is **no `not-found.tsx`** anywhere in the app — so the
     * 404 is Next's unbranded default. Asserted as-is rather than pretending a branded page
     * exists; the day one is added, this case is the reminder to update it.
     */
    const status = await vendorDetailPage.openSlug('definitely-not-a-real-vendor-slug');
    expect(status).toBe(404);
    await vendorDetailPage.expectNotFound();
  });

  test('VDETAIL-N-02 a URL-encoded path traversal attempt 404s cleanly', async ({ vendorDetailPage }) => {
    const status = await vendorDetailPage.openSlug(encodeURIComponent('../../admin'));
    expect([404, 400]).toContain(status);
  });

  test('VDETAIL-E-01 a vendor with no gallery omits the Gallery section entirely', async ({
    vendorDetailPage,
    factory,
  }) => {
    const bare = await factory.createVendor({ gallery: [] });
    await vendorDetailPage.openSlug(bare.slug);
    await vendorDetailPage.expectNoGallerySection();
  });

  test('VDETAIL-E-05 the Packages heading renders even with zero packages (bug B8)', async ({
    vendorDetailPage,
    factory,
  }) => {
    /**
     * Bug B8. The `<h2>Packages</h2>` is unconditional, so a vendor with no pricing tiers gets
     * an empty, headed section — which reads to a visitor as "this vendor has no prices" when
     * it should simply be absent.
     *
     * Asserted as current behaviour, so hiding the heading turns this red and forces the test
     * to be updated deliberately.
     */
    const bare = await factory.createVendor();
    await vendorDetailPage.openSlug(bare.slug);
    await vendorDetailPage.expectEmptyPackagesSectionStillHeaded();
  });

  test('VDETAIL-E-06 a vendor with no reviews omits the Reviews section', async ({
    vendorDetailPage,
    factory,
  }) => {
    const bare = await factory.createVendor();
    await vendorDetailPage.openSlug(bare.slug);
    await vendorDetailPage.expectNoReviewsSection();
  });

  test('VDETAIL-E-07 an INACTIVE vendor is not publicly reachable', async ({ vendorDetailPage, factory }) => {
    const hidden = await factory.createVendor({ status: 'INACTIVE' });
    const status = await vendorDetailPage.openSlug(hidden.slug);
    expect(status, 'an inactive vendor must not be viewable by slug').toBe(404);
  });
});

test.describe('Vendor detail - gallery lightbox', () => {
  test.beforeEach(async ({ vendorDetailPage }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectGalleryVisible();
  });

  test('VDETAIL-P-05 opens the lightbox with correct dialog semantics @smoke', async ({ vendorDetailPage }) => {
    const gallery = vendorDetailPage.gallery;
    await gallery.open(1);

    /** The only real `role="dialog"` + `aria-modal` in the whole app. */
    await gallery.expectAccessibleName(anchorVendor.name);
    await gallery.expectScrollLocked();
  });

  test('VDETAIL-P-06 navigates with the on-screen controls and updates the counter', async ({
    vendorDetailPage,
  }) => {
    const gallery = vendorDetailPage.gallery;
    const total = await gallery.thumbnailCount();
    test.skip(total < 2, 'this vendor has a single image, so there is nothing to navigate');

    await gallery.open(1);
    await gallery.expectIndex(1, total);

    await gallery.nextButton.click();
    await gallery.expectIndex(2, total);

    await gallery.previousButton.click();
    await gallery.expectIndex(1, total);
  });

  test('VDETAIL-P-07 navigates with the arrow keys @smoke', async ({ vendorDetailPage }) => {
    const gallery = vendorDetailPage.gallery;
    const total = await gallery.thumbnailCount();
    test.skip(total < 2, 'single image');

    await gallery.open(1);
    await gallery.nextWithKeyboard();
    await gallery.expectIndex(2, total);

    await gallery.previousWithKeyboard();
    await gallery.expectIndex(1, total);
  });

  test('VDETAIL-E-02 navigation wraps at both ends', async ({ vendorDetailPage }) => {
    const gallery = vendorDetailPage.gallery;
    const total = await gallery.thumbnailCount();
    test.skip(total < 2, 'single image');

    await gallery.open(1);
    /** Backwards from the first image lands on the last. */
    await gallery.previousWithKeyboard();
    await gallery.expectIndex(total, total);

    /** And forwards from the last returns to the first. */
    await gallery.nextWithKeyboard();
    await gallery.expectIndex(1, total);
  });

  test('VDETAIL-P-08 closes with the button, Escape and a backdrop click', async ({ vendorDetailPage }) => {
    const gallery = vendorDetailPage.gallery;

    await gallery.open(1);
    await gallery.closeWithButton();
    await gallery.expectScrollRestored();

    await gallery.open(1);
    await gallery.closeWithEscape();
    await gallery.expectScrollRestored();

    await gallery.open(1);
    await gallery.closeWithBackdrop();
    await gallery.expectScrollRestored();
  });

  test('VDETAIL-E-03 body scroll is restored after closing', async ({ vendorDetailPage }) => {
    /**
     * The component sets `document.body.style.overflow = 'hidden'` while open. Failing to
     * restore it would leave the whole page unscrollable — a stuck state a user cannot
     * recover from without a reload.
     */
    const gallery = vendorDetailPage.gallery;
    await gallery.open(1);
    await gallery.expectScrollLocked();
    await gallery.closeWithEscape();
    await gallery.expectScrollRestored();
  });

  test('VDETAIL-A-01 the lightbox does not trap focus (documented gap)', async ({ vendorDetailPage, page }) => {
    /**
     * `aria-modal="true"` promises focus containment, but there is no focus trap — Tab walks
     * straight out into the page behind, which is exactly the confusion `aria-modal` is meant
     * to prevent (WCAG 2.4.3 / 2.1.2).
     *
     * Asserted as the SECURE/correct behaviour and marked expected-fail, so adding a trap
     * flips it green and the annotation gets deleted.
     */
    test.info().annotations.push({
      type: 'known-vulnerability',
      description:
        'A11Y — the gallery lightbox declares aria-modal="true" but does not trap focus, so Tab ' +
        'escapes to the page behind it. Owner: frontend/features/website/components/gallery.tsx.',
    });
    test.fail();

    const gallery = vendorDetailPage.gallery;
    await gallery.open(1);

    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');

    const focusIsInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog && !!document.activeElement && dialog.contains(document.activeElement);
    });
    expect(focusIsInsideDialog, 'focus must stay within an aria-modal dialog').toBe(true);
  });
});

test.describe('Vendor detail - the vendor-created-then-published path', () => {
  test('VDETAIL-P-15 a vendor created through the API is immediately reachable by slug', async ({
    vendorDetailPage,
    factory,
  }) => {
    /**
     * The public read goes through `serverApi`'s `unstable_cache` (300s), so a freshly created
     * record needs the cache busting before it is visible. `reloadFresh` does that — which is
     * the mechanic the full admin-to-public journeys depend on.
     */
    const vendor = await factory.createVendor();
    await factory.createPackage(vendor.id, { name: 'E2E Tier' });

    await vendorDetailPage.openSlug(vendor.slug);
    await vendorDetailPage.reloadFresh('vendors');

    await vendorDetailPage.expectLoaded(vendor.name);
    await expect(vendorDetailPage.packagesSection).toContainText('E2E Tier');
    await expect(vendorDetailPage.packagesSection).toContainText(messages.vendorDetail.bookThisPackage);
  });
});
