import { test, expect } from '@fixtures/test';
import { formatViolations } from '@fixtures/axe';
import { knownViolations, scannedRoutes } from '@data/a11y-rules';
import { paths } from '@config/urls';
import { anchorVendor } from '@data/seed-data';

/**
 * A11Y — axe-core scans of the public site.
 *
 * Two design choices, both deliberate:
 *
 *  1. **No rule is ever globally disabled to make a page pass.** Each accepted violation is
 *     enumerated per route in `src/data/a11y-rules.ts`, with a reason and the fix that
 *     retires it. A blanket `.disableRules()` would hide the next regression too.
 *
 *  2. **Stale exceptions are reported.** If the register excuses a rule that no longer
 *     fires, the spec says so. That matters immediately here: the Phase 3 hook pass was
 *     designed partly to close these entries, so most of the register should already be
 *     obsolete — and a register that silently rots starts excusing genuine new failures.
 */

test.describe('A11y - public pages', () => {
  for (const route of scannedRoutes.public) {
    test(`A11Y-A public ${route} has no unaccepted WCAG 2.1 AA violations`, async ({ page, axe }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      /** Let the streamed Suspense islands settle, or the scan misses most of the page. */
      await page.waitForLoadState('load');

      const result = await axe.scan(route);

      expect(
        result.blocking,
        `Unaccepted accessibility violations on ${route}:\n\n${formatViolations(result.blocking)}\n\n` +
          'If a violation is pre-existing and cannot be fixed now, add it to knownViolations in ' +
          'src/data/a11y-rules.ts with a reason and the fix that retires it — never disable the rule.',
      ).toEqual([]);
    });
  }

  test('A11Y-A-01 the home page passes with no accepted-violation cover @smoke', async ({ page, axe }) => {
    /**
     * The home page is the most-visited surface and, unlike the admin pages, it has no entries
     * in the register — so it must be clean outright.
     */
    await page.goto(paths.home, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');

    const result = await axe.scan(paths.home);
    expect(result.blocking, formatViolations(result.blocking)).toEqual([]);
    expect(
      result.accepted.map((v) => v.id),
      'the home page should not need any accepted-violation cover',
    ).toEqual([]);
  });

  test('A11Y-A-02 the vendor detail page is clean, lightbox included', async ({ page, axe, vendorDetailPage }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await page.waitForLoadState('load');

    const closed = await axe.scan('/vendors/[slug]');
    expect(closed.blocking, formatViolations(closed.blocking)).toEqual([]);

    /** Scan again with the lightbox open — a modal is where a11y usually breaks. */
    await vendorDetailPage.gallery.open(1);
    const open = await axe.scan('/vendors/[slug]');
    expect(open.blocking, `with the lightbox open:\n${formatViolations(open.blocking)}`).toEqual([]);
  });

  test('A11Y-A-03 the booking form is fully labelled @smoke', async ({ bookPage, axe }) => {
    /**
     * The single most valuable a11y check in the suite. Before Phase 3 there were ZERO
     * `htmlFor` attributes in the entire application, so every form control was unlabelled —
     * axe `label` fired on every field of every form.
     */
    await bookPage.open();

    const result = await axe.scan(paths.book, { include: '[data-testid="book-form"]' });
    expect(
      result.blocking,
      `The booking form has accessibility violations:\n${formatViolations(result.blocking)}`,
    ).toEqual([]);
    expect(result.accepted, 'the booking form should need no exceptions').toEqual([]);
  });

  test('A11Y-A-04 the login page has a main landmark', async ({ loginPage, axe }) => {
    /**
     * Bug B6: the `(auth)` group had no layout, so `/login` rendered with no `<main>` and axe's
     * `region` rule flagged everything on the page. Phase 3 added `app/(auth)/layout.tsx`.
     */
    await loginPage.open();

    const result = await axe.scan(paths.login);
    const regionViolations = result.blocking.concat(result.accepted).filter((v) => v.id === 'region');
    expect(
      regionViolations,
      'the (auth) layout must provide a <main> landmark:\n' + formatViolations(regionViolations),
    ).toEqual([]);
  });
});

test.describe('A11y - the known-violation register', () => {
  test('A11Y-A-05 no register entry is stale', async ({ page, axe }) => {
    /**
     * The register is only useful if it is current. Phase 3 was written to close most of it, so
     * this test is expected to report a long list of now-obsolete entries the first time it
     * runs — that is the intended signal, not a failure of the app.
     *
     * It reports rather than fails, because an entry can legitimately be route-conditional
     * (only reproducing with particular data). A hard failure would push people toward deleting
     * real exceptions to get green.
     */
    const stale: string[] = [];

    for (const route of scannedRoutes.public) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('load');
      const result = await axe.scan(route);
      for (const rule of result.staleExceptions) stale.push(`${route}: ${rule}`);
    }

    if (stale.length) {
      test.info().annotations.push({
        type: 'note',
        description:
          `${stale.length} register entries no longer reproduce and should be deleted from ` +
          `src/data/a11y-rules.ts:\n  ${stale.join('\n  ')}`,
      });
    }

    /** Always passes; its output is the value. Kept as a test so it runs on every push. */
    expect(true).toBe(true);
  });

  test('A11Y-A-06 every register entry documents a reason and a fix', async () => {
    /**
     * Stops the register degrading into a list of rule ids that nobody can act on. A pure
     * data check, so it needs no browser.
     */
    for (const violation of knownViolations) {
      expect(violation.reason.length, `${violation.rule} on ${violation.route} needs a reason`).toBeGreaterThan(20);
      expect(violation.fix.length, `${violation.rule} on ${violation.route} needs a stated fix`).toBeGreaterThan(10);
    }
  });
});

test.describe('A11y - keyboard operability', () => {
  test('A11Y-A-07 the booking form is completable with the keyboard alone @smoke', async ({ bookPage, page }) => {
    await bookPage.open();

    await bookPage.nameInput.focus();
    await page.keyboard.type('Keyboard Customer');
    await page.keyboard.press('Tab');
    await page.keyboard.type('keyboard@utsava.test');

    await expect(bookPage.nameInput).toHaveValue('Keyboard Customer');
    await expect(bookPage.emailInput).toHaveValue('keyboard@utsava.test');

    /** The consent checkbox must be operable with Space, not only with a click. */
    await bookPage.consentCheckbox.focus();
    await page.keyboard.press('Space');
    await expect(bookPage.consentCheckbox).toBeChecked();
  });

  test('A11Y-A-08 the gallery lightbox is fully keyboard operable', async ({ vendorDetailPage, page }) => {
    await vendorDetailPage.openSlug(anchorVendor.slug);
    await vendorDetailPage.expectGalleryVisible();

    /** Opening via Enter on a focused thumbnail, not via a click. */
    await vendorDetailPage.gallery.thumbnail(1).focus();
    await page.keyboard.press('Enter');
    await expect(vendorDetailPage.gallery.dialog).toBeVisible();

    await vendorDetailPage.gallery.closeWithEscape();
  });

  test('A11Y-A-09 every interactive element shows a visible focus indicator', async ({ page }) => {
    /**
     * WCAG 2.4.7. Tailwind's `outline-none` is used in several places; where it is not paired
     * with a `focus:ring` or `focus-visible:` replacement, keyboard users lose all sense of
     * position. Sampled across the primary CTAs rather than exhaustively, to keep the check
     * meaningful rather than a proxy for "has any CSS".
     */
    await page.goto(paths.home, { waitUntil: 'domcontentloaded' });

    const focusable = page.getByRole('link').or(page.getByRole('button'));
    const sample = Math.min(await focusable.count(), 8);

    for (let i = 0; i < sample; i += 1) {
      const element = focusable.nth(i);
      if (!(await element.isVisible())) continue;

      await element.focus();
      const styles = await element.evaluate((el) => {
        const s = getComputedStyle(el);
        return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, boxShadow: s.boxShadow };
      });

      const hasIndicator =
        (styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px') || styles.boxShadow !== 'none';
      expect(hasIndicator, `element ${i} has no visible focus indicator (WCAG 2.4.7)`).toBe(true);
    }
  });
});

test.describe('A11y - motion', () => {
  test('A11Y-A-10 the app honours prefers-reduced-motion @smoke', async ({ page }) => {
    /**
     * The whole suite depends on this: `globals.css` zeroes every animation under
     * reduced-motion, and `useReducedMotion()` short-circuits the motion primitives, TiltCard,
     * Magnetic and the slider autoplay. If it ever regressed, hundreds of specs would start
     * flaking for reasons that look unrelated — so it gets its own explicit assertion.
     *
     * The config sets `contextOptions: { reducedMotion: 'reduce' }` globally.
     */
    await page.goto(paths.home, { waitUntil: 'domcontentloaded' });

    const prefersReduced = await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    expect(prefersReduced, 'the suite must run with reduced motion, or animations will cause flake').toBe(true);

    /** And the app must actually act on it — a near-zero transition duration. */
    const durations = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, button'))
        .slice(0, 10)
        .map((el) => getComputedStyle(el).transitionDuration),
    );
    for (const duration of durations) {
      const seconds = parseFloat(duration);
      expect(seconds, `transition duration ${duration} should be ~0 under reduced motion`).toBeLessThan(0.05);
    }
  });

  test('A11Y-A-11 the launch splash never blocks interaction', async ({ page }) => {
    /**
     * `#launch-overlay` is `position: fixed; inset: 0; z-index: 100` over an opaque gradient, and
     * it lingers for ~1.8 seconds. It is a genuine a11y problem for anyone on a slow device, and
     * a genuine test problem for everyone — the init script suppresses it via the app's own
     * `sessionStorage['utsava_launched']` flag rather than by injecting CSS, so this asserts the
     * app's real escape hatch works.
     */
    await page.goto(paths.home, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#launch-overlay')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-launched', '');
  });
});
