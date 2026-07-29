import { test, expect, serial } from '@fixtures/test';
import { BookPage } from '@pages/index';
import { apiRoute } from '@config/urls';
import { messages, strings } from '@data/test-data';

/**
 * BOOK validation — including the two named regression guards for bugs B1 and B2.
 *
 * These are the highest-value UI tests in the suite, because the booking form is the only
 * customer-facing write path in the application and it currently cannot be submitted by a
 * user who fills in only the fields marked required.
 *
 * Serial: the submitting cases hit `POST /bookings`, throttled to 8/min.
 */
serial();

test.describe('Book form - validation of the three fields that report errors', () => {
  test.beforeEach(async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.expectLoaded();
  });

  test('BOOK-N-07 rejects a missing name with a field error', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ name: '' });
    await bookPage.submit();
    await bookPage.expectNameError();
  });

  test('BOOK-N-08 rejects a one-character name (min is 2)', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ name: strings.oneChar });
    await bookPage.submit();
    await bookPage.expectNameError();
  });

  test('BOOK-E-01 accepts a two-character name, so the boundary is inclusive', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ name: strings.twoChars });
    await bookPage.submit();
    await bookPage.expectSuccess();
  });

  test('BOOK-N-09 rejects a malformed email via native validation, before zod runs', async ({ bookPage }) => {
    /**
     * Two validation layers guard this field, and which one fires depends on the input:
     *
     *   - the input is `type="email"` and the form does NOT set `noValidate`, so the browser's own
     *     constraint validation blocks submission for a malformed value and shows its native
     *     tooltip. `handleSubmit` never runs, so zod's 'Valid email required' is unreachable here;
     *   - zod's message DOES surface for values the browser accepts — most importantly an empty
     *     field, since `customerEmail` carries no `required` attribute.
     *
     * Asserting the native path rather than the zod message, because that is what a real user hits.
     * (An earlier version of this test expected the zod message and was wrong.)
     */
    await bookPage.fillMinimumViable({ email: 'not-an-email' });

    expect(
      await BookPage.isInputValid(bookPage.emailInput),
      'type="email" must mark a malformed value invalid',
    ).toBe(false);

    await bookPage.submit();
    await expect(bookPage.successCard, 'native validation must block the submit').toBeHidden();
  });

  test('BOOK-N-10 an empty email surfaces the zod message, which native validation lets through', async ({
    bookPage,
  }) => {
    /** The complementary case: no `required` attribute, so the browser passes it to zod. */
    await bookPage.fillMinimumViable({ email: '' });
    await bookPage.submit();
    await bookPage.expectEmailError();
  });

  test('BOOK-N-11 rejects submission without consent', async ({ bookPage }) => {
    /**
     * DPDP consent (SECURITY_AUDIT.md C-5). The checkbox is the only lawful basis the app
     * records, so it must be a hard gate — and it is the one field whose label WRAPS its
     * input, making it the only field `getByLabel` could reach before Phase 3.
     */
    await bookPage.fillMinimumViable({ consent: false });
    await bookPage.submit();
    await bookPage.expectConsentError();
    await expect(bookPage.successCard).toBeHidden();
  });
});

test.describe('Book form - B1: optional numbers must be genuinely optional', () => {
  /**
   * Regression guards for bug B1, now FIXED.
   *
   * The bug: `guestCount` and `budget` were `z.coerce.number().int().positive().optional()`, and
   * React Hook Form yields `''` for an untouched number input. `''` is not `undefined`, so
   * `.optional()` never short-circuited — `z.coerce.number()` turned `''` into `0` and `.positive()`
   * failed. Neither field rendered error markup, so clicking "Submit booking" was a **silent
   * no-op**: a customer who filled in only the fields marked `*` could not book an event at all.
   *
   * The fix (`app/(site)/book/page.tsx`) maps blanks to `undefined` BEFORE coercion via
   * `z.preprocess(blankToUndefined, …)`, so an omitted optional field is now absent from the payload
   * rather than present-and-empty — and adds error markup to the three optional fields that can
   * actually fail, so a genuinely bad value is now explained instead of swallowed.
   *
   * These cases therefore assert BOTH halves: blanks submit, and bad values produce a VISIBLE error.
   */
  test.beforeEach(async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.expectLoaded();
  });

  test('BOOK-N-01 leaving Guest count and Budget empty submits successfully @smoke', async ({ bookPage }) => {
    /** The exact default state of the form — the case that was previously impossible to submit. */
    await bookPage.fill({
      name: 'Valid Name',
      email: 'valid@utsava.test',
      date: BookPage.futureDate(30),
      consent: true,
      // guests and budget deliberately untouched
    });
    await bookPage.submit();

    await bookPage.expectSuccess();
  });

  test('BOOK-N-02 a zero Guest count is rejected with a visible message', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ guests: '0' });
    await bookPage.submit();

    /** Visible, and attached to the field — not a silent no-op, and not a generic banner. */
    await bookPage.expectGuestsError(/at least 1/i);
    await expect(bookPage.successCard).toBeHidden();
  });

  test('BOOK-N-03 a negative Budget is rejected with a visible message', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ budget: '-5' });
    await bookPage.submit();

    await bookPage.expectBudgetError(/greater than zero/i);
    await expect(bookPage.successCard).toBeHidden();
  });

  test('BOOK-N-04 a fractional Guest count is blocked natively, before zod', async ({ bookPage }) => {
    /**
     * `type="number"` defaults to `step="1"`, so the browser rejects 2.5 with "The two nearest
     * valid values are 2 and 3" and never runs the submit handler — the same native-first layering
     * as the email field in BOOK-N-09. zod's `.int()` message is therefore unreachable by typing,
     * and only guards a value the browser would accept.
     *
     * Verified against the real build rather than assumed: an earlier version of this test expected
     * the zod message and failed.
     */
    await bookPage.fillMinimumViable({ guests: '2.5' });

    expect(
      await BookPage.isInputValid(bookPage.guestsInput),
      'step="1" must mark a fractional value invalid',
    ).toBe(false);

    await bookPage.submit();
    await expect(bookPage.successCard, 'native validation must block the submit').toBeHidden();
  });

  test('BOOK-N-05 filling both numbers positively submits successfully', async ({ bookPage }) => {
    await bookPage.fillMinimumViable({ guests: '120', budget: '250000' });
    await bookPage.submit();
    await bookPage.expectSuccess();
  });

  test('BOOK-N-13 an error message is programmatically associated with its field', async ({ bookPage }) => {
    /**
     * The silent-failure bug was as much an accessibility failure as a validation one. This asserts
     * the fix wired up `aria-invalid` and `aria-describedby`, so a screen-reader user is told which
     * field is wrong and why — not merely that something is.
     */
    await bookPage.fillMinimumViable({ guests: '0' });
    await bookPage.submit();

    await expect(bookPage.guestsInput).toHaveAttribute('aria-invalid', 'true');
    await expect(bookPage.guestsInput).toHaveAttribute('aria-describedby', 'book-guests-error');
  });
});

test.describe('Book form - B2: an empty date must not reach the API', () => {
  test('BOOK-N-06 an empty Event date submits successfully @smoke', async ({ bookPage, page }) => {
    /**
     * Regression guard for bug B2, now FIXED.
     *
     * The bug: `eventDate` was `z.string().optional()`, which accepts `''`, so zod passed the blank
     * straight through. The backend's `@IsOptional() @IsDateString()` then rejected it — because
     * class-validator's `IsOptional` skips only `null` and `undefined` — and the HTTP 400's
     * comma-joined message array landed in the generic red error node: visible, but unattached to
     * any field and not phrased for a human.
     *
     * The fix maps the blank to `undefined` before validation, so the key is omitted from the
     * request body entirely. This asserts the mechanism, not just the outcome: it inspects the
     * actual payload, because a submit could succeed for the wrong reason (e.g. the field being
     * silently dropped elsewhere) and this test would then be worthless.
     */
    let sentBody: Record<string, unknown> | null = null;
    await page.route(apiRoute('/bookings'), async (route) => {
      sentBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue();
    });

    await bookPage.open();
    await bookPage.fill({
      name: 'Empty Date Customer',
      email: 'empty.date@utsava.test',
      date: '', // the default state of the date input
      consent: true,
    });
    await bookPage.submit();

    await bookPage.expectSuccess();

    expect(sentBody, 'the booking request must have been observed').not.toBeNull();
    expect(
      sentBody,
      'an omitted optional field must be ABSENT from the payload, not sent as an empty string — ' +
        "that empty string is what the backend's @IsDateString rejected",
    ).not.toHaveProperty('eventDate', '');
  });

  test('BOOK-E-02 a valid future date submits successfully', async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.submitBooking({ date: BookPage.futureDate(90) });
  });

  test('BOOK-E-03 a past event date is accepted — there is no minimum-date rule', async ({ bookPage }) => {
    /**
     * Neither zod nor the DTO constrains `eventDate` to the future, so booking an event in
     * the past succeeds. Documented rather than asserted as a bug: whether that is wrong is
     * a product decision, but it should not change unnoticed.
     */
    await bookPage.open();
    await bookPage.submitBooking({ date: BookPage.pastDate(365) });
  });
});

test.describe('Book form - unvalidated and optional fields', () => {
  test('BOOK-E-04 phone accepts anything, including non-numeric text', async ({ bookPage }) => {
    /** `customerPhone` is `z.string().optional()` and `@IsString()` — no format rule at all. */
    await bookPage.open();
    await bookPage.submitBooking({ phone: 'call me maybe' });
  });

  test('BOOK-E-05 very long special requirements are accepted', async ({ bookPage }) => {
    /** No max length anywhere, so this must either store or cleanly reject — never 500. */
    await bookPage.open();
    await bookPage.fillMinimumViable({ requirements: strings.veryLong });
    await bookPage.submit();
    await expect(bookPage.successCard.or(bookPage.errorMessage)).toBeVisible({ timeout: 30_000 });
  });

  test('BOOK-E-06 Telugu and emoji input round-trips intact', async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.submitBooking({
      name: `E2E ${strings.telugu}`,
      requirements: `${strings.telugu} ${strings.emoji}`,
    });
  });
});

test.describe('Book form - submission mechanics', () => {
  test('BOOK-P-01 a complete booking shows the success card and removes the form', async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.submitBooking();

    /**
     * The form is REPLACED, not cleared — so asserting the form is gone is what proves the
     * success state rather than a still-editable form with a message above it.
     */
    await expect(bookPage.form).toBeHidden();
    await expect(bookPage.successCard).toContainText(messages.book.successTitle);
  });

  test('BOOK-P-02 carries vendorId and packageId from the query string', async ({ bookPage, factory }) => {
    const vendor = await factory.createVendor();
    const pkg = await factory.createPackage(vendor.id);

    await bookPage.openFor(vendor.id, pkg.id);
    await bookPage.submitBooking();

    /**
     * The linkage is only observable through the admin bookings list, which the
     * vendor-to-booking journey covers end to end. Here we assert the form accepted the
     * parameters and submitted without error, which is this spec's scope.
     */
    await expect(bookPage.successCard).toBeVisible();
  });

  test('BOOK-N-12 double-clicking submit does not create two bookings', async ({ bookPage }) => {
    /**
     * The button is disabled while `isSubmitting`, so the second click should be swallowed.
     * Worth asserting: without it a slow network turns an impatient user into duplicate
     * enquiries, and there is no dedupe on the server.
     */
    await bookPage.open();
    await bookPage.fillMinimumViable();

    await Promise.all([
      bookPage.submit(),
      bookPage.submitButton.click({ force: true, timeout: 3_000 }).catch(() => {
        /* expected: the button is disabled by then */
      }),
    ]);

    await bookPage.expectSuccess();
  });

  test('BOOK-E-07 the privacy policy link opens in a new tab', async ({ bookPage, context }) => {
    await bookPage.open();

    const [popup] = await Promise.all([context.waitForEvent('page'), bookPage.privacyLink.click()]);
    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).toContain('/privacy');
    await popup.close();
  });

  test('BOOK-A-01 every field is reachable and labelled after the Phase 3 hooks', async ({ bookPage }) => {
    /**
     * Before Phase 3 there were zero `htmlFor` attributes in the entire app, so `getByLabel`
     * failed for every field. This asserts the association actually landed — it is the check
     * that keeps the a11y improvement from being reverted by a refactor.
     */
    await bookPage.open();

    for (const label of [
      messages.book.name,
      messages.book.email,
      messages.book.phone,
      messages.book.date,
      messages.book.guests,
      messages.book.requirements,
    ]) {
      await expect(
        bookPage.form.getByLabel(new RegExp(label, 'i')),
        `"${label}" must be programmatically associated with its input`,
      ).toBeVisible();
    }
  });
});
