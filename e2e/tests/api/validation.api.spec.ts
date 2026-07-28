import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { numbers, payloads, strings } from '@data/test-data';

/**
 * API-VAL — the DTO validation sweep.
 *
 * Two properties are under test, and they pull in opposite directions:
 *
 *  1. **Declared constraints are enforced.** Missing required fields, wrong types,
 *     out-of-range numbers and invalid enum values must all be 400 — never a 500,
 *     and never a silent write.
 *
 *  2. **Undeclared properties are STRIPPED, not rejected.** `main.ts` configures
 *     `ValidationPipe({ whitelist: true, forbidNonWhitelisted: false })`, so an extra
 *     field is dropped rather than 400ing. That is the mass-assignment control and it
 *     is deliberate (rejecting would break forms that post extra fields), so the tests
 *     assert the stripping rather than a rejection.
 */

test.describe('API validation - required fields', () => {
  /** [label, method, path, invalidBody] — one row per required-field omission. */
  const missingRequired = [
    ['booking without customerName', 'POST', apiPaths.bookings.create, { customerEmail: 'a@b.test' }],
    ['booking without customerEmail', 'POST', apiPaths.bookings.create, { customerName: 'No Email' }],
    ['department without name', 'POST', apiPaths.departments.list, { description: 'no name' }],
    ['category without departmentId', 'POST', apiPaths.categories.list, { name: 'Orphan' }],
    ['category without name', 'POST', apiPaths.categories.list, { departmentId: 'x' }],
    ['faq without answer', 'POST', apiPaths.cms.faqs, { question: 'Where is the answer?' }],
    ['faq without question', 'POST', apiPaths.cms.faqs, { answer: 'Answer with no question' }],
    ['testimonial without message', 'POST', apiPaths.cms.testimonials, { name: 'No Message' }],
    ['testimonial without name', 'POST', apiPaths.cms.testimonials, { message: 'No name' }],
    ['legal without content', 'PUT', apiPaths.cms.legal('terms'), {}],
    ['stats without items', 'PUT', apiPaths.cms.stats, {}],
  ] as const;

  for (const [label, method, path, body] of missingRequired) {
    test(`API-VAL-N ${label} is rejected with 400`, async ({ api }) => {
      const res = await api.call(method, path, body);
      expect(res.status(), `${method} ${path} — ${label}`).toBe(400);
    });
  }
});

test.describe('API validation - type and range constraints', () => {
  const badValues = [
    ['guestCount as a non-integer', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', guestCount: 2.5,
    }],
    ['guestCount as a string', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', guestCount: 'many',
    }],
    ['budget as a string', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', budget: 'lots',
    }],
    ['items as a non-array', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', items: 'not-an-array',
    }],
    ['a non-ISO eventDate', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', eventDate: '31-12-2026',
    }],
    ['an empty-string eventDate', 'POST', apiPaths.bookings.create, {
      customerName: 'X', customerEmail: 'x@utsava.test', eventDate: '',
    }],
    ['rating below the minimum', 'POST', apiPaths.cms.testimonials, {
      name: 'X', message: 'Y', rating: numbers.ratingBelowMin,
    }],
    ['rating above the maximum', 'POST', apiPaths.cms.testimonials, {
      name: 'X', message: 'Y', rating: numbers.ratingAboveMax,
    }],
    ['a bogus Status enum value', 'POST', apiPaths.departments.list, {
      name: 'Bad Status', status: 'PROBABLY',
    }],
    ['a bogus BookingStatus enum value', 'PATCH', apiPaths.bookings.status('does-not-exist'), {
      status: 'ALMOST_CONFIRMED',
    }],
    ['a non-numeric sortOrder', 'POST', apiPaths.cms.faqs, {
      question: 'Q', answer: 'A', sortOrder: 'first',
    }],
  ] as const;

  for (const [label, method, path, body] of badValues) {
    test(`API-VAL-N ${label} is rejected with 400`, async ({ api }) => {
      const res = await api.call(method, path, body);
      expect(res.status(), `${method} ${path} — ${label}`).toBe(400);
    });
  }

  test('API-VAL-N-01 an empty-string eventDate is a 400 — the root cause of bug B2', async ({ anonApi }) => {
    /**
     * class-validator's `@IsOptional()` skips only `null` and `undefined`, so an empty
     * string reaches `@IsDateString()` and fails. The booking form's zod schema uses
     * `z.string().optional()`, which happily accepts `''` — so a user who leaves the
     * date blank gets a 400 from the API with no field-level explanation.
     *
     * Pinned at the API layer here; the UI consequence is BOOK-N-06.
     */
    const res = await anonApi.post(apiPaths.bookings.create, {
      customerName: 'Empty Date',
      customerEmail: 'empty.date@utsava.test',
      eventDate: '',
    });
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/eventDate/i);
  });

  test('API-VAL-E-01 rating boundaries 1 and 5 are both accepted', async ({ api, factory }) => {
    for (const rating of [1, 5]) {
      const res = await api.post(apiPaths.cms.testimonials, {
        name: factory.name(`rating-${rating}`),
        message: 'Boundary check.',
        rating,
      });
      expect(res.status(), `rating ${rating} is inside @Min(1) @Max(5)`).toBe(201);
      /** Clean up immediately — the factory only tracks what it created itself. */
      await api.delete(apiPaths.cms.testimonial((await res.json()).id));
    }
  });

  test('API-VAL-E-02 ValidateNested rejects a malformed item inside UpdateStatsDto', async ({ api }) => {
    /**
     * `items` is `@ValidateNested({ each: true }) @Type(() => StatItemDto)`, so a bad
     * element must fail even though the outer array is well-formed. Nested validation
     * silently not running is a classic class-transformer misconfiguration.
     */
    const res = await api.put(apiPaths.cms.stats, {
      items: [{ label: 'Fine', value: 1 }, { label: 'Broken', value: 'not-a-number' }],
    });
    expect(res.status()).toBe(400);
  });

  test('API-VAL-E-03 accepts unicode and very long free text without erroring', async ({ api, factory }) => {
    /**
     * No DTO declares a max length, so long input must be stored or cleanly rejected —
     * never a 500. Telugu is the app's second locale, so it must round-trip unmangled.
     */
    const res = await api.post(apiPaths.cms.faqs, {
      question: `${factory.name('unicode')} ${strings.telugu} ${strings.emoji}?`,
      answer: strings.veryLong,
    });
    expect([201, 400], `got ${res.status()}`).toContain(res.status());
    if (res.status() === 201) {
      const body = await res.json();
      expect(body.question).toContain(strings.telugu);
      await api.delete(apiPaths.cms.faq(body.id));
    }
  });
});

test.describe('API validation - whitelist stripping (mass assignment)', () => {
  test('API-VAL-S-01 a public testimonial submission cannot self-approve', async ({ anonApi, api, factory }) => {
    const name = factory.name('self-approve');

    /**
     * `SubmitTestimonialDto` deliberately omits `approved`, so `whitelist: true` must
     * strip it. If it did not, any visitor could publish arbitrary content on the home
     * page with no moderation.
     */
    const res = await anonApi.post(apiPaths.cms.testimonialSubmit, {
      name,
      message: 'Trying to bypass moderation.',
      ...payloads.massAssignment.testimonialSubmit,
    });
    expect(res.status()).toBe(201);

    /** The public list returns approved records only, so absence there is the proof. */
    const publicList = await anonApi.json<{ name: string }[]>(apiPaths.cms.testimonials);
    expect(publicList.some((t) => t.name === name), 'a self-approved submission must not be public').toBe(false);

    /** And it IS present in the admin view, still unapproved. */
    const adminList = await api.json<{ id: string; name: string; approved: boolean }[]>(
      apiPaths.cms.testimonialsAll,
    );
    const created = adminList.find((t) => t.name === name);
    expect(created, 'the submission must still be recorded').toBeTruthy();
    expect(created?.approved).toBe(false);

    if (created) await api.delete(apiPaths.cms.testimonial(created.id));
  });

  test('API-VAL-S-02 extra properties are dropped rather than rejected', async ({ api, factory }) => {
    /**
     * `forbidNonWhitelisted: false` is intentional — 400ing on an unexpected field
     * would break any form that posts extra state. This asserts the chosen behaviour
     * explicitly so a future flip to `true` is a deliberate, visible decision.
     */
    const res = await api.post(apiPaths.departments.list, {
      name: factory.name('extra-props'),
      thisFieldDoesNotExist: 'should be silently dropped',
      id: 'attacker-chosen-id',
      createdAt: '1999-01-01T00:00:00.000Z',
    });
    expect(res.status(), 'an unknown property must not cause a rejection').toBe(201);

    const body = await res.json();
    expect(body).not.toHaveProperty('thisFieldDoesNotExist');
    expect(body.id, 'the id must be server-generated').not.toBe('attacker-chosen-id');
    expect(body.createdAt).not.toContain('1999');

    await api.delete(apiPaths.departments.one(body.id));
  });
});

test.describe('API validation - 404 and malformed identifiers', () => {
  const notFoundRoutes = [
    ['GET', apiPaths.vendors.one('definitely-not-a-real-id')],
    ['GET', apiPaths.departments.one('definitely-not-a-real-id')],
    ['GET', apiPaths.packages.one('definitely-not-a-real-id')],
    ['GET', apiPaths.categories.one('definitely-not-a-real-id')],
    ['GET', apiPaths.items.one('definitely-not-a-real-id')],
  ] as const;

  for (const [method, path] of notFoundRoutes) {
    test(`API-VAL-N-404 ${method} ${path} returns 404, not 500`, async ({ anonApi }) => {
      const res = await anonApi.call(method, path);
      expect(res.status(), `${path} must be a clean 404`).toBe(404);

      /** And the body must not carry a stack trace or a Prisma error dump. */
      const text = await res.text();
      expect(text).not.toMatch(/prisma|at Object\.|\.ts:\d+/i);
    });
  }

  test('API-VAL-N-05 an unknown legal slug is rejected with a helpful 400', async ({ anonApi }) => {
    const res = await anonApi.get(apiPaths.cms.legal('nope' as 'terms'));
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toContain('Unknown legal page');
  });

  test('API-VAL-E-04 GET /vendors/:idOrSlug resolves by both id and slug', async ({ anonApi }) => {
    const { data } = await anonApi.json<{ data: { id: string; slug: string }[] }>(
      `${apiPaths.vendors.list}?limit=1`,
    );
    const vendor = data[0];
    expect(vendor, 'the database must be seeded for this case to mean anything').toBeTruthy();

    const bySlug = await anonApi.get(apiPaths.vendors.one(vendor.slug));
    const byId = await anonApi.get(apiPaths.vendors.one(vendor.id));
    expect(bySlug.status()).toBe(200);
    expect(byId.status()).toBe(200);
    expect((await bySlug.json()).id).toBe(vendor.id);
  });
});

test.describe('API validation - uniqueness conflicts', () => {
  test('API-VAL-N-06 a duplicate department slug is a clean 409', async ({ api, factory }) => {
    const name = factory.name('dup');
    const first = await api.post(apiPaths.departments.list, { name });
    expect(first.status()).toBe(201);
    const firstId = (await first.json()).id;

    /**
     * `DepartmentsService.create` derives `slug: dto.slug ?? slugify(dto.name)`, so an
     * identical name collides on the unique slug. `AllExceptionsFilter` must map Prisma
     * P2002 to a 409 rather than letting a raw 500 escape.
     */
    const second = await api.post(apiPaths.departments.list, { name });
    expect(second.status(), 'a duplicate slug must be a 409, not a 500').toBe(409);
    expect(await second.text()).not.toMatch(/P2002|prisma/i);

    await api.delete(apiPaths.departments.one(firstId));
  });

  test('API-VAL-N-07 a duplicate vendor slug is a clean 409', async ({ api, factory }) => {
    const dept = await factory.createDepartment();
    const name = factory.name('dup-vendor');

    const first = await api.post(apiPaths.vendors.list, { name, departmentId: dept.id });
    expect(first.status()).toBe(201);

    const second = await api.post(apiPaths.vendors.list, { name, departmentId: dept.id });
    expect(second.status()).toBe(409);
  });
});

test.describe('API validation - cascade deletes', () => {
  test('API-VAL-P-01 deleting a department cascades to its vendors and packages', async ({ api, factory }) => {
    /**
     * The schema declares `onDelete: Cascade` from Department to Vendor, and from
     * Vendor to Package. So one delete removes three records — and the admin UI's
     * confirm text says only "Delete this department?", giving the operator no warning.
     * Pinning the behaviour here makes the blast radius explicit.
     */
    const dept = await factory.createDepartment();
    const vendor = await factory.createVendor({ departmentId: dept.id });
    const pkg = await factory.createPackage(vendor.id);

    expect((await api.get(apiPaths.vendors.one(vendor.id))).status()).toBe(200);
    expect((await api.get(apiPaths.packages.one(pkg.id))).status()).toBe(200);

    const deleted = await api.delete(apiPaths.departments.one(dept.id));
    expect(deleted.ok()).toBeTruthy();

    expect((await api.get(apiPaths.vendors.one(vendor.id))).status(), 'the vendor must be gone').toBe(404);
    expect((await api.get(apiPaths.packages.one(pkg.id))).status(), 'the package must be gone').toBe(404);
  });

  test('API-VAL-P-02 deleting a vendor cascades to packages but keeps the booking', async ({ api, factory }) => {
    const vendor = await factory.createVendor();
    const pkg = await factory.createPackage(vendor.id);
    const booking = await factory.createBooking({ vendorId: vendor.id, packageId: pkg.id });

    await api.delete(apiPaths.vendors.one(vendor.id));

    expect((await api.get(apiPaths.packages.one(pkg.id))).status()).toBe(404);

    /**
     * `Booking.vendorId` and `packageId` are nullable and NOT cascading, so the booking
     * survives with null references — the commercial record is preserved even when the
     * vendor is removed, which is the right call and worth locking in.
     */
    const kept = await api.get(apiPaths.bookings.one(booking.id));
    expect(kept.status(), 'the booking must survive its vendor being deleted').toBe(200);
    expect((await kept.json()).vendorId).toBeNull();
  });
});
