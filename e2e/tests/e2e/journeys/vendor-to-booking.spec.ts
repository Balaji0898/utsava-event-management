import { test, expect, serial } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { messages } from '@data/test-data';
import { seededContact } from '@data/seed-data';

/**
 * JOURNEY — the commercial path, end to end, across both actors:
 *
 *   an admin creates a vendor through the form
 *     → and adds a pricing package to it
 *     → the vendor is reachable on the public site at its derived slug
 *     → a visitor books that package
 *     → the booking lands in the admin queue as PENDING
 *     → the admin confirms it
 *
 * This is the only test that proves the app does the thing it exists to do. Every step
 * crosses a boundary that could break alone: the create form's redirect-to-edit behaviour,
 * server-side slug derivation, the 300-second data cache, query-string parameter passing,
 * and the booking status transition.
 *
 * Serial: it mutates shared vendor/package/booking state and hits the 8/min booking limit.
 */
serial();

test.describe('Journey - admin creates a vendor, a customer books it', () => {
  test('JOURNEY-03 the full create → publish → book → confirm path @smoke', async ({
    vendorFormPage,
    adminVendorsPage,
    vendorDetailPage,
    bookPage,
    bookingsPage,
    api,
    factory,
  }) => {
    // ------------------------------------------- 1. admin creates the vendor
    /**
     * Its own department, deliberately: setting `featured` later would otherwise demote a
     * seeded vendor via `demoteOtherFeatured` and break the home slider for the whole run.
     */
    const department = await factory.createDepartment();
    const vendorName = factory.name('Journey Vendor');

    await vendorFormPage.openNew();
    const vendorId = await vendorFormPage.create({
      name: vendorName,
      department: department.name,
      description: 'Created by the vendor-to-booking journey.',
      location: 'Bengaluru',
      cities: 'Bengaluru, Hyderabad',
      contactNumber: '+91 90000 12345',
      priceFrom: '25000',
      priceTo: '150000',
      verified: true,
      status: 'ACTIVE',
    });

    /**
     * Create redirects to the EDIT page, not back to the list. That is easy to get wrong and
     * is exactly why `PackagesManager` is usable immediately afterwards.
     */
    await vendorFormPage.expectLandedOnEditPage(vendorId);

    // --------------------------------------------- 2. admin adds a package
    const packageName = factory.name('Journey Package');
    await vendorFormPage.packages.add({
      name: packageName,
      price: '60000',
      features: ['Two photographers', 'Drone coverage', 'Printed album'],
      popular: true,
    });
    await vendorFormPage.packages.expectContains(packageName);

    /** Multi-line features must have been split on '\n' into separate list items. */
    await vendorFormPage.packages.expectFeatures(packageName, ['Two photographers', 'Drone coverage']);

    /** And the new vendor is listed in the admin table. */
    await adminVendorsPage.open();
    expect(await adminVendorsPage.findAcrossPages(vendorName), 'the vendor must appear in the admin list').toBe(
      true,
    );

    // ---------------------------------- 3. publicly reachable at its slug
    const created = await api.json<{ slug: string; packages: { id: string; name: string }[] }>(
      apiPaths.vendors.one(vendorId),
    );
    const packageId = created.packages.find((p) => p.name === packageName)?.id;
    expect(packageId, 'the package must be linked to the vendor').toBeTruthy();

    await vendorDetailPage.openSlug(created.slug);
    /** Bust the 300s data cache — the public read would otherwise miss a fresh record. */
    await vendorDetailPage.reloadFresh('all');

    await vendorDetailPage.expectLoaded(vendorName);
    await vendorDetailPage.expectVerified();
    await vendorDetailPage.expectPackagesVisible();
    await expect(vendorDetailPage.packageCard(packageId!)).toContainText(packageName);
    await expect(vendorDetailPage.popularBadge).toBeVisible();

    // ------------------------------------- 4. a visitor books that package
    await vendorDetailPage.bookPackage(packageId!);

    const customerEmail = factory.email('journey-customer');
    await bookPage.submitBooking({
      name: 'Journey Customer',
      email: customerEmail,
      phone: '+91 90000 54321',
      requirements: 'Booked via the E2E vendor-to-booking journey.',
    });
    await expect(bookPage.successCard).toContainText(messages.book.successTitle);

    // -------------------------------- 5. the booking reaches the admin queue
    const bookings = await api.json<
      { id: string; customerEmail: string; status: string; vendorId: string | null; packageId: string | null }[]
    >(apiPaths.bookings.list);
    const booking = bookings.find((b) => b.customerEmail === customerEmail);

    expect(booking, 'the booking must be recorded').toBeTruthy();
    expect(booking?.status, 'a new booking starts PENDING').toBe('PENDING');
    expect(booking?.vendorId, 'the vendor must be linked from the query string').toBe(vendorId);
    expect(booking?.packageId, 'the package must be linked from the query string').toBe(packageId);

    await bookingsPage.open();
    await bookingsPage.expectContains(customerEmail);
    await bookingsPage.expectStatus(booking!.id, 'PENDING');

    // ------------------------------------------ 6. the admin confirms it
    await bookingsPage.setStatus(booking!.id, 'CONFIRMED');
    await bookingsPage.expectStatus(booking!.id, 'CONFIRMED');

    /** And the change persisted server-side, not just in the re-rendered row. */
    const confirmed = await api.json<{ status: string }>(apiPaths.bookings.one(booking!.id));
    expect(confirmed.status).toBe('CONFIRMED');
  });

  test('JOURNEY-04 deleting the vendor keeps the booking but nulls its references', async ({
    api,
    factory,
    bookingsPage,
    adminVendorsPage,
  }) => {
    /**
     * A commercially important cascade decision: `Booking.vendorId` and `packageId` are
     * nullable and NOT cascading, so removing a vendor from the catalogue does not erase the
     * enquiries placed against it. Pinned here because a well-meaning `onDelete: Cascade`
     * would silently destroy financial records.
     */
    const vendor = await factory.createVendor();
    const pkg = await factory.createPackage(vendor.id);
    const email = factory.email('orphan-booking');
    const booking = await factory.createBooking({ vendorId: vendor.id, packageId: pkg.id, customerEmail: email });

    await adminVendorsPage.open();
    await adminVendorsPage.deleteVendor(vendor.id);

    const after = await api.json<{ status: string; vendorId: string | null; packageId: string | null }>(
      apiPaths.bookings.one(booking.id),
    );
    expect(after.vendorId, 'the reference is severed').toBeNull();
    expect(after.packageId).toBeNull();
    expect(after.status, 'but the booking itself survives').toBe('PENDING');

    /** And the admin list still shows it, with an em dash where the vendor used to be. */
    await bookingsPage.open();
    await bookingsPage.expectContains(email);
  });

  test('JOURNEY-05 featuring a vendor changes the home page Best Events slider', async ({
    api,
    factory,
    homePage,
    vendorFormPage,
  }) => {
    /**
     * `featured` is the only vendor flag with a visible consequence on the home page, and
     * setting it silently demotes a SIBLING in the same department. The test owns its
     * department so the demotion can only touch its own records.
     */
    const department = await factory.createDepartment();
    const vendor = await factory.createVendor({ departmentId: department.id, featured: false });

    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.saveEdit({ featured: true });

    const updated = await api.json<{ featured: boolean }>(apiPaths.vendors.one(vendor.id));
    expect(updated.featured).toBe(true);

    await homePage.open();
    await homePage.reloadFresh('all');

    /**
     * The slider shows one featured vendor per category, so the new one must be present
     * somewhere in that section. Asserted by name rather than by slide index, because the
     * ordering is not part of the contract.
     */
    await expect(homePage.bestEventsSection).toContainText(vendor.name);
  });
});

test.describe('Journey - CMS contact propagation', () => {
  test('JOURNEY-06 editing contact details updates the footer site-wide', async ({
    cmsPage,
    homePage,
    api,
    factory,
  }) => {
    /**
     * `site-contact` is a CMS SINGLETON — one row, last writer wins — feeding the footer, the
     * contact section and the WhatsApp FAB on every public page through `SiteContactProvider`.
     * So this journey both proves propagation and demonstrates why every spec touching this
     * block must be serial and must restore the original value.
     */
    await factory.snapshotAndRestore(
      'site-contact',
      async () => api.json<Record<string, string>>(apiPaths.cms.contact),
      async (original) => {
        await api.put(apiPaths.cms.contact, original);
      },
    );

    const newPhone = '9000011111';
    const newEmail = 'journey-contact@utsava.test';

    await cmsPage.open();
    await cmsPage.saveContact({ phone: newPhone, email: newEmail, phoneDisplay: '+91 90000 11111' });

    await homePage.open();
    await homePage.reloadFresh('cms');

    /** The footer's `tel:` and `mailto:` hrefs are built from these exact fields. */
    await homePage.footer.expectPhone(newPhone);
    await homePage.footer.expectEmail(newEmail);
  });

  test('JOURNEY-07 the seeded contact details are what the site shows by default', async ({ homePage }) => {
    /** A guard for JOURNEY-06: if the restore leaks, this fails and points at the culprit. */
    await homePage.open();
    await homePage.reloadFresh('cms');

    await homePage.footer.expectPhone(seededContact.phone);
    await homePage.footer.expectEmail(seededContact.email);
  });
});
