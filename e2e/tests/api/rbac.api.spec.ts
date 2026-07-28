import { test, expect } from '@fixtures/test';
import { authenticatedRoutes, protectedRoutes, publicRoutes } from '@config/urls';
import { payloads } from '@data/test-data';

/**
 * API-RBAC — one data-driven sweep over the entire authorization surface.
 *
 * Why data-driven rather than ~130 hand-written cases: the interesting property is
 * uniformity. Every `@Roles(ADMIN, SUPER_ADMIN)` route must behave identically for
 * an anonymous caller, a forged token and a CUSTOMER token — and a new route that
 * forgets its guard should fail here rather than be discovered in production. A table
 * makes the omission the failure, and adding a route to `src/config/urls.ts` is the
 * only maintenance cost.
 *
 * The route table lives in `src/config/urls.ts` and is cross-checked against the
 * server's own OpenAPI document by `tests/api/contract.api.spec.ts`, so it cannot
 * silently drift out of date.
 *
 * Note the ids used in the table are deliberately nonexistent (`does-not-exist`).
 * Authorization is evaluated before the handler runs, so a guard rejection (401/403)
 * must win over the 404 the handler would produce — which is itself the assertion:
 * a 404 for an anonymous caller would be an information leak about which ids exist.
 */

test.describe('API RBAC - anonymous callers', () => {
  for (const [method, path] of protectedRoutes) {
    test(`API-RBAC-N-anon ${method} ${path} rejects an anonymous caller with 401`, async ({ anonApi }) => {
      const res = await anonApi.call(method, path, {});
      expect(
        res.status(),
        `${method} ${path} must be 401 for an anonymous caller, got ${res.status()}`,
      ).toBe(401);
    });
  }
});

test.describe('API RBAC - forged tokens', () => {
  /** One representative route per HTTP verb keeps this sweep proportionate. */
  const sample = [
    ['GET', '/bookings'],
    ['POST', '/vendors'],
    ['PATCH', '/vendors/does-not-exist'],
    ['PUT', '/cms/stats'],
    ['DELETE', '/vendors/does-not-exist'],
  ] as const;

  for (const [label, token] of [
    ['garbage', payloads.tokens.garbage],
    ['bad-signature', payloads.tokens.badSignature],
    ['alg-none', payloads.tokens.algNone],
  ] as const) {
    for (const [method, path] of sample) {
      test(`API-RBAC-S-${label} ${method} ${path} rejects a ${label} token`, async ({ anonApi }) => {
        const res = await anonApi.as(token).call(method, path, {});
        /**
         * 401, not 403: the token never authenticates, so the request never reaches
         * RolesGuard. A 403 here would mean the forged identity was accepted and
         * merely lacked a role — a much worse outcome.
         */
        expect(res.status(), `${method} ${path} with a ${label} token must be 401`).toBe(401);
      });
    }
  }
});

test.describe('API RBAC - CUSTOMER role', () => {
  for (const [method, path] of protectedRoutes) {
    test(`API-RBAC-N-customer ${method} ${path} rejects a CUSTOMER token with 403`, async ({
      anonApi,
      customerToken,
    }) => {
      const res = await anonApi.as(customerToken).call(method, path, {});
      /**
       * 403, not 401: the token is valid, the role is insufficient. Distinguishing the
       * two matters — a 401 would tell a legitimate user to re-authenticate when the
       * real answer is that they will never be allowed.
       */
      expect(
        res.status(),
        `${method} ${path} must be 403 for a CUSTOMER, got ${res.status()}`,
      ).toBe(403);
    });
  }
});

test.describe('API RBAC - ADMIN role', () => {
  for (const [method, path] of protectedRoutes) {
    test(`API-RBAC-P-admin ${method} ${path} admits an ADMIN token`, async ({ api }) => {
      const res = await api.call(method, path, {});
      /**
       * Anything but 401/403 is a pass. The exact status depends on the route — a POST
       * with an empty body is a 400, an operation on `does-not-exist` is a 404 — and
       * this sweep is about authorization, not about each handler's contract. Those
       * live in the per-module specs.
       */
      expect(
        [401, 403],
        `${method} ${path} must not reject an ADMIN (got ${res.status()}: ${await res.text()})`,
      ).not.toContain(res.status());
    });
  }
});

test.describe('API RBAC - routes with no @Roles decorator', () => {
  for (const [method, path] of authenticatedRoutes) {
    test(`API-RBAC-E-open ${method} ${path} needs auth but accepts any role`, async ({
      anonApi,
      customerToken,
    }) => {
      /** Anonymous is rejected… */
      expect((await anonApi.call(method, path, {})).status()).toBe(401);

      /**
       * …but a CUSTOMER passes, because `RolesGuard` returns true when no roles are
       * required. Asserted explicitly so that adding a route without `@Roles` cannot
       * quietly become an admin-privilege hole that nobody notices.
       */
      const res = await anonApi.as(customerToken).call(method, path, {});
      expect(
        res.status(),
        `${method} ${path} carries no @Roles, so a CUSTOMER should pass the guard`,
      ).not.toBe(403);
    });
  }
});

test.describe('API RBAC - public routes', () => {
  for (const [method, path] of publicRoutes) {
    test(`API-RBAC-P-public ${method} ${path} answers without any credentials`, async ({ anonApi }) => {
      const res = await anonApi.call(method, path);
      expect(res.status(), `${method} ${path} is @Public and must not require auth`).toBeLessThan(400);
    });
  }

  test('API-RBAC-E-01 an invalid token on a public route is ignored, not rejected', async ({ anonApi }) => {
    /**
     * `JwtAuthGuard.canActivate` short-circuits on `@Public()` before Passport runs, so
     * a garbage Authorization header must not turn a public read into a 401. Otherwise
     * a user with a stale token in localStorage would see the public site break.
     */
    const res = await anonApi.as(payloads.tokens.garbage).get('/departments');
    expect(res.status()).toBe(200);
  });
});
