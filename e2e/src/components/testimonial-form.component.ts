import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '@config/testids';
import { messages } from '@data/test-data';

/**
 * The public review form (`features/website/components/testimonial-form.tsx`),
 * rendered on both `/` and `/testimonials`.
 *
 * Why this component matters disproportionately: it is the only place an
 * unauthenticated visitor writes to the database, and its submissions land
 * `approved: false`. That makes it half of the review-moderation journey — submit
 * publicly, confirm it is invisible, approve in /admin/cms, confirm it appears —
 * which is the single most valuable end-to-end path in the app.
 *
 * Quirks:
 *  - inputs are placeholder-only: no labels, no `name` attributes, no ids;
 *  - the rating is five `<button type="button">` with `aria-label="1 star"` …
 *    `"5 stars"` (note the singular/plural switch);
 *  - a client guard blocks `rating < 1` with "Please select a star rating.";
 *  - name and message carry the native `required` attribute, so an empty submit is
 *    blocked by the browser, not by JS — assert via `checkValidity()`;
 *  - `POST /cms/testimonials/submit` is throttled to **5/min**, so specs using it
 *    must be `@serial` and sparing;
 *  - on success the form is REPLACED by a "Thank you!" card, so the inputs cease to
 *    exist rather than clearing.
 *
 * Because both `/` and `/testimonials` render one, locators are scoped to a root
 * that the caller supplies when a page could contain two.
 */
export class TestimonialFormComponent {
  private readonly root: Locator;

  constructor(
    private readonly page: Page,
    root?: Locator,
  ) {
    this.root = root ?? page.getByTestId(tid.review.form);
  }

  get container(): Locator {
    return this.root;
  }

  get name(): Locator {
    return this.page.getByTestId(tid.review.name);
  }

  get role(): Locator {
    return this.page.getByTestId(tid.review.role);
  }

  get message(): Locator {
    return this.page.getByTestId(tid.review.message);
  }

  /** @param n 1-5. Accessible names are "1 star" then "2 stars"…"5 stars". */
  star(n: 1 | 2 | 3 | 4 | 5): Locator {
    return this.page.getByRole('button', { name: n === 1 ? '1 star' : `${n} stars` });
  }

  get submit(): Locator {
    return this.page.getByTestId(tid.review.submit);
  }

  get error(): Locator {
    return this.page.getByTestId(tid.review.error);
  }

  get success(): Locator {
    return this.page.getByTestId(tid.review.success);
  }

  async fill(values: { name: string; role?: string; message: string; rating?: 1 | 2 | 3 | 4 | 5 }): Promise<void> {
    await this.name.fill(values.name);
    if (values.role !== undefined) await this.role.fill(values.role);
    await this.message.fill(values.message);
    if (values.rating) await this.star(values.rating).click();
  }

  async submitForm(): Promise<void> {
    await this.submit.click();
  }

  /** Fill, submit, and wait for the form to be replaced by the thank-you card. */
  async submitReview(values: {
    name: string;
    role?: string;
    message: string;
    rating?: 1 | 2 | 3 | 4 | 5;
  }): Promise<void> {
    await this.fill({ rating: 5, ...values });
    await this.submitForm();
    await this.expectSuccess();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.success).toBeVisible({ timeout: 20_000 });
    await expect(this.success).toContainText(messages.testimonialForm.thanksTitle);
    await expect(this.success).toContainText(messages.testimonialForm.thanksBody);
    // The form itself is gone, not merely cleared.
    await expect(this.name).toBeHidden();
  }

  async expectRatingRequired(): Promise<void> {
    await expect(this.error).toHaveText(messages.testimonialForm.ratingRequired);
  }

  /** Name and message rely on the native `required` attribute. */
  async expectNativeRequired(): Promise<void> {
    await expect(this.name).toHaveAttribute('required', '');
    await expect(this.message).toHaveAttribute('required', '');
  }
}
