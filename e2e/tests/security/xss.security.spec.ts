import { test, expect, serial } from '@fixtures/test';
import { apiPaths, paths } from '@config/urls';
import { payloads, xssProbes } from '@data/test-data';
import { LegalPage } from '@pages/index';

/**
 * SEC XSS — the stored-XSS surface.
 *
 * The interesting target is narrow and specific. `/privacy` and `/terms` render
 * admin-authored HTML through `dangerouslySetInnerHTML`, filtered only by
 * `frontend/src/shared/lib/sanitize.ts` — a hand-rolled regex allowlist that
 * SECURITY_AUDIT.md H-1 identifies as bypassable. Every other free-text field in the app
 * is rendered as React text and therefore escaped, so those are asserted too but as a
 * regression guard rather than as a live concern.
 *
 * Each payload is a DISTINCT bypass class, not a variation: a regex allowlist typically
 * catches bare `<script>` and misses event handlers, SVG, split attributes, entities and
 * `javascript:` URLs. Testing one payload would prove almost nothing.
 *
 * Serial: these write to the `legal-terms` / `legal-privacy` CMS singletons, which are one
 * row each with last-writer-wins semantics.
 */
serial();

test.describe('SEC XSS - stored XSS on the legal pages (H-1)', () => {
  for (const [name, payload] of Object.entries(payloads.xss)) {
    test(`SEC-XSS-${name} a "${name}" payload does not execute on /privacy`, async ({
      api,
      page,
      xssProbe,
      factory,
    }) => {
      /**
       * Snapshot and restore: these are shared singletons, and leaving a payload behind
       * would poison every later legal-page assertion in the run.
       */
      await factory.snapshotAndRestore(
        'legal-privacy',
        async () => api.json<{ content: string }>(apiPaths.cms.legal('privacy')).catch(() => ({ content: '' })),
        async (original) => {
          await api.put(apiPaths.cms.legal('privacy'), { content: original.content ?? '' });
        },
      );

      /** Write the payload the way an admin with a compromised account would. */
      const written = await api.put(apiPaths.cms.legal('privacy'), {
        content: `<p>Privacy notice.</p>${payload.replace('__xssProbe', xssProbes.legal)}`,
      });
      expect(written.ok(), 'the admin write itself must succeed, or the test proves nothing').toBeTruthy();

      await xssProbe(xssProbes.legal);

      const privacyPage = new LegalPage(page, 'privacy');
      await privacyPage.reloadFresh('cms');
      /** Re-seed after the reload — an init script only applies to a NEW document. */
      await xssProbe(xssProbes.legal);
      await privacyPage.openRaw(paths.privacy);
      await privacyPage.expectLoaded();

      await privacyPage.expectNoScriptExecuted(xssProbes.legal);
    });
  }

  test('SEC-XSS-href a javascript: URL is stripped from an anchor', async ({ api, page, factory }) => {
    await factory.snapshotAndRestore(
      'legal-terms',
      async () => api.json<{ content: string }>(apiPaths.cms.legal('terms')).catch(() => ({ content: '' })),
      async (original) => {
        await api.put(apiPaths.cms.legal('terms'), { content: original.content ?? '' });
      },
    );

    await api.put(apiPaths.cms.legal('terms'), {
      content: '<p>Terms.</p><a href="javascript:void(document.title=\'xss\')">Click</a>',
    });

    const termsPage = new LegalPage(page, 'terms');
    await termsPage.openRaw(paths.terms);
    await termsPage.reloadFresh('cms');

    const html = await termsPage.renderedHtml();
    expect(html, 'a javascript: href must not survive sanitisation').not.toMatch(/javascript:/i);
    expect(await page.title(), 'the payload must not have run').not.toBe('xss');
  });
});

test.describe('SEC XSS - React-escaped surfaces (regression guards)', () => {
  test('SEC-XSS-vendor a payload in a vendor description is rendered as text', async ({
    factory,
    page,
    vendorDetailPage,
    xssProbe,
  }) => {
    /**
     * Vendor descriptions are rendered as JSX children, so React escapes them. Asserted so
     * that a future "render rich descriptions" feature cannot introduce a second
     * `dangerouslySetInnerHTML` surface unnoticed.
     */
    const vendor = await factory.createVendor({
      description: payloads.xss.imgOnError.replace('__xssProbe', xssProbes.vendor),
    });

    await xssProbe(xssProbes.vendor);
    await vendorDetailPage.openSlug(vendor.slug);
    await xssProbe(xssProbes.vendor);
    await vendorDetailPage.openSlug(vendor.slug);

    expect(await vendorDetailPage.readXssProbe(xssProbes.vendor)).toBe('safe');
    /** The literal markup must be visible as text — proof it was escaped, not stripped. */
    await expect(page.getByText('onerror', { exact: false }).first()).toBeVisible();
  });

  test('SEC-XSS-review a payload in a public review is rendered as text', async ({
    factory,
    testimonialsPage,
    api,
    xssProbe,
  }) => {
    const name = factory.name('xss-review');
    await factory.createTestimonial({
      name,
      message: payloads.xss.svgOnLoad.replace('__xssProbe', xssProbes.testimonial),
      approved: true,
    });
    void api;

    await xssProbe(xssProbes.testimonial);
    await testimonialsPage.open();
    await testimonialsPage.reloadFresh('cms');
    await xssProbe(xssProbes.testimonial);
    await testimonialsPage.open();

    expect(await testimonialsPage.readXssProbe(xssProbes.testimonial)).toBe('safe');
  });

  test('SEC-XSS-search a payload in the search query is not reflected as markup', async ({
    vendorsPage,
    xssProbe,
  }) => {
    /**
     * `/vendors` echoes nothing from `search` back into the page, but the parameter is
     * user-controlled and unauthenticated, so a future "showing results for X" line would
     * be a reflected-XSS vector. This locks the current safe behaviour in.
     */
    await xssProbe(xssProbes.search);
    await vendorsPage.openFiltered({ search: payloads.xss.bareScript.replace('__xssProbe', xssProbes.search) });
    expect(await vendorsPage.readXssProbe(xssProbes.search)).toBe('safe');
  });

  test('SEC-XSS-booking a payload in special requirements is stored and escaped', async ({
    api,
    factory,
    bookingsPage,
    xssProbe,
  }) => {
    const email = factory.email('xss-booking');
    await factory.createBooking({
      customerEmail: email,
      specialRequirements: payloads.xss.detailsOnToggle.replace('__xssProbe', xssProbes.booking),
    });
    void api;

    await xssProbe(xssProbes.booking);
    await bookingsPage.open();
    await xssProbe(xssProbes.booking);
    await bookingsPage.open();

    await bookingsPage.expectContains(email);
    expect(await bookingsPage.readXssProbe(xssProbes.booking)).toBe('safe');
  });
});

test.describe('SEC XSS - alert tripwire', () => {
  test('SEC-XSS-alert no page in the app ever raises a native alert', async ({ page, api, factory }) => {
    /**
     * A belt-and-braces tripwire alongside the probe checks: a payload might fire an
     * `alert()` without touching `window.__*Probe`. The app never calls `alert()` itself, so
     * any alert at all is a successful injection.
     */
    const alerts: string[] = [];
    page.on('dialog', (dialog) => {
      if (dialog.type() === 'alert') alerts.push(dialog.message());
      void dialog.dismiss();
    });

    await factory.snapshotAndRestore(
      'legal-privacy',
      async () => api.json<{ content: string }>(apiPaths.cms.legal('privacy')).catch(() => ({ content: '' })),
      async (original) => {
        await api.put(apiPaths.cms.legal('privacy'), { content: original.content ?? '' });
      },
    );
    await api.put(apiPaths.cms.legal('privacy'), {
      content: '<img src=x onerror="alert(1)"><svg/onload="alert(2)"><script>alert(3)</script>',
    });

    for (const route of [paths.home, paths.privacy, paths.terms, paths.vendors, paths.packages]) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
    }

    expect(alerts, `an injected alert() fired: ${alerts.join(', ')}`).toEqual([]);
  });
});
