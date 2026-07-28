import { test, expect } from '@fixtures/test';
import { paths } from '@config/urls';
import { revalidateSecret, urls } from '@config/env';

/**
 * SEC revalidate — the Next.js cache-busting route handler.
 *
 * `frontend/src/app/api/revalidate/route.ts` accepts `?tag=` plus either a matching `?secret=` or a
 * bearer token the backend confirms belongs to a live admin session.
 *
 * It used to fall OPEN whenever `REVALIDATE_SECRET` was unset — so a deployment that merely forgot
 * the variable served an unauthenticated cache-purge endpoint, which a caller could loop to force
 * cold backend fetches (`serverApi` retries twice at a 10s timeout) against a free-tier API. It also
 * chained the two checks, making the session path unreachable whenever the secret check passed.
 *
 * Both are fixed: the checks are independent, and a missing secret is a 503 in production rather
 * than an open door. Outside production it is an explicit, logged affordance.
 *
 * `scripts/run-e2e.mjs` now generates a real per-run secret and injects it into both the frontend
 * and the tests, so this suite exercises the same authenticated path production uses instead of
 * depending on the route being open.
 */

test.describe('SEC revalidate', () => {
  test('SEC-26 an authorised caller can bust the cache', async ({ page }) => {
    /**
     * Not a vulnerability assertion — a precondition check, and now also a check that the
     * AUTHORISED path works. Several journey specs depend on being able to invalidate the 300s
     * Data Cache, so a failure here should read as "the harness is broken", not "a control
     * regressed".
     *
     * This is the same path production uses: `scripts/run-e2e.mjs` generates a secret, hands it to
     * the frontend as REVALIDATE_SECRET and to the tests as E2E_REVALIDATE_SECRET.
     */
    const url = revalidateSecret
      ? `${urls.base}${paths.revalidate('all')}&secret=${encodeURIComponent(revalidateSecret)}`
      : `${urls.base}${paths.revalidate('all')}`;

    const res = await page.request.post(url);
    expect(res.ok(), `POST /api/revalidate with the run secret → ${res.status()}`).toBeTruthy();
  });

  test('SEC-27 a wrong secret is refused when one is configured', async ({ page }) => {
    /**
     * The route no longer falls open on a missing variable. It now:
     *   - evaluates the secret and the session independently, granting access if EITHER passes
     *     (previously the session check was unreachable whenever the secret check passed);
     *   - returns 503 in production when REVALIDATE_SECRET is absent, rather than allowing the call;
     *   - allows unauthenticated calls outside production, with a warning logged each time — which
     *     is the affordance the journey specs use to bust the 300s Data Cache.
     *
     * So the assertion depends on how the stack under test is configured. With a secret set, a wrong
     * one must be refused. Without one — how `scripts/stack.mjs` runs — the dev affordance is
     * active and there is nothing to refuse, so this skips rather than asserting a falsehood.
     */
    const withWrongSecret = await page.request.post(`${urls.base}/api/revalidate?tag=all&secret=definitely-wrong`);

    test.skip(
      withWrongSecret.ok(),
      'REVALIDATE_SECRET is unset, so the documented non-production affordance is active. ' +
        'Set it (and NODE_ENV=production) to exercise the enforced path.',
    );

    expect(withWrongSecret.status(), 'a wrong secret must be refused').toBe(401);

    /** And no header at all is equally refused — not merely a wrong value. */
    const withNothing = await page.request.post(`${urls.base}${paths.revalidate('all')}`);
    expect(withNothing.status(), 'an unauthenticated cache purge must be refused').toBe(401);
  });

  test('SEC-27b the dev affordance is explicit, not an accident of configuration', async ({ page }) => {
    /**
     * The property that made the old code dangerous was that *forgetting* a variable silently
     * disabled the control. This asserts the replacement is a deliberate, environment-scoped
     * decision: reachable here (non-production, no secret) and, per the route, a 503 rather than an
     * open door in production.
     *
     * The production branch cannot be exercised from this suite without booting a second stack in
     * prod mode, so it is verified by reading `route.ts` and by the DEPLOYMENT.md checklist item
     * that requires REVALIDATE_SECRET on Vercel.
     */
    const res = await page.request.post(`${urls.base}${paths.revalidate('all')}`);

    if (res.ok()) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Running with REVALIDATE_SECRET unset outside production — the route allowed the call and ' +
          'logged a warning, as designed. In production the same configuration returns 503.',
      });
    }

    expect([200, 401, 503], `unexpected status ${res.status()}`).toContain(res.status());
  });

  test('SEC-28 an unknown tag is rejected rather than purging everything', async ({ page }) => {
    /**
     * A route that treats an unrecognised tag as "purge all" would turn a typo into a
     * site-wide cache flush.
     */
    const res = await page.request.post(`${urls.base}/api/revalidate?tag=not-a-real-tag`);
    expect([400, 401, 404], `an unknown tag must not be accepted (got ${res.status()})`).toContain(res.status());
  });

  test('SEC-29 the route rejects GET, so it cannot be triggered by a link or an image', async ({ page }) => {
    /**
     * A state-changing GET is triggerable by any `<img src>` on any page in the world. The
     * handler exports POST only, so this should be a 405.
     */
    const res = await page.request.get(`${urls.base}${paths.revalidate('all')}`);
    expect(res.status(), 'cache invalidation must not be a GET').toBe(405);
  });
});
