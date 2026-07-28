import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { isProdModeApi } from '@config/env';

/**
 * SEC-00 — the build-freshness self-check. This runs before every other security spec
 * and exists for a specific, observed reason.
 *
 * While this suite was being written, the API on :4000 was a `node dist/main` process
 * started before three shipped security controls were compiled in. Live probing showed
 * no helmet headers, no throttler headers, and `GET /cms/testimonials?all=true`
 * returning unapproved content to an anonymous caller — all of which `src/` handles
 * correctly. Every header and rate-limit spec would have failed for a purely
 * environmental reason and been muted as flaky within a week.
 *
 * So: assert the controls are PRESENT first, with a message that names the real cause.
 * These are plain `test()`s, never `test.fail()` — their whole job is to detect a stale
 * deploy, and `scripts/stack.mjs` guarantees a fresh `npm run build` before boot.
 */

test.describe('SEC-00 build freshness', () => {
  test('SEC-00-a helmet security headers are present on API responses', async ({ anonApi }) => {
    const res = await anonApi.get(apiPaths.departments.list);
    const headers = res.headers();

    expect(
      headers['x-content-type-options'],
      'helmet() is configured in backend/src/main.ts. A missing header here almost always means the ' +
        'running process predates that code — rebuild (`npm run build`) and restart the API.',
    ).toBe('nosniff');

    expect(headers['x-frame-options'] ?? headers['content-security-policy'], 'framing protection must be set').toBeTruthy();

    /** helmet removes this; its presence is itself the stale-build signal. */
    expect(
      headers['x-powered-by'],
      'X-Powered-By: Express should be stripped by helmet — its presence means a stale build.',
    ).toBeUndefined();
  });

  test('SEC-00-b the throttler is active', async ({ anonApi }) => {
    const res = await anonApi.get(apiPaths.departments.list);
    const headers = res.headers();

    /**
     * @nestjs/throttler v6 emits these on every response once ThrottlerGuard is wired as
     * an APP_GUARD. Their absence means the guard is not running, which would silently
     * disable every rate limit in the application.
     */
    const limitHeader =
      headers['x-ratelimit-limit'] ?? headers['ratelimit-limit'] ?? headers['x-ratelimit-remaining'];
    expect(
      limitHeader,
      'No rate-limit headers. ThrottlerGuard is registered as APP_GUARD in app.module.ts, so this ' +
        'means the running build predates it — every login/booking/review rate limit is currently off.',
    ).toBeTruthy();
  });

  test('SEC-00-c the ?all=true admin gate is compiled in', async ({ anonApi }) => {
    /**
     * `?all=true` is supposed to return unapproved and INACTIVE content to ADMINS only,
     * gated by `isAdminRequest()` in `src/common/admin-request.util.ts`. An anonymous
     * caller getting the same payload as the public endpoint proves the gate is active.
     */
    const publicList = await anonApi.json<unknown[]>(apiPaths.cms.testimonials);
    const allList = await anonApi.json<unknown[]>(apiPaths.cms.testimonialsAll);

    expect(
      allList.length,
      '?all=true returned MORE rows to an anonymous caller than the public endpoint. Either the ' +
        'isAdminRequest() gate is missing from the running build, or it has regressed — unapproved ' +
        'and inactive content is publicly readable.',
    ).toBeLessThanOrEqual(publicList.length);
  });

  test('SEC-00-d Swagger exposure matches the configured environment', async ({ anonApi }) => {
    /**
     * `main.ts` mounts Swagger only when `NODE_ENV !== 'production'`. `scripts/stack.mjs`
     * boots with NODE_ENV=test on purpose (so /docs-json is available for the contract
     * spec), so /docs being reachable here is CORRECT — this case only fails if someone
     * points the suite at a prod-mode server and finds the docs still exposed.
     */
    const res = await anonApi.fetchAbsolute(apiPaths.docs);

    if (isProdModeApi()) {
      expect(res.status(), 'Swagger must not be reachable in production (SECURITY_AUDIT.md)').toBe(404);
    } else {
      expect(res.status(), 'Swagger is expected in non-production, for the OpenAPI contract spec').toBe(200);
    }
  });
});
