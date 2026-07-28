import { test, expect } from '@fixtures/test';
import { apiPaths, publicRoutes } from '@config/urls';

/**
 * SEC data-exposure — does any endpoint leak something it should not?
 *
 * Policy for this whole directory: **every case asserts the SECURE expectation.** A case
 * whose finding is still present is wrapped in `test.fail()` and carries a
 * `known-vulnerability` annotation. That keeps CI green on day one, fails loudly the
 * moment the bug is fixed ("expected to fail but passed") which forces the annotation to
 * be deleted in the same PR as the fix, and needs zero test rewrites — only the wrapper
 * goes. `scripts/generate-e2e-report.js` collects the annotations into a machine-readable
 * register and fails the build if the count ever RISES.
 */

/** Field names that must never appear in any response body, anywhere. */
const FORBIDDEN_FIELDS = ['passwordHash', 'refreshToken'] as const;

/** bcrypt hash prefixes — catches a leak even if the field were renamed. */
const HASH_SIGNATURES = ['$2a$', '$2b$', '$2y$'] as const;

function assertNoCredentialLeak(label: string, body: string): void {
  for (const field of FORBIDDEN_FIELDS) {
    expect(body, `${label} leaked "${field}"`).not.toContain(field);
  }
  for (const signature of HASH_SIGNATURES) {
    expect(body, `${label} leaked a bcrypt hash (${signature}…)`).not.toContain(signature);
  }
}

test.describe('SEC data exposure - credential leakage (H-2)', () => {
  test('SEC-01 no public endpoint leaks a credential field', async ({ anonApi }) => {
    for (const [method, path] of publicRoutes) {
      const res = await anonApi.call(method, path);
      assertNoCredentialLeak(`${method} ${path}`, await res.text());
    }
  });

  test('SEC-02 GET /bookings does not leak the customer passwordHash', async ({ api, factory }) => {
    /**
     * SECURITY_AUDIT.md H-2: `BookingsService` includes `customer: true` rather than a
     * `select`, so every field of the related `User` — including `passwordHash` and the
     * bcrypt-hashed `refreshToken` — is serialized into the admin bookings response.
     *
     * The secure expectation is asserted; if this currently fails, wrap in `test.fail()`
     * and annotate. It is written as a plain test because the fix is a one-line `select`.
     */
    await factory.createBooking();

    const res = await api.get(apiPaths.bookings.list);
    expect(res.ok()).toBeTruthy();
    assertNoCredentialLeak('GET /bookings', await res.text());
  });

  test('SEC-03 GET /bookings/:id does not leak the customer passwordHash', async ({ api, factory }) => {
    const booking = await factory.createBooking();
    const res = await api.get(apiPaths.bookings.one(booking.id));
    assertNoCredentialLeak('GET /bookings/:id', await res.text());
  });

  test('SEC-04 GET /bookings/stats exposes only aggregates', async ({ api }) => {
    const res = await api.get(apiPaths.bookings.stats);
    const text = await res.text();
    assertNoCredentialLeak('GET /bookings/stats', text);
    expect(text, 'a stats endpoint must not carry customer email addresses').not.toMatch(
      /"customerEmail"|@[a-z0-9-]+\.[a-z]{2,}/i,
    );
  });

  test('SEC-05 auth responses are sanitized', async ({ api }) => {
    assertNoCredentialLeak('GET /auth/me', await (await api.get(apiPaths.auth.me)).text());
  });
});

test.describe('SEC data exposure - the ?all=true content gate', () => {
  test('SEC-06 unapproved testimonials are not readable by an anonymous caller', async ({
    anonApi,
    api,
    factory,
  }) => {
    /**
     * `GET /cms/testimonials?all=true` is `@Public()`, and returns unapproved records when
     * the caller looks like an admin. If that check is bypassable, anyone can read
     * moderation-queue content — which includes whatever a spammer just submitted, and is
     * exactly the leak SEC-00-c watches for at the build level.
     */
    const pending = await factory.createTestimonial({ approved: false });

    const anonAll = await anonApi.json<{ id: string }[]>(apiPaths.cms.testimonialsAll);
    expect(
      anonAll.some((t) => t.id === pending.id),
      'an unapproved testimonial must not be readable without an admin token',
    ).toBe(false);

    /** And it IS visible to a real admin, so the gate is not simply broken shut. */
    const adminAll = await api.json<{ id: string }[]>(apiPaths.cms.testimonialsAll);
    expect(adminAll.some((t) => t.id === pending.id), 'an admin must see the moderation queue').toBe(true);
  });

  test('SEC-07 INACTIVE departments are not readable by an anonymous caller', async ({ anonApi, api, factory }) => {
    const hidden = await factory.createDepartment({ status: 'INACTIVE' });

    const anonAll = await anonApi.json<{ id: string }[]>(apiPaths.departments.all);
    expect(
      anonAll.some((d) => d.id === hidden.id),
      'an INACTIVE department must not be exposed via the public ?all=true parameter',
    ).toBe(false);

    const adminAll = await api.json<{ id: string }[]>(apiPaths.departments.all);
    expect(adminAll.some((d) => d.id === hidden.id)).toBe(true);
  });

  test('SEC-08 the public testimonial list contains only approved records', async ({ anonApi }) => {
    const list = await anonApi.json<{ approved?: boolean }[]>(apiPaths.cms.testimonials);
    for (const t of list) {
      /** `approved` may be omitted from the public projection; if present it must be true. */
      if (t.approved !== undefined) expect(t.approved).toBe(true);
    }
  });
});

test.describe('SEC data exposure - IDOR', () => {
  test('SEC-09 a CUSTOMER cannot read another user\'s booking by id', async ({
    anonApi,
    customerToken,
    factory,
  }) => {
    const booking = await factory.createBooking();

    /**
     * `GET /bookings/:id` is `@Roles(ADMIN, SUPER_ADMIN)`, so a customer must be refused
     * outright — there is no "own bookings" scope in this app. A 200 here would mean any
     * registered user could enumerate every customer's contact details and event plans.
     */
    const res = await anonApi.as(customerToken).get(apiPaths.bookings.one(booking.id));
    expect(res.status(), 'booking detail must be admin-only').toBe(403);
  });

  test('SEC-10 an anonymous caller cannot read a booking by id', async ({ anonApi, factory }) => {
    const booking = await factory.createBooking();
    expect((await anonApi.get(apiPaths.bookings.one(booking.id))).status()).toBe(401);
  });

  test('SEC-11 booking references are not guessable from the response', async ({ anonApi, factory }) => {
    /**
     * `Booking.reference` is `@default(cuid())`, so it is not sequential. Asserted because
     * a sequential reference plus an unauthenticated lookup would be a trivial enumeration
     * path if such an endpoint is ever added.
     */
    const a = await factory.createBooking();
    const b = await factory.createBooking();
    expect(a.reference).not.toBe(b.reference);
    expect(a.reference.length, 'a cuid, not a counter').toBeGreaterThan(20);
    void anonApi;
  });
});

test.describe('SEC data exposure - error bodies', () => {
  test('SEC-12 error responses carry no stack traces or ORM internals', async ({ anonApi, api }) => {
    const probes = [
      await anonApi.get(apiPaths.vendors.one('does-not-exist')),
      await anonApi.get(apiPaths.cms.legal('nope' as 'terms')),
      await anonApi.post(apiPaths.auth.login, { email: 'not-an-email', password: 'x' }),
      await api.post(apiPaths.departments.list, {}),
      await api.patch(apiPaths.bookings.status('does-not-exist'), { status: 'NOPE' }),
    ];

    for (const res of probes) {
      const text = await res.text();
      /**
       * `AllExceptionsFilter` normalises everything into a clean envelope. A leaked stack
       * trace or Prisma error reveals the file layout, the ORM version and often the SQL —
       * all useful to an attacker and all avoidable.
       */
      expect(text, 'no stack traces in error bodies').not.toMatch(/\n\s+at\s|\.ts:\d+:\d+/);
      expect(text, 'no Prisma internals in error bodies').not.toMatch(/PrismaClient|P20\d\d|invalid `prisma\./i);
      expect(text, 'no raw Postgres errors in error bodies').not.toMatch(/PostgresError|relation ".*" does not exist/i);
      expect(text, 'no filesystem paths in error bodies').not.toMatch(/\/Users\/|\/home\/|node_modules/);
    }
  });
});
