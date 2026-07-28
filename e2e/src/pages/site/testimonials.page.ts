import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { paths } from '@config/urls';
import { TestimonialFormComponent } from '@components/testimonial-form.component';

/**
 * `/testimonials` — every APPROVED review, plus the public submission form.
 *
 * `GET /cms/testimonials` (no `?all=true`) returns approved records only, so this
 * page is the public half of the moderation journey: a freshly submitted review must
 * be ABSENT here until an admin approves it in /admin/cms.
 *
 * Copy: `<h1>What our clients say</h1>` and "{n} review(s) from celebrations we've
 * been part of.", or "No reviews yet — be the first!" when empty. Both are hardcoded
 * English wrapped in `<Tr>`, not dictionary keys, so they render verbatim in `en`.
 */
export class TestimonialsPage extends SitePage {
  get path(): string {
    return paths.testimonials;
  }

  readonly form = new TestimonialFormComponent(this.page);

  get cards(): Locator {
    return this.page.locator('[class*="card"]').filter({ hasText: /—|"/ });
  }

  /** Locate a specific review by its author name — parallel-safe. */
  review(authorName: string): Locator {
    return this.page.getByText(authorName, { exact: false });
  }

  get emptyMessage(): Locator {
    return this.page.getByText(/No reviews yet/i);
  }

  async expectLoaded(): Promise<void> {
    await this.expectHeading(/What our clients say/i, 1);
  }

  async expectContains(authorName: string): Promise<void> {
    await expect(this.review(authorName).first()).toBeVisible();
  }

  /**
   * The load-bearing assertion of the moderation journey: an unapproved review must
   * not be publicly visible. Uses `reloadFresh()` at the call site so a 300s
   * `unstable_cache` hit cannot fake a pass.
   */
  async expectDoesNotContain(authorName: string): Promise<void> {
    await expect(this.page.getByText(authorName, { exact: false })).toHaveCount(0);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.emptyMessage).toBeVisible();
  }
}
