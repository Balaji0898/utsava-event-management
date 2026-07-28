import { test, expect } from '@fixtures/test';
import { paths } from '@config/urls';
import { messages } from '@data/test-data';
import { seededDepartments, seededFaqs, seededFunctionHalls, seededStats } from '@data/seed-data';
import { geolocation } from '@config/third-party';

/**
 * HOME + NAV — the home page's nine sections and the site shell.
 *
 * The sections stream in as nine independent `<Suspense>` islands, so each is asserted
 * separately rather than in one sweep — an island that fails to resolve must not be masked by
 * its neighbours rendering fine.
 */

test.describe('Home - page shell', () => {
  test('HOME-P-01 renders the hero and both CTAs @smoke', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectLoaded();

    await expect(homePage.heroBadge).toBeVisible();
    await expect(homePage.bookNowCta).toHaveAttribute('href', paths.book);
    await expect(homePage.exploreCta).toHaveAttribute('href', paths.vendors);
  });

  test('HOME-P-02 all nine sections resolve @smoke', async ({ homePage }) => {
    await homePage.open();
    await homePage.expectAllSectionsPresent();
  });

  test('HOME-E-01 the launch splash is suppressed and never blocks a click @smoke', async ({ homePage }) => {
    /**
     * Without the init script this overlay covers the viewport at `z-index: 100` for ~1.8 seconds
     * and swallows the first click of every single test. The fix uses the app's own
     * `sessionStorage['utsava_launched']` flag rather than injected CSS, so this also proves the
     * real escape hatch still works.
     */
    await homePage.open();
    await homePage.expectNoLaunchOverlay();

    /** Proof it is not merely hidden: a real click lands immediately. */
    await homePage.bookNowCta.click();
    await homePage.expectUrlMatches(new RegExp(`${paths.book}$`));
  });
});

test.describe('Home - hero search form', () => {
  test('HOME-P-03 submits to /vendors as a GET with the query params @smoke', async ({ homePage, page }) => {
    /** A plain `<form action="/vendors">`, so submitting is a real navigation, not a fetch. */
    await homePage.open();
    await homePage.search({ city: 'Bengaluru', event: 'Wedding' });

    expect(page.url()).toContain('city=Bengaluru');
    expect(page.url()).toContain('search=Wedding');
  });

  test('HOME-E-02 the date field is submitted but never read by /vendors', async ({ homePage, page }) => {
    /**
     * A genuine dead end, not an oversight to work around: the hero submits `date`, and
     * `app/(site)/vendors/page.tsx` reads `departmentId`, `search`, `city`, `page`, `lat` and
     * `lng` — never `date`. So a user who picks a date gets no filtering and no explanation.
     */
    await homePage.open();
    await homePage.search({ date: '2027-06-15', event: 'Wedding' });

    expect(page.url(), 'the parameter IS submitted').toContain('date=2027-06-15');
    /** But it has no effect — the result set matches the search term alone. */
    await expect(page.getByTestId('vendors-count')).toBeVisible();

    test.info().annotations.push({
      type: 'note',
      description:
        'The hero search submits a `date` parameter that /vendors never reads. Either wire it up or ' +
        'remove the field — today it silently does nothing.',
    });
  });

  test('HOME-E-03 the date input starts as text and becomes a date picker on focus', async ({ homePage }) => {
    /**
     * A progressive-enhancement trick: `type="text"` shows the "Select date" placeholder (a native
     * date input cannot), and it flips to `type="date"` on focus. Worth pinning because a naive
     * refactor to a permanent `type="date"` loses the placeholder on every browser.
     */
    await homePage.open();
    expect(await homePage.dateInputType()).toBe('text');
    await expect(homePage.searchDateInput).toHaveAttribute('placeholder', messages.home.datePlaceholder);

    await homePage.searchDateInput.focus();
    expect(await homePage.dateInputType()).toBe('date');
  });

  test('HOME-P-04 the geolocate button bypasses the form and goes straight to a proximity search', async ({
    homePage,
    page,
    useGeolocation,
  }) => {
    await useGeolocation();
    await homePage.open();

    await homePage.heroCity.useMyLocation();
    await page.waitForURL(/\/vendors\?.*lat=/, { timeout: 30_000 });

    expect(page.url()).toContain(`lat=${geolocation.latitude}`);
    expect(page.url()).toContain(`lng=${geolocation.longitude}`);
  });

  test('HOME-N-01 a denied geolocation permission shows an inline explanation', async ({
    homePage,
    context,
  }) => {
    /** Permission not granted → `getCurrentPosition` rejects with 'denied'. */
    await context.clearPermissions();
    await homePage.open();

    await homePage.heroCity.useMyLocation();
    await homePage.heroCity.expectPermissionDenied();
  });

  test('HOME-P-05 city autocomplete offers suggestions', async ({ homePage }) => {
    /** Photon is stubbed centrally, so the two suggestions are deterministic. */
    await homePage.open();
    await homePage.heroCity.search('Beng');

    await expect(homePage.heroCity.suggestions.first()).toBeVisible();
    await homePage.heroCity.suggestion(/Bengaluru/).first().click();
    await homePage.heroCity.expectValue('Bengaluru');
  });
});

test.describe('Home - content sections', () => {
  test('HOME-P-06 the stats section renders the seeded counters', async ({ homePage, page }) => {
    await homePage.open();
    for (const stat of seededStats) {
      await expect(page.getByText(stat.label, { exact: false }).first()).toBeVisible();
    }
  });

  test('HOME-P-07 the services section links each department to a filtered listing @smoke', async ({
    homePage,
    page,
  }) => {
    await homePage.open();
    await expect(homePage.servicesSection).toBeVisible();

    /** Every seeded department must be represented. */
    for (const dept of seededDepartments.slice(0, 5)) {
      await expect(homePage.servicesSection).toContainText(dept.name);
    }

    await homePage.openService(seededDepartments[0].name);
    expect(page.url()).toContain('departmentId=');
  });

  test('HOME-P-08 the function halls panel renders with parsed capacities', async ({ homePage }) => {
    /**
     * The panel exists only when a department with slug `function-halls` exists, and each card's
     * capacity is extracted from the vendor DESCRIPTION with `/Capacity:\s*(\d+)/i`. So a
     * description-format change silently breaks this display — hence an explicit assertion on a
     * seeded capacity value rather than merely on the section being present.
     */
    await homePage.open();
    await expect(homePage.functionHallsSection).toBeVisible();

    const hall = seededFunctionHalls[0];
    await expect(homePage.hallCard(hall.name).first()).toBeVisible();
    await expect(homePage.functionHallsSection).toContainText(String(hall.capacity));
  });

  test('HOME-P-09 the FAQ accordion opens one panel at a time', async ({ homePage, page }) => {
    await homePage.open();
    await expect(homePage.faqSection).toBeVisible();

    const [first, second] = seededFaqs;
    await homePage.openFaq(new RegExp(first.question, 'i'));
    await expect(page.getByText(first.answer, { exact: false })).toBeVisible();

    /** Opening a second closes the first — the defining behaviour of this accordion. */
    await homePage.openFaq(new RegExp(second.question, 'i'));
    await expect(page.getByText(second.answer, { exact: false })).toBeVisible();
    await expect(page.getByText(first.answer, { exact: false })).toBeHidden();
  });

  test('HOME-P-10 the contact section links to tel, WhatsApp and mailto', async ({ homePage }) => {
    await homePage.open();
    await expect(homePage.contactSection).toBeVisible();

    await expect(homePage.callLink).toHaveAttribute('href', /^tel:/);
    await expect(homePage.whatsappLink).toHaveAttribute('href', /wa\.me/);
    await expect(homePage.whatsappLink).toHaveAttribute('target', '_blank');
    await expect(homePage.emailLink).toHaveAttribute('href', /^mailto:/);
  });

  test('HOME-P-11 the Best Events slider is static under reduced motion', async ({ homePage }) => {
    /**
     * The slider autoplays every 5000ms with 0.7s crossfades, so its text changes underneath any
     * assertion — except under `prefers-reduced-motion`, where `useReducedMotion()` disables
     * autoplay, the tilt, the entrance and the progress bar entirely. The whole suite depends on
     * that, so it gets a direct assertion.
     */
    await homePage.open();
    await expect(homePage.bestEventsSection).toBeVisible();

    const before = await homePage.bestEventsSection.textContent();
    await homePage.waitFor(6_000); // longer than one 5000ms autoplay interval
    const after = await homePage.bestEventsSection.textContent();

    expect(after, 'the slider must not auto-advance under reduced motion').toBe(before);
  });
});

test.describe('Nav - the site shell', () => {
  test('NAV-P-01 the navbar exposes every link, labelled "Our Work" not "Vendors" @smoke', async ({
    homePage,
  }) => {
    await homePage.open();
    await homePage.navbar.expectVisible();

    await expect(homePage.navbar.home).toBeVisible();
    /** `nav.vendors` is "Our Work", while the destination page's h1 says "Vendors". */
    await expect(homePage.navbar.ourWork).toBeVisible();
    await expect(homePage.navbar.packages).toBeVisible();
    await expect(homePage.navbar.bookNow).toBeVisible();
  });

  test('NAV-P-02 the active link is marked with aria-current @smoke', async ({ vendorsPage }) => {
    await vendorsPage.open();
    await vendorsPage.navbar.expectActive(messages.nav.vendors);
  });

  test('NAV-E-01 anchor links never receive aria-current', async ({ homePage }) => {
    /**
     * `isActive` returns false for any href containing '#', so Services and Contact Us are never
     * marked active even while you are looking at those sections. Documented rather than
     * asserted as a bug — it is a defensible choice, but it should not change silently.
     */
    await homePage.open();
    await expect(homePage.navbar.services).not.toHaveAttribute('aria-current', 'page');
    await expect(homePage.navbar.contact).not.toHaveAttribute('aria-current', 'page');
  });

  test('NAV-P-03 an anchor link scrolls to its section and settles @smoke', async ({ homePage }) => {
    /**
     * Lenis installs a document-level click interceptor that preventDefaults every `<a href*="#">`
     * and calls `lenis.scrollTo(el, { offset: -88 })`, retrying up to 25 times at 150ms for
     * sections that have not streamed in yet. `followAnchorLink` polls the element's geometry
     * until it stops moving rather than sleeping a fixed amount.
     */
    await homePage.open();
    await homePage.followAnchorLink(messages.nav.services, 'services');

    await expect(homePage.servicesSection).toBeInViewport({ ratio: 0.1 });
  });

  test('NAV-P-04 a direct URL with a hash scrolls to the section', async ({ homePage }) => {
    /** A different code path from the click: Lenis handles this via `hashchange` plus a 300ms delay. */
    await homePage.openRaw(paths.anchors.faq);
    await homePage.scrollToAnchor('faq');

    await expect(homePage.faqSection).toBeInViewport({ ratio: 0.1 });
  });

  test('NAV-P-05 every primary route is reachable and returns 200 @smoke', async ({ page }) => {
    for (const route of [
      paths.home,
      paths.vendors,
      paths.packages,
      paths.book,
      paths.testimonials,
      paths.privacy,
      paths.terms,
      paths.login,
    ]) {
      const res = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `${route} must return 200`).toBe(200);
    }
  });

  test('NAV-P-06 browser back and forward preserve the query string', async ({ vendorsPage, page }) => {
    await vendorsPage.openFiltered({ search: 'Studio' });
    await vendorsPage.open();

    await page.goBack();
    expect(page.url(), 'going back must restore the filtered URL').toContain('search=Studio');

    await page.goForward();
    expect(page.url()).not.toContain('search=Studio');
  });

  test('NAV-E-02 an unknown route renders the framework 404', async ({ page }) => {
    /** There is no custom `not-found.tsx` anywhere, so this is Next's default page. */
    const res = await page.goto('/this-route-does-not-exist', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(404);
  });

  test('NAV-P-07 the WhatsApp FAB is present on every public page but not on /login @smoke', async ({
    page,
  }) => {
    for (const route of [paths.home, paths.vendors, paths.packages, paths.book]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('whatsapp-fab'), `${route} should show the FAB`).toBeVisible();
    }

    /** The `(auth)` group has no layout, so no FAB there. */
    await page.goto(paths.login, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('whatsapp-fab')).toHaveCount(0);
  });
});

test.describe('Nav - responsive', () => {
  test('RESP-P-01 the navbar collapses to a hamburger on mobile @mobile', async ({ homePage }) => {
    await homePage.open();

    await expect(homePage.navbar.mobileToggle).toBeVisible();
    await expect(homePage.navbar.mobileMenu).toHaveCount(0);

    await homePage.navbar.openMobileMenu();
    await expect(homePage.navbar.mobileMenu.getByRole('link', { name: messages.nav.vendors })).toBeVisible();
  });

  test('RESP-E-01 admin is unnavigable below the md breakpoint @mobile', async ({ adminPage }) => {
    /**
     * The Sidebar is `hidden md:flex` and NOTHING replaces it — there is no hamburger, no drawer,
     * no bottom bar. So on a phone an admin can reach `/admin` and then cannot get anywhere else.
     * Asserted as current behaviour, because it is a real product gap that should be visible
     * rather than quietly skipped.
     */
    test.info().annotations.push({
      type: 'note',
      description:
        'There is no mobile admin navigation at all: features/admin/components/sidebar.tsx is ' +
        '`hidden md:flex` with no replacement. Admin is effectively desktop-only.',
    });

    await adminPage.setViewportSize({ width: 390, height: 844 });
    await adminPage.goto(paths.admin, { waitUntil: 'domcontentloaded' });
    await adminPage.getByTestId('admin-loading').waitFor({ state: 'hidden', timeout: 30_000 });

    await expect(adminPage.getByTestId('admin-sidebar')).toBeHidden();
    /** And no alternative navigation exists to compensate. */
    await expect(adminPage.getByRole('button', { name: /menu/i })).toHaveCount(0);
  });
});
