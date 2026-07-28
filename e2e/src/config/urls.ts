/**
 * The route table. Every path the suite navigates to or calls lives here, so a
 * route rename is a one-line change rather than a grep across 400 specs.
 *
 * Verified against `frontend/src/app/**` and the nine Nest controllers.
 */

/** Public site — route group `(site)`: Navbar + Footer + WhatsApp FAB + Lenis. */
export const paths = {
  home: '/',
  vendors: '/vendors',
  vendorDetail: (slug: string) => `/vendors/${slug}`,
  packages: '/packages',
  book: '/book',
  bookFor: (vendorId: string, packageId?: string) =>
    `/book?vendorId=${encodeURIComponent(vendorId)}${packageId ? `&packageId=${encodeURIComponent(packageId)}` : ''}`,
  testimonials: '/testimonials',
  privacy: '/privacy',
  terms: '/terms',

  /** Route group `(auth)` — no layout, so no navbar, no footer, no Lenis. */
  login: '/login',

  /** Admin — guarded client-side only by `app/admin/layout.tsx`. */
  admin: '/admin',
  adminDepartments: '/admin/departments',
  adminVendors: '/admin/vendors',
  adminVendorNew: '/admin/vendors/new',
  adminVendorEdit: (id: string) => `/admin/vendors/${id}`,
  adminBookings: '/admin/bookings',
  adminCms: '/admin/cms',

  /**
   * Next route handler (not the Nest API). Open when REVALIDATE_SECRET is unset,
   * which `scripts/stack.mjs` deliberately leaves that way so the suite can bust
   * `serverApi`'s 300s `unstable_cache`.
   */
  revalidate: (tag: 'departments' | 'vendors' | 'packages' | 'cms' | 'all') => `/api/revalidate?tag=${tag}`,

  /** In-page anchors, all intercepted by Lenis's document-level click handler. */
  anchors: {
    services: '/#services',
    contact: '/#contact',
    faq: '/#faq',
    functionHalls: '/#function-halls',
  },
} as const;

/** Nest API paths, relative to the `/api` global prefix. */
export const apiPaths = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },
  departments: {
    list: '/departments',
    all: '/departments?all=true',
    one: (idOrSlug: string) => `/departments/${idOrSlug}`,
  },
  categories: {
    list: '/categories',
    one: (id: string) => `/categories/${id}`,
  },
  items: {
    list: '/items',
    one: (id: string) => `/items/${id}`,
  },
  vendors: {
    list: '/vendors',
    one: (idOrSlug: string) => `/vendors/${idOrSlug}`,
  },
  packages: {
    list: '/packages',
    forVendor: (vendorId: string) => `/packages?vendorId=${encodeURIComponent(vendorId)}`,
    one: (id: string) => `/packages/${id}`,
  },
  bookings: {
    create: '/bookings',
    list: '/bookings',
    stats: '/bookings/stats',
    one: (id: string) => `/bookings/${id}`,
    status: (id: string) => `/bookings/${id}/status`,
  },
  cms: {
    blocks: '/cms/blocks',
    block: (key: string) => `/cms/blocks/${key}`,
    blockById: (id: string) => `/cms/blocks/${id}`,
    testimonials: '/cms/testimonials',
    testimonialsAll: '/cms/testimonials?all=true',
    testimonialSubmit: '/cms/testimonials/submit',
    testimonial: (id: string) => `/cms/testimonials/${id}`,
    faqs: '/cms/faqs',
    faqsAll: '/cms/faqs?all=true',
    faq: (id: string) => `/cms/faqs/${id}`,
    contact: '/cms/contact',
    stats: '/cms/stats',
    legal: (slug: 'terms' | 'privacy') => `/cms/legal/${slug}`,
  },
  uploads: {
    create: (folder: string) => `/uploads?folder=${encodeURIComponent(folder)}`,
    list: '/uploads',
    one: (id: string) => `/uploads/${id}`,
  },
  /** Swagger, mounted only when NODE_ENV !== 'production'. Not under /api. */
  docs: '/docs',
  docsJson: '/docs-json',
} as const;

/**
 * Every `@Roles(ADMIN, SUPER_ADMIN)` route, as `[method, path]`.
 *
 * This drives the data-driven RBAC sweep — one spec asserting 401 anonymous,
 * 401 malformed token, 403 CUSTOMER and 2xx ADMIN across the whole admin surface,
 * instead of ~130 hand-written cases. Adding a protected route without adding it
 * here is the failure mode; the contract spec cross-checks this list against
 * `/docs-json` so an omission is caught.
 */
export const protectedRoutes: ReadonlyArray<readonly [method: string, path: string]> = [
  // bookings
  ['GET', '/bookings'],
  ['GET', '/bookings/stats'],
  ['GET', '/bookings/does-not-exist'],
  ['PATCH', '/bookings/does-not-exist/status'],
  // departments
  ['POST', '/departments'],
  ['PATCH', '/departments/does-not-exist'],
  ['DELETE', '/departments/does-not-exist'],
  // categories
  ['POST', '/categories'],
  ['PATCH', '/categories/does-not-exist'],
  ['DELETE', '/categories/does-not-exist'],
  // items
  ['POST', '/items'],
  ['PATCH', '/items/does-not-exist'],
  ['DELETE', '/items/does-not-exist'],
  // vendors
  ['POST', '/vendors'],
  ['PATCH', '/vendors/does-not-exist'],
  ['DELETE', '/vendors/does-not-exist'],
  // packages
  ['POST', '/packages'],
  ['PATCH', '/packages/does-not-exist'],
  ['DELETE', '/packages/does-not-exist'],
  // cms
  ['POST', '/cms/blocks'],
  ['PATCH', '/cms/blocks/does-not-exist'],
  ['DELETE', '/cms/blocks/does-not-exist'],
  ['POST', '/cms/testimonials'],
  ['PATCH', '/cms/testimonials/does-not-exist'],
  ['DELETE', '/cms/testimonials/does-not-exist'],
  ['POST', '/cms/faqs'],
  ['PATCH', '/cms/faqs/does-not-exist'],
  ['DELETE', '/cms/faqs/does-not-exist'],
  ['PUT', '/cms/contact'],
  ['PUT', '/cms/stats'],
  ['PUT', '/cms/legal/terms'],
  // uploads
  ['POST', '/uploads'],
  ['GET', '/uploads'],
  ['DELETE', '/uploads/does-not-exist'],
] as const;

/**
 * Routes that require *any* authenticated user but carry no `@Roles` decorator.
 * `RolesGuard` returns true when no roles are required, so a CUSTOMER token is
 * sufficient here — that asymmetry is worth an explicit assertion.
 */
export const authenticatedRoutes: ReadonlyArray<readonly [method: string, path: string]> = [
  ['GET', '/auth/me'],
  ['PATCH', '/auth/me'],
  ['POST', '/auth/logout'],
] as const;

/** `@Public()` routes. Must answer without any Authorization header. */
export const publicRoutes: ReadonlyArray<readonly [method: string, path: string]> = [
  ['GET', '/departments'],
  ['GET', '/categories'],
  ['GET', '/items'],
  ['GET', '/vendors'],
  ['GET', '/packages'],
  ['GET', '/cms/blocks'],
  ['GET', '/cms/testimonials'],
  ['GET', '/cms/faqs'],
  ['GET', '/cms/contact'],
  ['GET', '/cms/stats'],
  ['GET', '/cms/legal/terms'],
  ['GET', '/cms/legal/privacy'],
] as const;
