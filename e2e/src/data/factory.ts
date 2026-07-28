import type { ApiClient } from '@fixtures/api-client';
import { apiPaths } from '@config/urls';
import { run } from '@config/env';

/**
 * Test-data factory.
 *
 * Strategy: **API-created per test, prefixed per (run, worker, test); seeded data
 * is read-only; deleted in reverse order at test teardown; swept by prefix as
 * insurance.**
 *
 * Why prefixed names rather than fixed ones — the unique constraints in
 * `backend/prisma/schema.prisma` force it:
 *
 *   Vendor.slug           @unique (global)   ← `slug: dto.slug ?? slugify(dto.name)`
 *   Department.slug       @unique (global)
 *   User.email            @unique
 *   Category  @@unique([departmentId, slug])
 *   CmsBlock.key          @unique
 *
 * Two workers both creating "Test Vendor" both derive `test-vendor`, Prisma raises
 * P2002 and `AllExceptionsFilter` turns it into a 409. Because the slug is derived
 * from the name server-side, a unique NAME buys slug uniqueness for free — nothing
 * needs to compute a slug client-side.
 *
 * Why not mutate the seeded records: the seed is the shared read-only fixture set
 * for every public-site assertion. Mutating it would make test order significant
 * and would let one failing test corrupt the fixtures for the rest of the run.
 *
 * Why not reset the DB between tests: `prisma migrate reset` against a Neon branch
 * is 30-90s and is inherently global — it would force `workers: 1` and turn a
 * six-minute suite into an hour.
 */

// --------------------------------------------------------------------- types

export type Department = { id: string; name: string; slug: string; status: string };
export type Vendor = { id: string; name: string; slug: string; departmentId: string; status: string };
export type Package = { id: string; name: string; vendorId: string; price: string | number };
export type Booking = { id: string; reference: string; customerName: string; customerEmail: string; status: string };
export type Testimonial = { id: string; name: string; message: string; approved: boolean };
export type Faq = { id: string; question: string; answer: string };

type Cleanup = { label: string; run: () => Promise<void> };

// ------------------------------------------------------------------- factory

export class DataFactory {
  private seq = 0;
  private readonly cleanups: Cleanup[] = [];

  /**
   * @param api    an admin-authenticated client
   * @param prefix `E2E-{runId}-w{worker}-t{testId}` — see `test.ts`
   */
  constructor(
    private readonly api: ApiClient,
    readonly prefix: string,
  ) {}

  /** A globally-unique, self-identifying name. Slug uniqueness follows from it. */
  name(label: string): string {
    this.seq += 1;
    return `${this.prefix}-${label}-${this.seq}`;
  }

  /** A globally-unique email on a domain that can never receive real mail. */
  email(label: string): string {
    this.seq += 1;
    return `${this.prefix}-${label}-${this.seq}`.toLowerCase().replace(/[^a-z0-9.-]/g, '-') + '@utsava.test';
  }

  private track(label: string, fn: () => Promise<void>): void {
    this.cleanups.push({ label, run: fn });
  }

  // ------------------------------------------------------------- departments

  async createDepartment(overrides: Partial<{ name: string; description: string; icon: string; status: string }> = {}): Promise<Department> {
    const res = await this.api.post(apiPaths.departments.list, {
      name: overrides.name ?? this.name('dept'),
      description: overrides.description ?? 'Created by the E2E suite.',
      icon: overrides.icon ?? '🧪',
      ...(overrides.status ? { status: overrides.status } : {}),
    });
    if (!res.ok()) throw new Error(`createDepartment → ${res.status()} ${await res.text()}`);
    const dept = (await res.json()) as Department;
    /**
     * Department deletion CASCADES to its vendors, their packages, its categories
     * and its items (see the `onDelete: Cascade` relations). So a department
     * teardown implicitly cleans everything created under it, and registering the
     * children too is harmless because deletes are 404-tolerant below.
     */
    this.track(`department ${dept.name}`, async () => {
      await this.api.delete(apiPaths.departments.one(dept.id));
    });
    return dept;
  }

  // ----------------------------------------------------------------- vendors

  /**
   * @param opts.ownDepartment create a dedicated department first (default true).
   *
   * This default is not cosmetic. `VendorsService` runs
   * `demoteOtherFeatured(vendorId, departmentId)` whenever `featured: true` is
   * set, which silently un-features a SIBLING vendor in the same department. A
   * spec that features a vendor inside a seeded department therefore mutates
   * shared fixture data and breaks the home page's Best Events slider for every
   * other test in the run. Owning the department confines the demotion to your
   * own records.
   */
  async createVendor(
    overrides: Partial<{
      name: string;
      departmentId: string;
      description: string;
      location: string;
      availableCities: string[];
      priceFrom: number;
      priceTo: number;
      contactNumber: string;
      email: string;
      featured: boolean;
      trending: boolean;
      verified: boolean;
      available: boolean;
      status: 'ACTIVE' | 'INACTIVE';
      latitude: number;
      longitude: number;
      gallery: string[];
    }> = {},
    opts: { ownDepartment?: boolean } = {},
  ): Promise<Vendor & { department: Department | null }> {
    let department: Department | null = null;
    let departmentId = overrides.departmentId;

    if (!departmentId) {
      if (opts.ownDepartment === false) {
        const list = await this.api.json<Department[]>(apiPaths.departments.list);
        if (!list.length) throw new Error('No departments exist — was the database seeded?');
        departmentId = list[0].id;
      } else {
        department = await this.createDepartment();
        departmentId = department.id;
      }
    }

    const res = await this.api.post(apiPaths.vendors.list, {
      name: overrides.name ?? this.name('vendor'),
      departmentId,
      description: overrides.description ?? 'A vendor created by the E2E suite.',
      location: overrides.location ?? 'Bengaluru',
      availableCities: overrides.availableCities ?? ['Bengaluru'],
      priceFrom: overrides.priceFrom ?? 10_000,
      priceTo: overrides.priceTo ?? 50_000,
      contactNumber: overrides.contactNumber ?? '+91 90000 00000',
      email: overrides.email ?? 'vendor@utsava.test',
      featured: overrides.featured ?? false,
      trending: overrides.trending ?? false,
      verified: overrides.verified ?? false,
      available: overrides.available ?? true,
      status: overrides.status ?? 'ACTIVE',
      ...(overrides.latitude !== undefined ? { latitude: overrides.latitude } : {}),
      ...(overrides.longitude !== undefined ? { longitude: overrides.longitude } : {}),
      ...(overrides.gallery ? { gallery: overrides.gallery } : {}),
    });
    if (!res.ok()) throw new Error(`createVendor → ${res.status()} ${await res.text()}`);
    const vendor = (await res.json()) as Vendor;

    this.track(`vendor ${vendor.name}`, async () => {
      await this.api.delete(apiPaths.vendors.one(vendor.id));
    });
    return { ...vendor, department };
  }

  // ---------------------------------------------------------------- packages

  async createPackage(
    vendorId: string,
    overrides: Partial<{ name: string; price: number; features: string[]; popular: boolean; sortOrder: number }> = {},
  ): Promise<Package> {
    const res = await this.api.post(apiPaths.packages.list, {
      vendorId,
      name: overrides.name ?? this.name('pkg'),
      price: overrides.price ?? 25_000,
      features: overrides.features ?? ['E2E feature one', 'E2E feature two'],
      popular: overrides.popular ?? false,
      ...(overrides.sortOrder !== undefined ? { sortOrder: overrides.sortOrder } : {}),
    });
    if (!res.ok()) throw new Error(`createPackage → ${res.status()} ${await res.text()}`);
    const pkg = (await res.json()) as Package;
    this.track(`package ${pkg.name}`, async () => {
      await this.api.delete(apiPaths.packages.one(pkg.id));
    });
    return pkg;
  }

  // ---------------------------------------------------------------- bookings

  /**
   * `POST /bookings` is `@Public()` and throttled to 8/min, so this uses an
   * unauthenticated call path deliberately — it is the same path the real booking
   * form takes.
   *
   * There is NO delete endpoint for bookings, so these cannot be cleaned up. They
   * accumulate for the lifetime of the branch, which is fine (the branch is
   * destroyed at the end of the run) but means an admin-bookings spec must never
   * assert an absolute row count.
   */
  async createBooking(
    overrides: Partial<{
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      vendorId: string;
      packageId: string;
      eventDate: string;
      location: string;
      guestCount: number;
      budget: number;
      specialRequirements: string;
    }> = {},
  ): Promise<Booking> {
    const res = await this.api.post(apiPaths.bookings.create, {
      customerName: overrides.customerName ?? this.name('customer'),
      customerEmail: overrides.customerEmail ?? this.email('customer'),
      ...(overrides.customerPhone ? { customerPhone: overrides.customerPhone } : {}),
      ...(overrides.vendorId ? { vendorId: overrides.vendorId } : {}),
      ...(overrides.packageId ? { packageId: overrides.packageId } : {}),
      ...(overrides.eventDate ? { eventDate: overrides.eventDate } : {}),
      ...(overrides.location ? { location: overrides.location } : {}),
      ...(overrides.guestCount !== undefined ? { guestCount: overrides.guestCount } : {}),
      ...(overrides.budget !== undefined ? { budget: overrides.budget } : {}),
      ...(overrides.specialRequirements ? { specialRequirements: overrides.specialRequirements } : {}),
    });
    if (!res.ok()) throw new Error(`createBooking → ${res.status()} ${await res.text()}`);
    return (await res.json()) as Booking;
  }

  // ------------------------------------------------------------ cms content

  /** Admin-created testimonials default to `approved: false` unless asked otherwise. */
  async createTestimonial(
    overrides: Partial<{ name: string; message: string; role: string; rating: number; approved: boolean }> = {},
  ): Promise<Testimonial> {
    const res = await this.api.post(apiPaths.cms.testimonials, {
      name: overrides.name ?? this.name('review'),
      message: overrides.message ?? 'A review created by the E2E suite.',
      role: overrides.role ?? 'Tester',
      rating: overrides.rating ?? 5,
      ...(overrides.approved !== undefined ? { approved: overrides.approved } : {}),
    });
    if (!res.ok()) throw new Error(`createTestimonial → ${res.status()} ${await res.text()}`);
    const t = (await res.json()) as Testimonial;
    this.track(`testimonial ${t.name}`, async () => {
      await this.api.delete(apiPaths.cms.testimonial(t.id));
    });
    return t;
  }

  /** The public, unauthenticated submission path. Always lands `approved: false`. */
  async submitTestimonial(
    overrides: Partial<{ name: string; message: string; role: string; rating: number }> = {},
  ): Promise<void> {
    const res = await this.api.as(null).post(apiPaths.cms.testimonialSubmit, {
      name: overrides.name ?? this.name('public-review'),
      message: overrides.message ?? 'A public review submitted by the E2E suite.',
      role: overrides.role ?? 'Guest',
      rating: overrides.rating ?? 5,
    });
    if (!res.ok()) throw new Error(`submitTestimonial → ${res.status()} ${await res.text()}`);
  }

  async createFaq(overrides: Partial<{ question: string; answer: string; category: string }> = {}): Promise<Faq> {
    const res = await this.api.post(apiPaths.cms.faqs, {
      question: overrides.question ?? `${this.name('faq')}?`,
      answer: overrides.answer ?? 'An answer created by the E2E suite.',
      ...(overrides.category ? { category: overrides.category } : {}),
    });
    if (!res.ok()) throw new Error(`createFaq → ${res.status()} ${await res.text()}`);
    const faq = (await res.json()) as Faq;
    this.track(`faq ${faq.question}`, async () => {
      await this.api.delete(apiPaths.cms.faq(faq.id));
    });
    return faq;
  }

  /**
   * Snapshot a CMS singleton and restore it at teardown.
   *
   * `site-contact`, `home-stats`, `legal-terms` and `legal-privacy` are ONE ROW
   * each — last writer wins. Every spec touching them must be `@serial`, and must
   * put the value back or it leaks into every subsequent public-page assertion.
   */
  async snapshotAndRestore<T>(label: string, read: () => Promise<T>, write: (value: T) => Promise<void>): Promise<T> {
    const original = await read();
    this.track(`restore ${label}`, async () => {
      await write(original);
    });
    return original;
  }

  // ---------------------------------------------------------------- teardown

  /**
   * Delete everything this test created, newest first.
   *
   * Reverse order matters: a package must go before its vendor, and a vendor
   * before its department, or the cascade races the explicit delete.
   *
   * Failures are logged, never thrown — a cleanup error must not mask the test's
   * real result, and the end-of-run prefix sweep in `global.teardown.ts` catches
   * anything left behind.
   */
  async cleanup(): Promise<void> {
    const failures: string[] = [];
    for (const { label, run: doIt } of [...this.cleanups].reverse()) {
      try {
        await doIt();
      } catch (err) {
        failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.cleanups.length = 0;
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[factory] ${failures.length} cleanup step(s) failed for ${this.prefix}. ` +
          `The end-of-run prefix sweep will retry.\n  ${failures.join('\n  ')}`,
      );
    }
  }
}

/**
 * End-of-run insurance sweep.
 *
 * Deletes anything whose name still carries this run's prefix — records orphaned
 * by a hard-killed worker, which per-test cleanup never got to. Scoped by prefix
 * so it can never touch seeded fixtures or another run's data.
 *
 * `GET /vendors?search=` filters on `name: { contains, mode: 'insensitive' }`,
 * which is what makes a prefix search possible at all.
 */
export async function sweepByPrefix(api: ApiClient, prefix = `E2E-${run.id}`): Promise<number> {
  let deleted = 0;

  const vendors = await api
    .json<{ data: Vendor[] }>(`${apiPaths.vendors.list}?search=${encodeURIComponent(prefix)}&limit=200`)
    .catch(() => ({ data: [] as Vendor[] }));
  for (const v of vendors.data) {
    if (!v.name.startsWith(prefix)) continue;
    if ((await api.delete(apiPaths.vendors.one(v.id))).ok()) deleted += 1;
  }

  const departments = await api.json<Department[]>(apiPaths.departments.all).catch(() => [] as Department[]);
  for (const d of departments) {
    if (!d.name.startsWith(prefix)) continue;
    if ((await api.delete(apiPaths.departments.one(d.id))).ok()) deleted += 1;
  }

  const testimonials = await api
    .json<Testimonial[]>(apiPaths.cms.testimonialsAll)
    .catch(() => [] as Testimonial[]);
  for (const t of testimonials) {
    if (!t.name.startsWith(prefix)) continue;
    if ((await api.delete(apiPaths.cms.testimonial(t.id))).ok()) deleted += 1;
  }

  const faqs = await api.json<Faq[]>(apiPaths.cms.faqsAll).catch(() => [] as Faq[]);
  for (const f of faqs) {
    if (!f.question.startsWith(prefix)) continue;
    if ((await api.delete(apiPaths.cms.faq(f.id))).ok()) deleted += 1;
  }

  return deleted;
}
