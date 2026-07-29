import { expect, type Locator } from '@playwright/test';
import { SitePage } from '../site.page';
import { tid } from '@config/testids';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { LocationInputComponent } from '@components/location-input.component';

export type BookingFormValues = {
  name?: string;
  email?: string;
  phone?: string;
  /** `yyyy-mm-dd` — the input is `type="date"`. */
  date?: string;
  location?: string;
  guests?: string;
  budget?: string;
  requirements?: string;
  consent?: boolean;
};

/**
 * `/book` — the only customer-facing write path in the app.
 *
 * zod schema (`app/(site)/book/page.tsx:16-29`):
 *   customerName        min(2, 'Name is required')
 *   customerEmail       .email('Valid email required')
 *   customerPhone       optional
 *   eventDate           preprocess(blankToUndefined, string().optional()), input type="date"
 *   location            optional, controlled via watch/setValue by LocationInput
 *   guestCount          preprocess(blankToUndefined, coerce.number().int().positive().optional())
 *   budget              preprocess(blankToUndefined, coerce.number().positive().optional())
 *   specialRequirements optional
 *   consent             .refine(v === true, 'Please agree to the privacy policy to continue')
 *
 * The `z.preprocess(blankToUndefined, …)` wrappers are the fix for bugs B1 and B2, and the reason
 * this form is now submittable with only the required fields filled:
 *
 *   B1 — `guestCount`/`budget` were bare `z.coerce.number().positive().optional()`. RHF yields `''`
 *        for an untouched number input; `''` is not `undefined`, so `.optional()` never
 *        short-circuited, `z.coerce.number()` turned `''` into `0`, and `.positive()` failed. With
 *        no error node on either field, clicking "Submit booking" was a **silent no-op** — the form
 *        could not be submitted at all unless BOTH numbers were filled.
 *
 *   B2 — An empty Event date passed zod (`z.string().optional()` accepts `''`) and then failed the
 *        backend's `@IsOptional() @IsDateString()`, because class-validator's `IsOptional` skips
 *        only `null`/`undefined`. That surfaced as a raw HTTP 400.
 *
 * Both now map blanks to `undefined` before validation, so an omitted optional field is absent from
 * the payload rather than present-and-empty. Error markup was added for exactly those three fields
 * — `customerPhone`, `location` and `specialRequirements` are unconstrained optional strings and can
 * never produce an error, so markup there would be dead branches.
 *
 * The consent `<label>` WRAPS its checkbox, so `getByLabel` works for consent alone,
 * and it contains a `target="_blank"` link to `/privacy` — asserting that needs
 * `context.waitForEvent('page')`.
 *
 * `POST /bookings` is throttled to **8/min**, so submitting specs are `@serial`.
 */
export class BookPage extends SitePage {
  get path(): string {
    return paths.book;
  }

  readonly locationInput = new LocationInputComponent(this.page, this.page.getByTestId(tid.book.location));

  get form(): Locator {
    return this.testId(tid.book.form);
  }

  get nameInput(): Locator {
    return this.testId(tid.book.name);
  }

  get emailInput(): Locator {
    return this.testId(tid.book.email);
  }

  get phoneInput(): Locator {
    return this.testId(tid.book.phone);
  }

  get dateInput(): Locator {
    return this.testId(tid.book.date);
  }

  get guestsInput(): Locator {
    return this.testId(tid.book.guests);
  }

  get budgetInput(): Locator {
    return this.testId(tid.book.budget);
  }

  get requirementsInput(): Locator {
    return this.testId(tid.book.requirements);
  }

  get consentCheckbox(): Locator {
    return this.testId(tid.book.consent);
  }

  /** Opens in a new tab — capture it with `context.waitForEvent('page')`. */
  get privacyLink(): Locator {
    return this.testId(tid.book.privacyLink);
  }

  get submitButton(): Locator {
    return this.testId(tid.book.submit);
  }

  /** Server / API error node. Carries the backend message, comma-joined if an array. */
  get errorMessage(): Locator {
    return this.testId(tid.book.error);
  }

  /** On success the whole form is REPLACED by this card. */
  get successCard(): Locator {
    return this.testId(tid.book.success);
  }

  /**
   * Field-level zod errors, selected by their stable `id` (`book-name-error` and friends)
   * rather than by colour class — see the note in login.page.ts. `p.text-red-500` stopped
   * matching when the contrast fix restyled these paragraphs.
   */
  fieldError(text: string | RegExp): Locator {
    return this.form.locator('p[id$="-error"]').filter({ hasText: text });
  }

  // -------------------------------------------------------------------- actions

  /** Open the form pre-linked to a vendor and (optionally) a package. */
  async openFor(vendorId: string, packageId?: string): Promise<void> {
    await this.openRaw(paths.bookFor(vendorId, packageId));
    await expect(this.form).toBeVisible({ timeout: 30_000 });
  }

  async fill(values: BookingFormValues): Promise<void> {
    if (values.name !== undefined) await this.nameInput.fill(values.name);
    if (values.email !== undefined) await this.emailInput.fill(values.email);
    if (values.phone !== undefined) await this.phoneInput.fill(values.phone);
    if (values.date !== undefined) await this.dateInput.fill(values.date);
    if (values.location !== undefined) await this.locationInput.field.fill(values.location);
    if (values.guests !== undefined) await this.guestsInput.fill(values.guests);
    if (values.budget !== undefined) await this.budgetInput.fill(values.budget);
    if (values.requirements !== undefined) await this.requirementsInput.fill(values.requirements);
    if (values.consent) await this.consentCheckbox.check();
  }

  /**
   * The required fields, and only those.
   *
   * This used to carry workarounds for bugs B1 and B2 — it had to fill Guest count, Budget AND
   * Event date, none of which are required, because leaving any of them blank made the form
   * unsubmittable. Both are fixed, so "the required fields" and "what actually submits" are finally
   * the same set and this method can be honest about what the form demands.
   */
  async fillMinimumViable(overrides: BookingFormValues = {}): Promise<void> {
    await this.fill({
      name: 'E2E Booking Customer',
      email: 'booking@utsava.test',
      consent: true,
      ...overrides,
    });
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async submitBooking(overrides: BookingFormValues = {}): Promise<void> {
    await this.fillMinimumViable(overrides);
    await this.submit();
    await this.expectSuccess();
  }

  /** A `yyyy-mm-dd` string N days out. Timezone is pinned to Asia/Kolkata in config. */
  static futureDate(daysAhead = 30): string {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() + 365 + daysAhead);
    return d.toISOString().slice(0, 10);
  }

  static pastDate(daysBack = 30): string {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() - daysBack);
    return d.toISOString().slice(0, 10);
  }

  // ----------------------------------------------------------------- assertions

  /**
   * `BookForm` is a client component reading `useSearchParams`, so it lives inside a `<Suspense>`
   * and does not exist in the server HTML at all — only the "Loading…" fallback does.
   *
   * The generous timeout is deliberate. Two hydration mismatches used to make React discard the
   * server HTML and re-render the whole document, so this client-only subtree appeared only after
   * that recovery — intermittently missing even a 10s wait. Both are now fixed
   * (`app/layout.tsx`'s inline `<style>`, and `LocationInput`'s geolocate button), and `/book`
   * hydrates cleanly.
   *
   * A THIRD mismatch remains site-wide and is not fixed: `shared/motion/primitives.tsx` renders
   * `opacity:0; transform:translateY(32px)` on the server but skips it on the client when
   * `useReducedMotion()` is true, so `/` and `/vendors` still lose SSR for anyone with
   * prefers-reduced-motion — which includes this entire suite, since the config sets it globally.
   * The margin stays until that is addressed.
   */
  async expectLoaded(): Promise<void> {
    /**
     * The heading gets the same margin as the form. `next start` compiles a route lazily on its
     * first request, so the very first navigation to `/book` in a run can exceed the default 10s
     * expect timeout — which then reads as "the page is broken" rather than "the server was cold".
     */
    await expect(this.page.getByRole('heading', { name: messages.book.title, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.form).toBeVisible({ timeout: 30_000 });
  }

  async expectSuccess(): Promise<void> {
    await expect(this.successCard).toBeVisible({ timeout: 30_000 });
    await expect(this.successCard).toContainText(messages.book.successTitle);
    await expect(this.successCard).toContainText(messages.book.successBody);
    /** The form is gone, not cleared — assert that, so a stale form can't pass. */
    await expect(this.form).toBeHidden();
  }

  async expectApiError(text?: string | RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 30_000 });
    if (text) await expect(this.errorMessage).toContainText(text);
  }

  async expectNameError(): Promise<void> {
    await expect(this.fieldError(messages.book.errors.name)).toBeVisible();
  }

  async expectEmailError(): Promise<void> {
    await expect(this.fieldError(messages.book.errors.email)).toBeVisible();
  }

  async expectConsentError(): Promise<void> {
    await expect(this.fieldError(messages.book.errors.consent)).toBeVisible();
  }

  /** Field-scoped, so a message on a DIFFERENT field cannot satisfy the assertion. */
  async expectGuestsError(text: string | RegExp): Promise<void> {
    await expect(this.form.locator('#book-guests-error')).toBeVisible();
    await expect(this.form.locator('#book-guests-error')).toHaveText(text);
  }

  async expectBudgetError(text: string | RegExp): Promise<void> {
    await expect(this.form.locator('#book-budget-error')).toBeVisible();
    await expect(this.form.locator('#book-budget-error')).toHaveText(text);
  }

  async expectDateError(text?: string | RegExp): Promise<void> {
    await expect(this.form.locator('#book-date-error')).toBeVisible();
    if (text) await expect(this.form.locator('#book-date-error')).toHaveText(text);
  }

  /**
   * The old B1 signature: nothing at all happened — no success card, no error node, no
   * field error.
   *
   * Retained because asserting the ABSENCE of feedback is the right shape for any future
   * silent-failure regression, and two other forms still behave this way today: the
   * department create form's `if (!draft.name) return` and PackagesManager's
   * `if (!name || !price) return`. The booking specs no longer use it — they now assert a
   * visible, field-associated message instead.
   */
  async expectSilentValidationFailure(): Promise<void> {
    await expect(this.successCard).toBeHidden();
    await expect(this.errorMessage).toBeHidden();
    await expect(this.form).toBeVisible();
    await expect(this.submitButton).toBeEnabled();
  }
}
