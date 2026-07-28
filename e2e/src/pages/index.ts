/** Barrel for every page object. Specs import from here, never from a deep path. */

export { BasePage } from './base.page';
export { SitePage } from './site.page';
export { AdminPage } from './admin.page';

export { HomePage } from './site/home.page';
export { VendorsListPage } from './site/vendors-list.page';
export { VendorDetailPage } from './site/vendor-detail.page';
export { PackagesPage } from './site/packages.page';
export { BookPage, type BookingFormValues } from './site/book.page';
export { TestimonialsPage } from './site/testimonials.page';
export { LegalPage } from './site/legal.page';

export { LoginPage } from './auth/login.page';

export { AdminDashboardPage } from './admin/dashboard.page';
export { AdminDepartmentsPage } from './admin/departments.page';
export { AdminVendorsListPage } from './admin/vendors-list.page';
export { AdminVendorFormPage, type VendorFormValues } from './admin/vendor-form.page';
export { AdminBookingsPage, type BookingStatus } from './admin/bookings.page';
export { AdminCmsPage, type CmsTab } from './admin/cms.page';
