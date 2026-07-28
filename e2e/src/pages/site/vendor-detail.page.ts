import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { GalleryLightboxComponent } from '@components/gallery-lightbox.component';

/**
 * `/vendors/[slug]` — the public vendor detail page.
 *
 * Structure: a hero card (cover image, department, `<h1>` name, optional
 * `ShieldCheck` verified mark, `{rating} ({reviewCount} reviews)`, MapPin location,
 * Phone contactNumber, description), then a Gallery section (only when
 * `gallery.length > 0`), then Packages, then Reviews (only when there are any).
 *
 * Two behaviours worth knowing:
 *
 *  - `notFound()` is called for an unknown slug, and there is **no custom
 *    `not-found.tsx`** anywhere in the app — so the 404 is Next's built-in page.
 *    Specs assert the framework default rather than a branded page that does not
 *    exist.
 *
 *  - **The `<h2>Packages</h2>` heading renders even when the vendor has zero
 *    packages** (bug B8), leaving an empty section. That is asserted explicitly
 *    rather than worked around.
 *
 * This page also carries the historical `next dev` chunk failure (blocker E1): a
 * stale `.next/server/vendor-chunks/framer-motion.js` made every slug return HTTP
 * 500. `expectLoaded()` is the P0 smoke guard for that, and `scripts/stack.mjs`
 * additionally health-gates `/vendors` at boot.
 */
export class VendorDetailPage extends SitePage {
  private slug = '';

  get path(): string {
    return paths.vendorDetail(this.slug);
  }

  readonly gallery = new GalleryLightboxComponent(this.page);

  async openSlug(slug: string): Promise<number> {
    this.slug = slug;
    const res = await this.openRaw(paths.vendorDetail(slug));
    await this.waitForLoadingToFinish();
    return res?.status() ?? 0;
  }

  get hero(): Locator {
    return this.testId(tid.vdetail.hero);
  }

  get name(): Locator {
    return this.testId(tid.vdetail.name);
  }

  get verifiedBadge(): Locator {
    return this.testId(tid.vdetail.verifiedBadge);
  }

  /** Renders `{rating} ({reviewCount} reviews)`. */
  get rating(): Locator {
    return this.testId(tid.vdetail.rating);
  }

  get gallerySection(): Locator {
    return this.testId(tid.vdetail.gallery);
  }

  get packagesSection(): Locator {
    return this.testId(tid.vdetail.packages);
  }

  packageCard(id: string): Locator {
    return this.testId(tid.vdetail.packageCard(id));
  }

  get packageCards(): Locator {
    return this.packagesSection.getByRole('listitem');
  }

  get reviewsSection(): Locator {
    return this.testId(tid.vdetail.reviews);
  }

  /** `Book this package` — one per package, so scope it to a card. */
  bookPackageLink(packageId: string): Locator {
    return this.packageCard(packageId).getByRole('link', { name: messages.vendorDetail.bookThisPackage });
  }

  get popularBadge(): Locator {
    return this.packagesSection.getByText(messages.vendorDetail.mostPopular);
  }

  // -------------------------------------------------------------------- actions

  /** Follow a package CTA into `/book?vendorId=..&packageId=..`. */
  async bookPackage(packageId: string): Promise<void> {
    await this.bookPackageLink(packageId).click();
    await expect(this.page).toHaveURL(new RegExp(`/book\\?.*packageId=${packageId}`));
  }

  // ----------------------------------------------------------------- assertions

  async expectLoaded(vendorName: string): Promise<void> {
    await expect(this.name).toBeVisible();
    await expect(this.name).toContainText(vendorName);
  }

  async expectVerified(): Promise<void> {
    await expect(this.verifiedBadge).toBeVisible();
  }

  async expectNotVerified(): Promise<void> {
    await expect(this.verifiedBadge).toHaveCount(0);
  }

  async expectGalleryVisible(): Promise<void> {
    await this.expectHeading(messages.vendorDetail.gallery, 2);
    await expect(this.gallerySection).toBeVisible();
  }

  /** The section is omitted entirely for a vendor with no gallery images. */
  async expectNoGallerySection(): Promise<void> {
    await expect(this.gallerySection).toHaveCount(0);
  }

  async expectPackagesVisible(): Promise<void> {
    await this.expectHeading(messages.vendorDetail.packages, 2);
  }

  /**
   * Bug B8: the heading renders with nothing under it.
   *
   * Asserted as current behaviour so the spec turns red when the heading is
   * correctly hidden — at which point this method is deleted, not "fixed".
   */
  async expectEmptyPackagesSectionStillHeaded(): Promise<void> {
    await this.expectHeading(messages.vendorDetail.packages, 2);
    await expect(this.packageCards).toHaveCount(0);
  }

  async expectReviewsVisible(): Promise<void> {
    await this.expectHeading(messages.vendorDetail.reviews, 2);
  }

  async expectNoReviewsSection(): Promise<void> {
    await expect(this.reviewsSection).toHaveCount(0);
  }

  /** Anonymous reviews fall back to "— Customer". */
  async expectAnonymousReviewAuthor(): Promise<void> {
    await expect(this.reviewsSection).toContainText(messages.vendorDetail.anonymousReviewer);
  }

  /** Next's built-in 404 — there is no `not-found.tsx` to brand it. */
  async expectNotFound(): Promise<void> {
    await expect(this.page.getByText(/404|This page could not be found/i)).toBeVisible();
  }

  async expectBackToWorkLink(): Promise<void> {
    await expect(this.backButton).toContainText(messages.vendorDetail.backToWork);
  }
}
