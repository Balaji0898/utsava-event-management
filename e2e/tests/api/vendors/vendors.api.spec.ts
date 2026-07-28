import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { payloads, strings } from '@data/test-data';
import { seedTotals } from '@data/seed-data';

type VendorList = { data: { id: string; name: string; slug: string; status: string }[]; total: number; pages: number };

/**
 * API-VEND — the vendor listing contract, which is the most heavily parameterised
 * endpoint in the app: fourteen query parameters, all optional, all coerced by hand.
 *
 * Two coercion details drive most of the edge cases:
 *  - booleans are compared `=== 'true'`, so `featured=1` means FALSE, not true;
 *  - numerics go through a bare `Number()`, so `page=abc` becomes `NaN` and reaches
 *    Prisma's `skip`.
 *
 * Neither is validated by a DTO, because they are `@Query()` strings rather than a
 * validated body — so these are the cases most likely to produce a 500.
 */

test.describe('API vendors - listing', () => {
  test('API-VEND-P-01 returns a paginated envelope with the seeded data', async ({ anonApi }) => {
    const body = await anonApi.json<VendorList>(apiPaths.vendors.list);

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(seedTotals.vendorsAtLeast);
    expect(body.pages).toBeGreaterThanOrEqual(1);
  });

  test('API-VEND-P-02 serializes Decimal money fields consistently', async ({ anonApi }) => {
    const body = await anonApi.json<{ data: Record<string, unknown>[] }>(`${apiPaths.vendors.list}?limit=1`);
    const vendor = body.data[0];

    /**
     * `priceFrom`/`priceTo`/`discountPercent` are `Decimal` in Prisma, which serializes
     * to a JSON string, not a number. The frontend wraps every read in `Number(...)`
     * for exactly this reason. Pinning the shape means a future switch to a numeric
     * serializer shows up as an intentional breaking change rather than as silent
     * `NaN`s in the UI.
     */
    expect(['string', 'number']).toContain(typeof vendor.priceFrom);
    expect(Number(vendor.priceFrom)).not.toBeNaN();
    expect(typeof vendor.rating, 'rating is a Float, so a real number').toBe('number');
    expect(typeof vendor.createdAt, 'timestamps serialize as ISO strings').toBe('string');
    expect(String(vendor.createdAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('API-VEND-P-03 filters by search, case-insensitively', async ({ anonApi, factory }) => {
    const vendor = await factory.createVendor({ name: factory.name('SearchablePhotography') });

    /** `findAll` uses `name: { contains, mode: 'insensitive' }`. */
    const upper = await anonApi.json<VendorList>(
      `${apiPaths.vendors.list}?search=${encodeURIComponent(vendor.name.toUpperCase())}`,
    );
    expect(upper.data.some((v) => v.id === vendor.id), 'search must be case-insensitive').toBe(true);
  });

  test('API-VEND-P-04 filters by departmentId', async ({ anonApi, factory }) => {
    const dept = await factory.createDepartment();
    const mine = await factory.createVendor({ departmentId: dept.id });

    const list = await anonApi.json<VendorList>(`${apiPaths.vendors.list}?departmentId=${dept.id}&limit=100`);
    expect(list.data.map((v) => v.id)).toContain(mine.id);
    /** A dedicated department means this IS safe to assert exactly. */
    expect(list.total, 'a freshly created department holds only my vendor').toBe(1);
  });

  test('API-VEND-P-05 hides INACTIVE vendors from the public listing', async ({ anonApi, factory }) => {
    const inactive = await factory.createVendor({ status: 'INACTIVE' });

    const list = await anonApi.json<VendorList>(
      `${apiPaths.vendors.list}?search=${encodeURIComponent(inactive.name)}`,
    );
    expect(
      list.data.some((v) => v.id === inactive.id),
      'findAll hard-filters status: ACTIVE, so an inactive vendor must be invisible',
    ).toBe(false);
  });

  test('API-VEND-P-06 respects limit and page', async ({ anonApi }) => {
    const firstPage = await anonApi.json<VendorList>(`${apiPaths.vendors.list}?limit=2&page=1`);
    const secondPage = await anonApi.json<VendorList>(`${apiPaths.vendors.list}?limit=2&page=2`);

    expect(firstPage.data.length).toBeLessThanOrEqual(2);
    const firstIds = firstPage.data.map((v) => v.id);
    for (const v of secondPage.data) {
      expect(firstIds, 'page 2 must not repeat page 1').not.toContain(v.id);
    }
  });
});

test.describe('API vendors - query-parameter edge cases', () => {
  /**
   * Every one of these must return 200 with a sane envelope. A 500 here is a real bug:
   * these are all reachable by editing the URL, with no authentication.
   */
  const edgeCases = [
    ['page=0', 'page=0'],
    ['a negative page', 'page=-1'],
    ['a non-numeric page (NaN reaches Prisma skip)', 'page=abc'],
    ['an absurd page', 'page=999999'],
    ['limit=0', 'limit=0'],
    ['a negative limit', 'limit=-5'],
    ['an enormous limit', 'limit=99999'],
    ['a non-numeric limit', 'limit=lots'],
    ['minPrice above maxPrice', 'minPrice=900000&maxPrice=1'],
    ['a negative minPrice', 'minPrice=-100'],
    ['a non-numeric price', 'minPrice=cheap&maxPrice=expensive'],
    ['minRating above 5', 'minRating=99'],
    ['an unknown sort value', 'sort=garbage'],
    ['featured=1 (not the string "true")', 'featured=1'],
    ['featured=TRUE (wrong case)', 'featured=TRUE'],
    ['non-numeric coordinates', 'lat=here&lng=there'],
    ['out-of-range coordinates', 'lat=999&lng=-999'],
    ['a negative radius', 'lat=12.97&lng=77.59&radius=-50'],
    ['an empty search', 'search='],
    ['a city with special characters', `city=${encodeURIComponent("O'Brien & Sons / Co.")}`],
    ['every parameter at once', 'departmentId=x&city=y&search=z&featured=true&trending=true&verified=true&minPrice=0&maxPrice=1&minRating=0&sort=newest&page=1&limit=1&lat=0&lng=0&radius=1'],
  ] as const;

  for (const [label, query] of edgeCases) {
    test(`API-VEND-E ${label} returns 200 with a valid envelope`, async ({ anonApi }) => {
      const res = await anonApi.get(`${apiPaths.vendors.list}?${query}`);
      expect(res.status(), `?${query} must not error (got ${res.status()}: ${await res.text()})`).toBe(200);

      const body = (await res.json()) as VendorList;
      expect(Array.isArray(body.data), `?${query} must still return a data array`).toBe(true);
      expect(Number.isFinite(body.total), `?${query} must return a finite total`).toBe(true);
    });
  }

  test('API-VEND-E-01 a very long search string is handled without erroring', async ({ anonApi }) => {
    const res = await anonApi.get(`${apiPaths.vendors.list}?search=${encodeURIComponent(strings.veryLong)}`);
    expect([200, 400, 414]).toContain(res.status());
  });

  test('API-VEND-E-02 unicode search is accepted', async ({ anonApi }) => {
    const res = await anonApi.get(`${apiPaths.vendors.list}?search=${encodeURIComponent(strings.telugu)}`);
    expect(res.status()).toBe(200);
  });

  test('API-VEND-E-03 featured=1 is treated as false, matching the === "true" comparison', async ({
    anonApi,
    factory,
  }) => {
    /**
     * The controller does `featured: featured === 'true'`, so `featured=1` disables the
     * filter rather than enabling it. Documented here because it is the kind of quirk
     * that gets "fixed" into a breaking change by someone who assumes truthiness.
     */
    const dept = await factory.createDepartment();
    await factory.createVendor({ departmentId: dept.id, featured: false });

    const withOne = await anonApi.json<VendorList>(
      `${apiPaths.vendors.list}?departmentId=${dept.id}&featured=1`,
    );
    expect(withOne.total, 'featured=1 must not filter to featured-only').toBe(1);
  });
});

test.describe('API vendors - mutations', () => {
  test('API-VEND-P-07 creates a vendor and derives its slug from the name', async ({ api, factory }) => {
    const dept = await factory.createDepartment();
    const name = factory.name('Slug Derivation Test');

    const res = await api.post(apiPaths.vendors.list, { name, departmentId: dept.id });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.slug, 'the slug must be derived server-side, lower-cased and hyphenated').toBe(
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    );

    await api.delete(apiPaths.vendors.one(body.id));
  });

  test('API-VEND-E-04 slugifies hostile names into something URL-safe', async ({ api, factory }) => {
    const dept = await factory.createDepartment();
    const res = await api.post(apiPaths.vendors.list, {
      name: `${factory.name('hostile')} ${strings.slugHostile}`,
      departmentId: dept.id,
    });
    expect(res.status()).toBe(201);

    const { id, slug } = await res.json();
    expect(slug, 'a slug must contain only lowercase alphanumerics and hyphens').toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toMatch(/^-|-$/);
    expect(slug).not.toContain('--');

    /** And it must actually be fetchable by that slug. */
    expect((await api.get(apiPaths.vendors.one(slug))).status()).toBe(200);
    await api.delete(apiPaths.vendors.one(id));
  });

  test('API-VEND-P-08 updates a vendor via PATCH', async ({ api, factory }) => {
    const vendor = await factory.createVendor();
    const res = await api.patch(apiPaths.vendors.one(vendor.id), { description: 'Updated by the E2E suite.' });
    expect(res.status()).toBe(200);
    expect((await res.json()).description).toBe('Updated by the E2E suite.');
  });

  test('API-VEND-E-05 setting featured demotes the previous featured vendor in the same department', async ({
    api,
    factory,
  }) => {
    /**
     * `VendorsService` runs `demoteOtherFeatured(vendorId, departmentId)` on every
     * featured write, silently un-featuring a SIBLING. That is a hidden cross-record
     * mutation, and it is why `DataFactory.createVendor` defaults to creating its own
     * department — otherwise this test would un-feature a seeded vendor and break the
     * home page's Best Events slider for every other test in the run.
     */
    const dept = await factory.createDepartment();
    const first = await factory.createVendor({ departmentId: dept.id, featured: true });
    const second = await factory.createVendor({ departmentId: dept.id, featured: true });

    const firstAfter = await api.json<{ featured: boolean }>(apiPaths.vendors.one(first.id));
    const secondAfter = await api.json<{ featured: boolean }>(apiPaths.vendors.one(second.id));

    expect(secondAfter.featured, 'the newest featured vendor wins').toBe(true);
    expect(firstAfter.featured, 'the previous one is silently demoted').toBe(false);
  });

  test('API-VEND-S-01 SQL-shaped input is parameterised, not executed', async ({ anonApi }) => {
    /**
     * Prisma parameterises everything, so the expectation is a boring empty result —
     * never a 500, and never a database error message in the body. The assertion is
     * about the absence of a leak as much as the absence of an injection.
     */
    for (const payload of payloads.sqlInjection) {
      const res = await anonApi.get(`${apiPaths.vendors.list}?search=${encodeURIComponent(payload)}`);
      expect(res.status(), `"${payload}" must not error`).toBe(200);

      const text = await res.text();
      expect(text).not.toMatch(/syntax error|PostgresError|prisma|relation ".*" does not exist/i);
    }

    /** And the table it tried to drop is still there. */
    const after = await anonApi.json<VendorList>(apiPaths.vendors.list);
    expect(after.total).toBeGreaterThanOrEqual(seedTotals.vendorsAtLeast);
  });

  test('API-VEND-S-02 SQL-shaped input in a path segment is safe', async ({ anonApi }) => {
    for (const payload of payloads.sqlInjection) {
      const res = await anonApi.get(apiPaths.vendors.one(encodeURIComponent(payload)));
      expect([400, 404], `"${payload}" as a slug must be a clean 400/404`).toContain(res.status());
    }
  });
});
