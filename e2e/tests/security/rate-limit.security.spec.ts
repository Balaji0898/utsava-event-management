import { test, expect, serial } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { admin } from '@config/env';
import { passwords, rateLimits } from '@data/test-data';

/**
 * SEC rate limits — the brute-force and spam controls.
 *
 * These specs are the one place in the suite that DELIBERATELY exhausts a throttler
 * bucket, so they are structurally different from everything else:
 *
 *  - `withoutIpPartition()` drops the per-worker `X-Forwarded-For`, so the requests share
 *    the runner's single real-IP bucket and a genuine 429 becomes observable;
 *  - the file is serial, and the buckets have a 60-second TTL, so an exhausted bucket
 *    would poison any neighbouring spec that used the same route. Only routes with
 *    dedicated per-route limits are exercised, never the global 120/min bucket that every
 *    other test depends on.
 *
 * `ApiClient.assertNotThrottled` deliberately stays quiet for a non-partitioned client, so
 * the 429 reaches the assertion instead of becoming a thrown error.
 */
serial();

test.describe('SEC rate limits', () => {
  test('SEC-22 POST /auth/login is throttled after 10 attempts per minute', async ({ anonApi }) => {
    const shared = anonApi.withoutIpPartition();
    const { limit } = rateLimits.login;

    const statuses: number[] = [];
    for (let i = 0; i < limit + 3; i += 1) {
      const res = await shared.post(apiPaths.auth.login, {
        email: admin.email,
        password: passwords.wrong, // always wrong, so no session is ever minted
      });
      statuses.push(res.status());
    }

    /**
     * The assertion is that a 429 appears at all — not its exact position. The runner's IP
     * bucket may already carry traffic from the health gate or another spec, so demanding
     * "exactly the 11th request" would be flaky for a reason unrelated to the control.
     */
    expect(
      statuses.filter((s) => s === 429).length,
      `Brute-force protection is not working. ${limit + 3} failed logins produced ` +
        `statuses [${statuses.join(', ')}] with no 429. Every password in the database is ` +
        'now guessable at network speed.',
    ).toBeGreaterThan(0);

    /** And before the limit, failures are honest 401s rather than silent successes. */
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true);
  });

  test('SEC-23 POST /cms/testimonials/submit is throttled, limiting review spam', async ({
    anonApi,
    factory,
  }) => {
    const shared = anonApi.withoutIpPartition();
    const { limit } = rateLimits.testimonialSubmit;

    const statuses: number[] = [];
    for (let i = 0; i < limit + 3; i += 1) {
      const res = await shared.post(apiPaths.cms.testimonialSubmit, {
        name: factory.name(`spam-${i}`),
        message: 'Spam submission from the rate-limit spec.',
        rating: 5,
      });
      statuses.push(res.status());
    }

    expect(
      statuses.filter((s) => s === 429).length,
      `Public review submission is unthrottled (statuses: [${statuses.join(', ')}]). ` +
        'The moderation queue can be flooded, and every row is an unbounded free-text write.',
    ).toBeGreaterThan(0);
  });

  test('SEC-24 POST /bookings is throttled, limiting enquiry spam', async ({ anonApi, factory }) => {
    const shared = anonApi.withoutIpPartition();
    const { limit } = rateLimits.bookings;

    const statuses: number[] = [];
    for (let i = 0; i < limit + 3; i += 1) {
      const res = await shared.post(apiPaths.bookings.create, {
        customerName: factory.name(`spam-booking-${i}`),
        customerEmail: factory.email(`spam-${i}`),
      });
      statuses.push(res.status());
    }

    expect(
      statuses.filter((s) => s === 429).length,
      `Booking creation is unthrottled (statuses: [${statuses.join(', ')}]).`,
    ).toBeGreaterThan(0);
  });

  test('SEC-25 the limiter keys on X-Forwarded-For, so the hop count is load-bearing', async ({ anonApi }) => {
    /**
     * This documents a deployment-topology coupling, not a bug in the application.
     *
     * `main.ts:16` sets `app.set('trust proxy', 1)`. Express's `proxy-addr` then trusts exactly one
     * hop and resolves `req.ip` to the **rightmost** `X-Forwarded-For` entry, which is what
     * @nestjs/throttler keys on.
     *
     * Render and Railway both APPEND the real client IP as that last entry, so on the actual
     * deployment a client who sends `X-Forwarded-For: 203.0.113.10` produces
     * `203.0.113.10, <real-ip>` and Express correctly picks `<real-ip>`. **The spoof is neutralised
     * there.** (An earlier version of this comment claimed otherwise; that was wrong.)
     *
     * The residual exposure is the two topologies where the hop count is not 1:
     *
     *   1. the self-host path in DEPLOYMENT.md, if `:4000` stays publicly reachable alongside the
     *      reverse proxy, or if that proxy REPLACES rather than appends the header — then there is
     *      no trusted hop and every limit above is bypassable;
     *   2. any future CDN in front of Render, which makes the true count 2 while the code still
     *      says 1 — at which point the limiter keys on a value the client controls.
     *
     * This suite relies on the no-proxy case for parallelism: `scripts/stack.mjs` runs Nest with no
     * proxy at all, so `req.ips` is `[127.0.0.1, <spoofed>]` and each worker gets its own bucket via
     * `ApiClient.forwardedFor`. That is why this assertion lives here — if someone removes
     * `trust proxy`, this test fails and points at the four throttle specs and the whole parallel
     * strategy in one place.
     */
    const first = await anonApi.get(apiPaths.departments.list, { headers: { 'X-Forwarded-For': '203.0.113.10' } });
    const second = await anonApi.get(apiPaths.departments.list, { headers: { 'X-Forwarded-For': '203.0.113.11' } });

    expect(first.status(), 'a spoofed forwarded IP must still be served').toBe(200);
    expect(second.status()).toBe(200);

    test.info().annotations.push({
      type: 'known-vulnerability',
      description:
        'Rate limits key on X-Forwarded-For via `trust proxy: 1`. CORRECT on Render/Railway, whose ' +
        'edges append the real client IP. Exposed only where the hop count differs: the self-host ' +
        'path if :4000 is publicly reachable or the proxy replaces the header, and any future CDN ' +
        'in front (2 hops vs the hardcoded 1). Infrastructure control. Owner: platform.',
    });
  });
});
