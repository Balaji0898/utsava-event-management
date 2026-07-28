import { test, expect, serial } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { messages, strings } from '@data/test-data';
import { PNG_1X1, SVG_WITH_SCRIPT, oversizePng } from '@components/uploader.component';

/**
 * ADMIN CRUD — the dashboard's create/read/update/delete surfaces.
 *
 * Serial for the whole file. Every spec here mutates shared tables, and two of them touch
 * CMS singletons where the last writer wins; running them in parallel would have workers
 * overwriting each other's fixtures rather than testing the app.
 */
serial();

test.describe('Admin dashboard', () => {
  test('ADMDASH-P-01 renders the four stat cards with numeric values @smoke', async ({ dashboardPage }) => {
    await dashboardPage.open();
    await dashboardPage.expectLoaded();
    await dashboardPage.expectAllStatsNumeric();
    await dashboardPage.expectPanelsPresent();
  });

  test('ADMDASH-E-01 surfaces a stats failure as a readable message', async ({ dashboardPage, adminPage }) => {
    await adminPage.route('**/api/bookings/stats', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Injected failure"}' }),
    );

    await dashboardPage.openRaw('/admin');
    await dashboardPage.waitForGate();
    await dashboardPage.expectError();
  });

  test('ADMDASH-E-02 the revenue chart is hard-coded, so its values are not testable', async ({
    dashboardPage,
  }) => {
    /**
     * `[40, 65, 45, 80, 55, 90, 70]` for Mon–Sun, with no relationship to any data. There is
     * genuinely nothing to assert about the bars, so the case documents that and checks only
     * that the card renders — writing an assertion here would be theatre.
     */
    test.info().annotations.push({
      type: 'note',
      description:
        'The Revenue (confirmed) bar chart is a hard-coded array in app/admin/page.tsx. Chart-value ' +
        'correctness is untestable until it reads real data.',
    });

    await dashboardPage.open();
    await expect(dashboardPage.revenueCard).toBeVisible();
    await expect(dashboardPage.revenueCard).toContainText(messages.admin.dashboard.revenue);
  });

  test('ADMDASH-A-01 the sidebar marks the active route', async ({ dashboardPage }) => {
    await dashboardPage.open();
    await dashboardPage.sidebar.expectAllLinks();
    await dashboardPage.sidebar.expectActive('Dashboard');
  });
});

test.describe('Admin departments', () => {
  test('ADMDEPT-P-01 creates a department and lists it @smoke', async ({ departmentsPage, factory }) => {
    const name = factory.name('DeptCreate');

    await departmentsPage.open();
    await departmentsPage.expectLoaded();
    await departmentsPage.create({ name, icon: '🧪', description: 'Created by the E2E suite.' });

    await departmentsPage.expectContains(name);
  });

  test('ADMDEPT-N-01 an empty name is silently ignored', async ({ departmentsPage }) => {
    /**
     * The only client validation is `if (!draft.name) return` — no message, no field error,
     * nothing. Clicking "Add category" with an empty form does nothing at all, which is
     * indistinguishable from a broken button.
     */
    await departmentsPage.open();
    const rowsBefore = await departmentsPage.table.getByRole('row').count();

    await departmentsPage.submitEmpty();
    await departmentsPage.expectSilentCreateFailure(rowsBefore);
  });

  test('ADMDEPT-P-02 edits a department through the modal', async ({ departmentsPage, factory }) => {
    const department = await factory.createDepartment();
    const renamed = `${department.name}-renamed`;

    await departmentsPage.open();
    await departmentsPage.editName(department.id, renamed);
    await departmentsPage.expectContains(renamed);
  });

  test('ADMDEPT-A-02 the edit modal has real dialog semantics', async ({ departmentsPage, factory }) => {
    /**
     * Before Phase 3 this was a bare `fixed inset-0` div with no role at all, so assistive tech
     * announced nothing and `getByRole('dialog')` could not find it. This keeps the fix in place.
     */
    const department = await factory.createDepartment();

    await departmentsPage.open();
    await departmentsPage.openEditModal(department.id);

    await expect(departmentsPage.modal).toHaveAttribute('role', 'dialog');
    await expect(departmentsPage.modal).toHaveAttribute('aria-modal', 'true');
    await expect(departmentsPage.modal).toHaveAttribute('aria-labelledby', /.+/);
  });

  test('ADMDEPT-P-03 the modal closes via the button and via the backdrop', async ({
    departmentsPage,
    factory,
  }) => {
    const department = await factory.createDepartment();
    await departmentsPage.open();

    await departmentsPage.openEditModal(department.id);
    await departmentsPage.closeModalWithButton();

    await departmentsPage.openEditModal(department.id);
    await departmentsPage.closeModalWithBackdrop();
  });

  test('ADMDEPT-P-04 deletes a department after confirming @smoke', async ({
    departmentsPage,
    factory,
    dialogs,
  }) => {
    const department = await factory.createDepartment();

    await departmentsPage.open();
    await departmentsPage.deleteDepartment(department.id, dialogs);

    expect(dialogs.lastMessage, 'the native confirm text').toBe(messages.admin.departments.confirmDelete);
    await departmentsPage.expectDoesNotContain(department.name);
  });

  test('ADMDEPT-N-02 cancelling the confirm leaves the row intact', async ({
    departmentsPage,
    factory,
    dialogs,
  }) => {
    const department = await factory.createDepartment();

    await departmentsPage.open();
    await departmentsPage.cancelDelete(department.id, dialogs);
    await departmentsPage.expectContains(department.name);
  });

  test('ADMDEPT-E-01 deleting a department silently removes its vendors too', async ({
    departmentsPage,
    factory,
    api,
    dialogs,
  }) => {
    /**
     * The cascade the confirm dialog does NOT mention. "Delete this department?" removes every
     * vendor inside it and every package under those vendors — compare the vendors table, whose
     * confirm at least says "and all its packages".
     */
    const department = await factory.createDepartment();
    const vendor = await factory.createVendor({ departmentId: department.id });
    const pkg = await factory.createPackage(vendor.id);

    await departmentsPage.open();
    await departmentsPage.expectVendorCount(department.id, 1);

    await departmentsPage.deleteDepartment(department.id, dialogs);

    expect((await api.get(apiPaths.vendors.one(vendor.id))).status(), 'the vendor is gone').toBe(404);
    expect((await api.get(apiPaths.packages.one(pkg.id))).status(), 'the package is gone').toBe(404);
  });

  test('ADMDEPT-E-02 a department with no banner shows the "No image" chip', async ({
    departmentsPage,
    factory,
  }) => {
    const department = await factory.createDepartment();
    await departmentsPage.open();
    await expect(departmentsPage.noImageChip(department.id)).toHaveText(messages.admin.departments.noImage);
  });

  test('ADMDEPT-A-03 every create-form field is label-associated', async ({ departmentsPage }) => {
    await departmentsPage.open();
    for (const label of [
      messages.admin.departments.fields.name,
      messages.admin.departments.fields.icon,
      messages.admin.departments.fields.description,
    ]) {
      await expect(departmentsPage.createForm.getByLabel(label, { exact: true })).toBeVisible();
    }
  });
});

test.describe('Admin vendors', () => {
  test('ADMVEND-P-01 lists vendors with all seven columns @smoke', async ({ adminVendorsPage }) => {
    await adminVendorsPage.open();
    await adminVendorsPage.expectLoaded();
    await adminVendorsPage.expectColumns();
  });

  test('ADMVEND-P-02 the create form requires only a name and a department', async ({ vendorFormPage }) => {
    /**
     * There is no zod on this form — validation is entirely the two native `required`
     * attributes. Everything else, including all six contact fields, accepts anything.
     */
    await vendorFormPage.openNew();
    await vendorFormPage.expectRequiredFields();
  });

  test('ADMVEND-N-01 the six contact fields have no validation at all', async ({ vendorFormPage }) => {
    /**
     * Documented rather than reported as a bug: an operator can save `not an email` as a
     * vendor's contact address and the public detail page will render it as-is. If validation is
     * ever added, this test fails and the change becomes deliberate.
     */
    await vendorFormPage.openNew();
    await vendorFormPage.expectContactFieldsUnvalidated();
  });

  test('ADMVEND-P-03 creating a vendor lands on its edit page, not the list @smoke', async ({
    vendorFormPage,
    factory,
  }) => {
    const department = await factory.createDepartment();
    const name = factory.name('VendCreate');

    await vendorFormPage.openNew();
    const id = await vendorFormPage.create({ name, department: department.name });

    /** POST then `router.push('/admin/vendors/{id}')` — so PackagesManager is right there. */
    await vendorFormPage.expectLandedOnEditPage(id);
  });

  test('ADMVEND-P-04 editing a vendor returns to the list', async ({ vendorFormPage, factory }) => {
    const vendor = await factory.createVendor();

    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.saveEdit({ description: 'Edited by the E2E suite.' });
  });

  test('ADMVEND-E-01 a stored zero price renders as an empty input (bug B10)', async ({
    vendorFormPage,
    factory,
  }) => {
    /**
     * Bug B10. `value={form.priceFrom || ''}` means a real stored `0` displays as blank, so the
     * operator cannot tell "free" from "not set" — and saving re-sends `0` either way.
     * Asserted as current behaviour so a fix is a deliberate change.
     */
    const vendor = await factory.createVendor({ priceFrom: 0 });
    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.expectZeroRendersEmpty();
  });

  test('ADMVEND-E-02 a hostile vendor name still produces a usable slug', async ({
    vendorFormPage,
    factory,
    api,
  }) => {
    const department = await factory.createDepartment();
    const name = `${factory.name('hostile')} ${strings.slugHostile}`;

    await vendorFormPage.openNew();
    const id = await vendorFormPage.create({ name, department: department.name });

    const created = await api.json<{ slug: string }>(apiPaths.vendors.one(id));
    expect(created.slug, 'the slug must be URL-safe').toMatch(/^[a-z0-9-]+$/);
  });

  test('ADMVEND-P-05 deletes a vendor after confirming its cascade @smoke', async ({
    adminVendorsPage,
    factory,
    dialogs,
  }) => {
    const vendor = await factory.createVendor();

    await adminVendorsPage.open();
    await adminVendorsPage.deleteVendor(vendor.id, dialogs);

    expect(dialogs.lastMessage).toBe(messages.admin.vendors.confirmDelete);
  });

  test('ADMVEND-A-01 the vendor form is fully label-associated after Phase 3', async ({ vendorFormPage }) => {
    /**
     * The highest-leverage part of the Phase 3 pass: one edit to the shared `Field` component
     * associated twelve labels at once, and disambiguated the four inputs that all shared
     * `placeholder="0"` (experience, priceFrom, priceTo, discount).
     */
    await vendorFormPage.openNew();

    for (const label of [
      messages.admin.vendors.fields.experience,
      messages.admin.vendors.fields.priceFrom,
      messages.admin.vendors.fields.priceTo,
      messages.admin.vendors.fields.discount,
    ]) {
      await expect(
        vendorFormPage.form.getByLabel(label, { exact: true }),
        `"${label}" must resolve to exactly one input`,
      ).toHaveCount(1);
    }
  });
});

test.describe('Admin packages', () => {
  test('ADMPKG-P-01 adds a package with newline-separated features @smoke', async ({
    vendorFormPage,
    factory,
  }) => {
    const vendor = await factory.createVendor();
    const name = factory.name('PkgCreate');

    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.packages.add({
      name,
      price: '45000',
      features: ['First inclusion', 'Second inclusion', 'Third inclusion'],
    });

    /** The textarea is split on '\n', so each line must become its own list item. */
    await vendorFormPage.packages.expectFeatures(name, ['First inclusion', 'Second inclusion', 'Third inclusion']);
  });

  test('ADMPKG-N-01 a missing price silently blocks the add', async ({ vendorFormPage, factory }) => {
    /** `if (!name || !price) return` — no message, same silent-no-op pattern as departments. */
    const vendor = await factory.createVendor();
    await vendorFormPage.openEdit(vendor.id);

    const before = await vendorFormPage.packages.list.locator('[data-testid^="pkg-row-"]').count();
    await vendorFormPage.packages.submitIncomplete({ name: 'No price given' });
    await vendorFormPage.packages.expectSilentAddFailure(before);
  });

  test('ADMPKG-P-02 marks a package as popular', async ({ vendorFormPage, factory, api }) => {
    const vendor = await factory.createVendor();
    const name = factory.name('PopularPkg');

    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.packages.add({ name, price: '99000', popular: true });

    const packages = await api.json<{ id: string; name: string; popular: boolean }[]>(
      apiPaths.packages.forVendor(vendor.id),
    );
    const created = packages.find((p) => p.name === name);
    expect(created?.popular).toBe(true);
    await vendorFormPage.packages.expectPopular(created!.id);
  });

  test('ADMPKG-P-03 deletes a package after confirming', async ({ vendorFormPage, factory, dialogs, api }) => {
    const vendor = await factory.createVendor();
    const pkg = await factory.createPackage(vendor.id);

    await vendorFormPage.openEdit(vendor.id);
    await vendorFormPage.packages.deletePackage(pkg.id, dialogs);

    expect(dialogs.lastMessage).toBe(messages.admin.packages.confirmDelete);
    expect((await api.get(apiPaths.packages.one(pkg.id))).status()).toBe(404);
  });
});

test.describe('Admin bookings', () => {
  test('ADMBOOK-P-01 lists bookings with all six columns @smoke', async ({ bookingsPage, factory }) => {
    await factory.createBooking();

    await bookingsPage.open();
    await bookingsPage.expectLoaded();
    await bookingsPage.expectColumns();
  });

  test('ADMBOOK-P-02 offers every BookingStatus and persists a change @smoke', async ({
    bookingsPage,
    factory,
    api,
  }) => {
    const booking = await factory.createBooking();

    await bookingsPage.open();
    await bookingsPage.expectAllStatusOptions(booking.id);

    /** There is no confirmation dialog here — the change is immediate and irreversible. */
    await bookingsPage.setStatus(booking.id, 'CONFIRMED');

    const persisted = await api.json<{ status: string }>(apiPaths.bookings.one(booking.id));
    expect(persisted.status).toBe('CONFIRMED');
  });

  test('ADMBOOK-E-01 pagination, filters and search do not exist', async ({ bookingsPage }) => {
    /**
     * `GET /bookings` returns a flat array with no query parameters, so this page renders every
     * booking in the database at once. Recorded as a known limitation rather than tested as if
     * controls were present.
     */
    test.info().annotations.push({
      type: 'note',
      description:
        '/admin/bookings has no pagination, filtering, sorting or search — GET /bookings returns a ' +
        'flat array. This does not scale past a few hundred bookings.',
    });

    await bookingsPage.open();
    await expect(bookingsPage.paginationControls).toHaveCount(0);
  });

  test('ADMBOOK-A-01 the status select has an accessible name and a focus style', async ({
    bookingsPage,
    factory,
  }) => {
    /**
     * Bug B3. The select had `outline-none` with no replacement and no label, breaking WCAG
     * 2.4.7 (visible focus) and 4.1.2 (name, role, value). Phase 3 added both; this keeps them.
     */
    const booking = await factory.createBooking();
    await bookingsPage.open();

    await bookingsPage.expectStatusSelectHasAccessibleName(booking.id);
    await bookingsPage.statusSelect(booking.id).focus();
    await expect(bookingsPage.statusSelect(booking.id)).toBeFocused();
  });

  test('ADMBOOK-A-02 the table scroll container is keyboard reachable', async ({ bookingsPage, factory }) => {
    /** Bug B5 — `overflow-x-auto` with no `tabIndex` is axe `scrollable-region-focusable`. */
    await factory.createBooking();
    await bookingsPage.open();
    await bookingsPage.expectScrollContainerFocusable();
  });
});

test.describe('Admin CMS', () => {
  test('ADMCMS-P-01 renders all five tabs with real tab semantics @smoke', async ({ cmsPage }) => {
    await cmsPage.open();
    await cmsPage.expectLoaded();

    /** Phase 3 added role="tablist"/"tab" and aria-selected, none of which existed before. */
    await expect(cmsPage.tabBar).toHaveAttribute('role', 'tablist');
    for (const tab of messages.admin.cms.tabs) {
      await cmsPage.openTab(tab);
      await cmsPage.expectTabSelected(tab);
    }
  });

  test('ADMCMS-E-01 tabs are not deep-linkable', async ({ cmsPage }) => {
    /**
     * Tab state is component-local `useState`, so `?tab=faqs` does nothing and an admin cannot
     * bookmark or share a panel. Recorded as a limitation.
     */
    test.info().annotations.push({
      type: 'note',
      description: '/admin/cms tab state is component-local, so panels cannot be deep-linked or bookmarked.',
    });
    await cmsPage.expectTabsNotDeepLinkable();
  });

  test('ADMCMS-P-02 adds and deletes an FAQ', async ({ cmsPage, factory, api, dialogs }) => {
    const question = `${factory.name('FaqCreate')}?`;

    await cmsPage.open();
    await cmsPage.addFaq({ question, answer: 'Created by the E2E suite.' });

    const faqs = await api.json<{ id: string; question: string }[]>(apiPaths.cms.faqsAll);
    const created = faqs.find((f) => f.question === question);
    expect(created).toBeTruthy();

    await cmsPage.deleteFaq(created!.id, dialogs);
    expect(dialogs.lastMessage).toBe(messages.admin.cms.faqs.confirmDelete);
  });

  test('ADMCMS-P-03 the Saved indicator appears then expires after two seconds', async ({
    cmsPage,
    api,
    factory,
  }) => {
    /**
     * `setTimeout(() => setSaved(false), 2000)` — so the confirmation is transient and a slow
     * assertion chain would miss it entirely. Asserted in both directions, because "it appeared"
     * and "it went away" are separately breakable.
     */
    await factory.snapshotAndRestore(
      'site-contact',
      async () => api.json<Record<string, string>>(apiPaths.cms.contact),
      async (original) => {
        await api.put(apiPaths.cms.contact, original);
      },
    );

    await cmsPage.open();
    await cmsPage.saveContact({ role: 'Event Manager & Owner' });

    await cmsPage.expectSavedIndicator();
    await cmsPage.expectSavedIndicatorGone();
  });

  test('ADMCMS-E-02 the tiptap legal editor loads behind its skeleton', async ({ cmsPage }) => {
    /** Dynamically imported with `ssr: false`, so it genuinely does not exist on first paint. */
    await cmsPage.open();
    await cmsPage.openLegal('terms');
    await cmsPage.editor.waitForReady();

    for (const label of messages.admin.cms.legal.toolbar) {
      await expect(cmsPage.editor.toolbarButton(label)).toBeVisible();
    }
  });
});

test.describe('Admin uploads', () => {
  test('UPLOAD-P-01 uploads a PNG through the department banner uploader', async ({ departmentsPage }) => {
    await departmentsPage.open();
    await departmentsPage.bannerUploader.upload({ name: 'banner.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await departmentsPage.bannerUploader.expectUploadSucceeded();
  });

  test('UPLOAD-S-01 an SVG is rejected with no preview @smoke', async ({ departmentsPage }) => {
    /**
     * The UI half of API-UPL-S-01. Note the component has NO error UI — a rejection simply
     * produces no preview, so an operator gets no explanation. Worth improving, and worth
     * recording that the security control itself works.
     */
    await departmentsPage.open();
    await departmentsPage.bannerUploader.upload({
      name: 'payload.svg',
      mimeType: 'image/svg+xml',
      buffer: SVG_WITH_SCRIPT,
    });
    await departmentsPage.bannerUploader.expectUploadRejected();
  });

  test('UPLOAD-S-02 an oversized file is rejected with no preview @smoke', async ({ departmentsPage }) => {
    await departmentsPage.open();
    await departmentsPage.bannerUploader.upload({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: oversizePng(),
    });
    await departmentsPage.bannerUploader.expectUploadRejected();
  });
});
