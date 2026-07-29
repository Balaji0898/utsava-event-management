import { test, expect, serial } from '@fixtures/test';
import { apiPaths, apiRoute } from '@config/urls';
import { messages } from '@data/test-data';

/**
 * JOURNEY — review moderation. The most valuable end-to-end path in the application,
 * because it is the only one that crosses both actors and both trust boundaries.
 *
 *   a visitor submits a review, unauthenticated
 *     → it is ABSENT from every public page (approved: false)
 *     → it appears in the admin moderation queue
 *     → an admin approves it
 *     → it becomes publicly visible
 *
 * Each arrow is a separate mechanism that could break independently: the public POST, the
 * `approved` default, the public read filter, the `?all=true` admin gate, the PATCH, and
 * Next's 300-second data cache. A unit test on any one of them proves nothing about the
 * flow.
 *
 * Serial: `POST /cms/testimonials/submit` is throttled to 5/min, and the specs read a
 * shared public list.
 */
serial();

test.describe('Journey - review moderation', () => {
  test('JOURNEY-01 a public submission stays invisible until an admin approves it @smoke', async ({
    page,
    testimonialsPage,
    cmsPage,
    api,
    factory,
  }) => {
    const reviewerName = factory.name('Moderation Journey');
    const reviewText = 'Submitted by the E2E moderation journey.';

    // ---------------------------------------------------------------- 1. submit
    await testimonialsPage.open();
    await testimonialsPage.form.submitReview({ name: reviewerName, role: 'Bride', message: reviewText, rating: 5 });

    /** The form is replaced, not cleared — that is the app's success signal. */
    await expect(page.getByTestId('review-success')).toContainText(messages.testimonialForm.thanksTitle);

    // ------------------------------------------------- 2. absent from the public site
    /**
     * `reloadFresh` busts the `unstable_cache` first. Without it a cached page could show
     * "absent" for a reason unrelated to moderation, and the test would pass vacuously.
     */
    await testimonialsPage.reloadFresh('cms');
    await testimonialsPage.expectDoesNotContain(reviewerName);

    /** And absent from the home page carousel too, which reads the same endpoint. */
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(reviewerName, { exact: false })).toHaveCount(0);

    // ----------------------------------------------- 3. present in the admin queue
    const queue = await api.json<{ id: string; name: string; approved: boolean }[]>(
      apiPaths.cms.testimonialsAll,
    );
    const submitted = queue.find((t) => t.name === reviewerName);
    expect(submitted, 'the submission must reach the moderation queue').toBeTruthy();
    expect(submitted?.approved, 'a public submission must default to unapproved').toBe(false);

    await cmsPage.open();
    await cmsPage.openTab('testimonials');
    await cmsPage.expectPending(submitted!.id);

    // ------------------------------------------------------------- 4. approve it
    await cmsPage.approveTestimonial(submitted!.id);
    await cmsPage.expectPublished(submitted!.id);

    // ------------------------------------------------- 5. now publicly visible
    await testimonialsPage.reloadFresh('cms');
    await testimonialsPage.expectContains(reviewerName);

    /** Clean up: the factory did not create this record, the browser did. */
    await api.delete(apiPaths.cms.testimonial(submitted!.id));
  });

  test('JOURNEY-02 rejecting a submission removes it permanently', async ({
    testimonialsPage,
    cmsPage,
    api,
    factory,
  }) => {
    /**
     * "Reject" is a DELETE behind `confirm('Delete testimonial?')`, not a status flip — so a
     * rejected review is unrecoverable, with no audit trail. Worth encoding, because the button
     * label suggests a reversible moderation decision.
     */
    const reviewerName = factory.name('Rejection Journey');

    await testimonialsPage.open();
    await testimonialsPage.form.submitReview({ name: reviewerName, message: 'Please reject me.', rating: 4 });

    const queue = await api.json<{ id: string; name: string }[]>(apiPaths.cms.testimonialsAll);
    const submitted = queue.find((t) => t.name === reviewerName);
    expect(submitted).toBeTruthy();

    await cmsPage.open();
    await cmsPage.openTab('testimonials');
    await cmsPage.rejectTestimonial(submitted!.id);

    /** Gone from the database entirely, not merely hidden. */
    const after = await api.json<{ id: string }[]>(apiPaths.cms.testimonialsAll);
    expect(after.some((t) => t.id === submitted!.id), 'a rejected review is hard-deleted').toBe(false);

    await testimonialsPage.reloadFresh('cms');
    await testimonialsPage.expectDoesNotContain(reviewerName);
  });

  test('JOURNEY-S-01 a submission cannot self-approve through the browser', async ({
    page,
    testimonialsPage,
    api,
    factory,
  }) => {
    /**
     * The UI half of API-VAL-S-01. Intercepts the outgoing request and injects
     * `approved: true` — the shape an attacker would craft with devtools open. `whitelist: true`
     * must strip it, because otherwise any visitor could publish arbitrary text on the home
     * page with no moderation at all.
     */
    const reviewerName = factory.name('Self Approve Attempt');

    await page.route(apiRoute('/cms/testimonials/submit'), async (route) => {
      const original = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue({
        postData: JSON.stringify({ ...original, approved: true, status: 'ACTIVE' }),
      });
    });

    await testimonialsPage.open();
    await testimonialsPage.form.submitReview({ name: reviewerName, message: 'Bypassing moderation.', rating: 5 });

    const queue = await api.json<{ id: string; name: string; approved: boolean }[]>(
      apiPaths.cms.testimonialsAll,
    );
    const submitted = queue.find((t) => t.name === reviewerName);
    expect(submitted, 'the submission should still be recorded').toBeTruthy();
    expect(submitted?.approved, 'approved must be stripped from a public submission').toBe(false);

    await testimonialsPage.reloadFresh('cms');
    await testimonialsPage.expectDoesNotContain(reviewerName);

    await api.delete(apiPaths.cms.testimonial(submitted!.id));
  });

  test('TEST-N-01 a review with no star rating is blocked client-side @smoke', async ({ testimonialsPage }) => {
    await testimonialsPage.open();
    await testimonialsPage.form.fill({ name: 'No Rating', message: 'I forgot to pick stars.' });
    await testimonialsPage.form.submitForm();

    await testimonialsPage.form.expectRatingRequired();
  });

  test('TEST-N-02 name and message rely on native required validation', async ({ testimonialsPage }) => {
    /**
     * There is no zod here — the browser enforces it. So an empty submit is blocked by
     * `checkValidity()` rather than by a rendered message, which is a different (and less
     * accessible) experience from the booking form.
     */
    await testimonialsPage.open();
    await testimonialsPage.form.expectNativeRequired();

    await testimonialsPage.form.star(5).click();
    await testimonialsPage.form.submitForm();

    await expect(testimonialsPage.form.success).toHaveCount(0);
  });
});
