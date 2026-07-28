import { test, expect } from '@fixtures/test';
import { paths } from '@config/urls';
import { anchorVendor } from '@data/seed-data';
import { canCompareScreenshots } from '@config/env';

/**
 * VIS — visual regression, deliberately conservative.
 *
 * Visual testing is the flakiest thing a suite can contain, so the scope is narrow on purpose
 * and the reasoning is recorded here rather than discovered later:
 *
 *  - **Component-scoped, never full-page.** A full-page baseline of `/` would diff on every
 *    content change, every seeded-data change and every streamed Suspense island settling a
 *    few milliseconds differently. It would be red constantly and would be ignored within a
 *    week.
 *  - **The WebGL canvas is masked everywhere.** `Hero3D` renders through SwiftShader with a
 *    continuous `useFrame` loop — it is nondeterministic by construction and can never be
 *    baselined.
 *  - **Remote images are replaced with a fixed 1x1 PNG**, not aborted. An aborted `<img>`
 *    renders the browser's broken-image glyph, which differs across platforms and would
 *    poison every baseline.
 *  - **Baselines are Linux-only.** Font rasterisation differs enough between macOS and Linux
 *    that a developer run would fail on every snapshot, so off-platform runs render and
 *    compare nothing (`ignoreSnapshots`). Baselines are refreshed by the
 *    `e2e-visual-baselines.yml` workflow.
 *
 * What is deliberately NOT baselined: the home page in full, the autoplaying Best Events
 * slider, anything containing a date or an animated counter, and the `Saved ✓` toast.
 */

test.describe('Visual - public components', () => {
  test.beforeEach(async ({ keepRemoteImages }) => {
    /** Deterministic placeholders instead of aborted requests — see the note above. */
    await keepRemoteImages();
  });

  test('VIS-V-01 the navbar renders consistently @smoke', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.navbar.expectVisible();
    await homePage.settle();

    await expect(homePage.navbar.root).toHaveScreenshot('navbar.png', {
      /** The theme and language toggles are hydration-dependent; the logo and links are not. */
      mask: [page.getByRole('button', { name: 'Toggle theme' })],
    });
  });

  test('VIS-V-02 the footer renders consistently', async ({ homePage, page }) => {
    await homePage.open();
    await homePage.footer.expectVisible();
    await homePage.footer.root.scrollIntoViewIfNeeded();
    await homePage.settle();

    await expect(homePage.footer.root).toHaveScreenshot('footer.png', {
      /** The copyright line contains the current year. */
      mask: [page.getByText(/©\s*\d{4}/)],
    });
  });

  test('VIS-V-09 a vendor card renders consistently @smoke', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await vendorsPage.expectContains(anchorVendor.slug);
    await vendorsPage.settle();

    /**
     * One card, not the grid: the grid's contents depend on global ordering and on whatever other
     * workers have created, so it is not a stable subject.
     */
    await expect(vendorsPage.card(anchorVendor.slug)).toHaveScreenshot('vendor-card.png');
  });

  test('VIS-V-14 the booking form renders consistently @smoke', async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.expectLoaded();
    await bookPage.settle();

    /**
     * The single most valuable visual baseline in the suite: nine fields, a wrapped consent
     * label and a full-width button, all pure CSS with no data dependency. A layout regression
     * here directly costs bookings.
     */
    await expect(bookPage.form).toHaveScreenshot('book-form.png');
  });

  test('VIS-V-15 the booking form error state renders consistently', async ({ bookPage }) => {
    await bookPage.open();
    await bookPage.submit();
    await bookPage.expectNameError();
    await bookPage.settle();

    await expect(bookPage.form).toHaveScreenshot('book-form-errors.png');
  });

  test('VIS-V-16 the login card renders consistently @smoke', async ({ loginPage, page }) => {
    await loginPage.open();
    await loginPage.expectLoaded();
    await loginPage.settle();

    await expect(loginPage.form).toHaveScreenshot('login-form.png', {
      /** The floating Hero3D canvas overlaps the card and is nondeterministic. */
      mask: [page.locator('canvas')],
    });
  });

  test('VIS-V-17 the public review form renders consistently', async ({ testimonialsPage }) => {
    await testimonialsPage.open();
    await testimonialsPage.form.container.scrollIntoViewIfNeeded();
    await testimonialsPage.settle();

    await expect(testimonialsPage.form.container).toHaveScreenshot('review-form.png');
  });

  test('VIS-V-18 the empty vendor listing state renders consistently', async ({ vendorsPage }) => {
    /** An empty state is pure markup with no data dependency, so it is an ideal subject. */
    await vendorsPage.openFiltered({ search: 'zzz-nothing-matches-this-zzz' });
    await vendorsPage.expectEmpty();
    await vendorsPage.settle();

    await expect(vendorsPage.emptyMessage).toHaveScreenshot('vendors-empty.png');
  });
});

test.describe('Visual - theme parity', () => {
  test('VIS-V-21 the booking form is legible in dark mode', async ({ browser, keepRemoteImages }) => {
    /**
     * The app defaults to dark, and a past bug had invisible text in a light-mode panel. Only ONE
     * component is baselined in both themes rather than the whole site — enough to catch a
     * palette regression without doubling the baseline count.
     */
    test.skip(!canCompareScreenshots(), 'visual baselines are committed for linux only');

    const context = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await context.addInitScript(() => {
      sessionStorage.setItem('utsava_launched', '1');
      localStorage.setItem('locale', 'en');
      localStorage.setItem('theme', 'dark');
    });
    void keepRemoteImages;

    await page.goto(paths.book, { waitUntil: 'domcontentloaded' });
    const form = page.getByTestId('book-form');
    await form.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(form).toHaveScreenshot('book-form-dark.png');
    await context.close();
  });
});

test.describe('Visual - deliberately not baselined', () => {
  test('VIS-V-skip the reasons the home page and slider are excluded', async () => {
    /**
     * Recorded as a test so the reasoning lives next to the baselines rather than in a commit
     * message nobody reads. If someone later adds a full-page home baseline, this is the note
     * explaining why it will not hold.
     */
    test.info().annotations.push({
      type: 'note',
      description: [
        'Not baselined, with reasons:',
        '- Full-page / : nine streamed Suspense islands, four animated counters and seeded content ' +
          'that changes with the fixture set. Would diff on every unrelated change.',
        '- BestEventsSlider: autoplays every 5000ms with 0.7s crossfades; static only under ' +
          'reduced-motion, and its slide selection depends on which vendor is currently featured.',
        '- Hero3D canvas: SwiftShader WebGL with a continuous useFrame loop. Nondeterministic by ' +
          'construction; masked wherever it overlaps a baselined component.',
        '- Saved ✓ toasts: removed by a 2000ms setTimeout, so capture timing decides the result.',
        '- Admin tables: row content is whatever the shared database currently holds.',
      ].join('\n'),
    });
    test.skip(true, 'documentation-only case — see the annotation for what is excluded and why');
  });
});
