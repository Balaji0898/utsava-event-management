import { test, expect } from '@fixtures/test';
import { Axe, formatViolations } from '@fixtures/axe';
import { scannedRoutes } from '@data/a11y-rules';

/**
 * A11Y — axe-core scans of the admin dashboard.
 *
 * Separate from the public scans because these need the authenticated `adminPage`, and because
 * the admin surfaces carry most of the register: the icon-only destructive buttons, the
 * unlabelled booking-status select, the missing `<main>` landmark and the un-focusable table
 * scroll containers all lived here. The Phase 3 pass targeted exactly those, so the register
 * entries for admin routes should now be obsolete.
 */

test.describe('A11y - admin pages', () => {
  for (const route of scannedRoutes.admin) {
    test(`A11Y-A admin ${route} has no unaccepted WCAG 2.1 AA violations`, async ({ adminPage }) => {
      /**
       * A fresh `Axe` bound to the ADMIN page rather than the default `page`. The `axe` fixture
       * targets the anonymous context, which would bounce straight to /login here.
       */
      const axe = new Axe(adminPage);

      await adminPage.goto(route, { waitUntil: 'domcontentloaded' });
      await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });
      await adminPage.waitForLoadState('load');

      const result = await axe.scan(route);

      expect(
        result.blocking,
        `Unaccepted accessibility violations on ${route}:\n\n${formatViolations(result.blocking)}\n\n` +
          'Add a justified entry to knownViolations in src/data/a11y-rules.ts if it cannot be fixed now.',
      ).toEqual([]);
    });
  }

  test('A11Y-A-12 the admin shell provides a main landmark @smoke', async ({ adminPage }) => {
    /**
     * Bug B6. `app/admin/layout.tsx` wrapped its children in a plain `<div className="p-6">`, so
     * every admin page failed axe `region` and offered no way to skip the sidebar. Phase 3 made
     * it a `<main>`.
     */
    await adminPage.goto('/admin', { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

    await expect(adminPage.locator('main')).toBeVisible();
    await expect(adminPage.getByRole('complementary', { name: /admin navigation/i })).toBeVisible();
  });

  test('A11Y-A-13 every destructive icon button has an accessible name @smoke', async ({
    adminPage,
    factory,
  }) => {
    /**
     * Bug B4. Five icon-only destructive controls shipped with no accessible name at all — the
     * published-testimonial trash, the FAQ trash, the package trash, and both uploader remove
     * buttons. A screen-reader user heard "button" and had no idea it would delete their content.
     *
     * Phase 3 gave each one a name that includes WHAT it deletes, so this asserts more than mere
     * presence: it asserts the name is specific.
     */
    const faq = await factory.createFaq();
    const testimonial = await factory.createTestimonial({ approved: true });

    await adminPage.goto('/admin/cms', { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

    /** The published testimonial's delete control. */
    const deleteTestimonial = adminPage.getByTestId(`cms-testimonial-delete-${testimonial.id}`);
    await expect(deleteTestimonial).toHaveAttribute('aria-label', /delete review by/i);

    await adminPage.getByTestId('cms-tab-faqs').click();
    const deleteFaq = adminPage.getByTestId(`cms-faq-delete-${faq.id}`);
    await expect(deleteFaq).toHaveAttribute('aria-label', /delete faq/i);
  });

  test('A11Y-A-14 CMS tabs expose tab semantics and selection state', async ({ adminPage }) => {
    await adminPage.goto('/admin/cms', { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

    await expect(adminPage.getByTestId('cms-tabs')).toHaveAttribute('role', 'tablist');

    const tabs = adminPage.getByRole('tab');
    expect(await tabs.count(), 'all five CMS tabs must be real tabs').toBe(5);

    /** Exactly one selected at a time — the property that makes a tablist usable. */
    const selected = adminPage.locator('[role="tab"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
  });

  test('A11Y-A-15 admin tables are keyboard-scrollable', async ({ adminPage, factory }) => {
    /**
     * Bug B5. Both admin tables sit in an `overflow-x-auto` wrapper with a `min-w-[720px]` table
     * inside, so at any narrow width the content is horizontally scrollable — and without a
     * `tabIndex` a keyboard user cannot reach the scroll (axe `scrollable-region-focusable`).
     */
    await factory.createBooking();

    for (const route of ['/admin/vendors', '/admin/bookings']) {
      await adminPage.goto(route, { waitUntil: 'domcontentloaded' });
      await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

      const scrollRegion = adminPage.getByRole('group', { name: /table/i });
      await expect(scrollRegion, `${route} scroll container must be focusable`).toHaveAttribute('tabindex', '0');
    }
  });

  test('A11Y-A-16 the departments edit modal does not trap focus (documented gap)', async ({
    adminPage,
    factory,
  }) => {
    /**
     * Phase 3 gave this modal `role="dialog"` and `aria-modal="true"`, which is a real
     * improvement — but `aria-modal` PROMISES focus containment that the component does not
     * implement, so Tab still walks out into the page behind. Arguably the role made this worse
     * by advertising a behaviour that is absent.
     *
     * Asserted as the correct behaviour and marked expected-fail, so implementing a trap flips it
     * green and the annotation is deleted.
     */
    test.info().annotations.push({
      type: 'known-vulnerability',
      description:
        'A11Y — the departments edit modal declares aria-modal="true" without trapping focus, so Tab ' +
        'escapes to the page behind (WCAG 2.4.3). Owner: frontend/app/admin/departments/page.tsx.',
    });
    test.fail();

    const department = await factory.createDepartment();

    await adminPage.goto('/admin/departments', { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });
    await adminPage.getByTestId(`dept-row-edit-${department.id}`).click();
    await expect(adminPage.getByTestId('dept-modal')).toBeVisible();

    for (let i = 0; i < 15; i += 1) await adminPage.keyboard.press('Tab');

    const focusInsideModal = await adminPage.evaluate(() => {
      const modal = document.querySelector('[data-testid="dept-modal"]');
      return !!modal && !!document.activeElement && modal.contains(document.activeElement);
    });
    expect(focusInsideModal, 'focus must stay inside an aria-modal dialog').toBe(true);
  });

  test('A11Y-A-17 status badges convey meaning without relying on colour', async ({ adminPage, factory }) => {
    /**
     * WCAG 1.4.1. The booking status badges are colour-coded pills whose only other signal is the
     * status text itself — which is fine. Phase 3 additionally added `data-status`, so the state
     * is machine-readable for tests and for any future icon/pattern treatment.
     */
    const booking = await factory.createBooking();

    await adminPage.goto('/admin/bookings', { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

    const badge = adminPage.getByTestId(`booking-row-badge-${booking.id}`);
    await expect(badge).toHaveAttribute('data-status', 'PENDING');
    /** The text must be present too, so colour is never the sole carrier. */
    await expect(badge).toHaveText('PENDING');
  });
});
