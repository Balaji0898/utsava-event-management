/**
 * The `data-testid` catalogue — the contract between this suite and the app source.
 *
 * Naming convention: `<area>-<thing>[-<id>]`, kebab-case, area first.
 *   area   one of: login, book, review, vendors, vdetail, nav, footer,
 *          admin, dept, vend, pkg, booking, cms, upload
 *   thing  the element's role in the UI, not its markup ("submit", not "button")
 *   id     appended for elements rendered inside a `.map`, so a specific row can
 *          be addressed: `dept-row-<departmentId>`
 *
 * Rules:
 *  - A testid is added ONLY where a role/label/text locator cannot do the job:
 *    icon-only controls, ambiguous placeholders, per-row elements, and state
 *    containers with no ARIA equivalent. Text buttons keep `getByRole`.
 *  - Anything that is really an accessibility gap gets the ARIA fix as well as (or
 *    instead of) a testid — see `src/data/a11y-rules.ts`, most of whose register
 *    the Phase 3 pass retires.
 *  - Adding an entry here without adding it to the app is a broken locator; the
 *    reverse is dead weight. `tests/contract/testids.spec.ts` walks the key pages
 *    and asserts every id in this file resolves, so the two cannot drift.
 */

export const tid = {
  // ------------------------------------------------------------------- login
  login: {
    form: 'login-form',
    email: 'login-email',
    password: 'login-password',
    submit: 'login-submit',
    /** The single server-side error node. Also gets role="alert". */
    error: 'login-error',
  },

  // -------------------------------------------------------------------- book
  book: {
    form: 'book-form',
    name: 'book-name',
    email: 'book-email',
    phone: 'book-phone',
    date: 'book-date',
    location: 'book-location',
    guests: 'book-guests',
    budget: 'book-budget',
    requirements: 'book-requirements',
    consent: 'book-consent',
    privacyLink: 'book-privacy-link',
    submit: 'book-submit',
    error: 'book-error',
    success: 'book-success',
  },

  // --------------------------------------------- public testimonial form
  review: {
    form: 'review-form',
    name: 'review-name',
    role: 'review-role',
    message: 'review-message',
    /** `review-star-1` … `review-star-5`. Keep the existing aria-labels too. */
    star: (n: 1 | 2 | 3 | 4 | 5) => `review-star-${n}`,
    submit: 'review-submit',
    error: 'review-error',
    success: 'review-success',
  },

  // ---------------------------------------------------------- public site
  nav: {
    root: 'nav-root',
    logo: 'nav-logo',
    bookNow: 'nav-book-now',
    mobileToggle: 'nav-mobile-toggle',
    mobileMenu: 'nav-mobile-menu',
  },
  footer: { root: 'footer-root', phone: 'footer-phone', email: 'footer-email' },
  whatsappFab: 'whatsapp-fab',

  vendors: {
    list: 'vendors-list',
    /** `vendors-card-<slug>` — lets a spec address exactly its own record. */
    card: (slug: string) => `vendors-card-${slug}`,
    count: 'vendors-count',
    empty: 'vendors-empty',
    /** The "near your location" / "showing all events instead" pill. */
    proximityNotice: 'vendors-proximity-notice',
    pagination: 'vendors-pagination',
  },

  vdetail: {
    hero: 'vdetail-hero',
    name: 'vdetail-name',
    verifiedBadge: 'vdetail-verified',
    rating: 'vdetail-rating',
    gallery: 'vdetail-gallery',
    galleryItem: (n: number) => `vdetail-gallery-item-${n}`,
    lightbox: 'vdetail-lightbox',
    lightboxCounter: 'vdetail-lightbox-counter',
    packages: 'vdetail-packages',
    packageCard: (id: string) => `vdetail-package-${id}`,
    reviews: 'vdetail-reviews',
  },

  // ------------------------------------------------------------------ admin
  admin: {
    shell: 'admin-shell',
    sidebar: 'admin-sidebar',
    /** `admin-nav-dashboard` etc. Also carries aria-current on the active link. */
    navLink: (key: 'dashboard' | 'departments' | 'vendors' | 'bookings' | 'cms') => `admin-nav-${key}`,
    logout: 'admin-logout',
    loading: 'admin-loading',
  },

  dashboard: {
    /** `dashboard-stat-total-vendors` etc. */
    stat: (label: string) => `dashboard-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    error: 'dashboard-error',
    revenueCard: 'dashboard-revenue',
    statusCard: 'dashboard-booking-status',
  },

  dept: {
    createForm: 'dept-create-form',
    name: 'dept-name',
    icon: 'dept-icon',
    description: 'dept-description',
    submit: 'dept-submit',
    table: 'dept-table',
    row: (id: string) => `dept-row-${id}`,
    rowEdit: (id: string) => `dept-row-edit-${id}`,
    rowDelete: (id: string) => `dept-row-delete-${id}`,
    rowVendorCount: (id: string) => `dept-row-vendors-${id}`,
    rowNoImage: (id: string) => `dept-row-no-image-${id}`,
    empty: 'dept-empty',
    /**
     * The edit modal. Also gains role="dialog" + aria-modal, which it lacks today.
     * Its fields carry their OWN ids rather than reusing the create form's — the modal
     * renders alongside the create form, so shared ids would make every locator
     * strict-mode ambiguous while it is open.
     */
    modal: 'dept-modal',
    modalClose: 'dept-modal-close',
    modalName: 'dept-modal-name',
    modalIcon: 'dept-modal-icon',
    modalDescription: 'dept-modal-description',
    modalSave: 'dept-modal-save',
  },

  vend: {
    table: 'vend-table',
    row: (id: string) => `vend-row-${id}`,
    rowEdit: (id: string) => `vend-row-edit-${id}`,
    rowDelete: (id: string) => `vend-row-delete-${id}`,
    addButton: 'vend-add',
    empty: 'vend-empty',
    pagination: 'vend-pagination',

    /**
     * VendorForm. Applied via the shared `Field` component, so one edit there
     * covers all twelve labelled inputs — including the four that currently share
     * `placeholder="0"` and are otherwise indistinguishable.
     */
    form: 'vend-form',
    name: 'vend-name',
    department: 'vend-department',
    experience: 'vend-experience',
    location: 'vend-location',
    cities: 'vend-cities',
    description: 'vend-description',
    contactNumber: 'vend-contact-number',
    whatsapp: 'vend-whatsapp',
    email: 'vend-email',
    website: 'vend-website',
    instagram: 'vend-instagram',
    facebook: 'vend-facebook',
    priceFrom: 'vend-price-from',
    priceTo: 'vend-price-to',
    discount: 'vend-discount',
    available: 'vend-available',
    featured: 'vend-featured',
    trending: 'vend-trending',
    verified: 'vend-verified',
    status: 'vend-status',
    submit: 'vend-submit',
    error: 'vend-error',
  },

  pkg: {
    manager: 'pkg-manager',
    createForm: 'pkg-create-form',
    name: 'pkg-name',
    price: 'pkg-price',
    features: 'pkg-features',
    popular: 'pkg-popular',
    submit: 'pkg-submit',
    list: 'pkg-list',
    row: (id: string) => `pkg-row-${id}`,
    rowDelete: (id: string) => `pkg-row-delete-${id}`,
    rowPopularChip: (id: string) => `pkg-row-popular-${id}`,
  },

  booking: {
    table: 'booking-table',
    row: (id: string) => `booking-row-${id}`,
    /** The status <select>. Also gains an aria-label, which it lacks today. */
    rowStatus: (id: string) => `booking-row-status-${id}`,
    /** Carries data-status so the badge's meaning is readable without colour. */
    rowBadge: (id: string) => `booking-row-badge-${id}`,
    empty: 'booking-empty',
  },

  cms: {
    /** The tab bar gains role="tablist"; each button role="tab" + aria-selected. */
    tabs: 'cms-tabs',
    tab: (key: 'testimonials' | 'faqs' | 'stats' | 'contact' | 'legal') => `cms-tab-${key}`,
    panel: (key: 'testimonials' | 'faqs' | 'stats' | 'contact' | 'legal') => `cms-panel-${key}`,
    /** All three `Saved ✓` indicators. Also gain role="status". */
    saved: 'cms-saved',

    testimonial: {
      addForm: 'cms-testimonial-add-form',
      name: 'cms-testimonial-name',
      role: 'cms-testimonial-role',
      message: 'cms-testimonial-message',
      add: 'cms-testimonial-add',
      pendingGroup: 'cms-testimonial-pending',
      pendingCount: 'cms-testimonial-pending-count',
      publishedGroup: 'cms-testimonial-published',
      row: (id: string) => `cms-testimonial-row-${id}`,
      approve: (id: string) => `cms-testimonial-approve-${id}`,
      reject: (id: string) => `cms-testimonial-reject-${id}`,
      delete: (id: string) => `cms-testimonial-delete-${id}`,
      emptyPublished: 'cms-testimonial-empty',
    },

    faq: {
      addForm: 'cms-faq-add-form',
      question: 'cms-faq-question',
      answer: 'cms-faq-answer',
      add: 'cms-faq-add',
      list: 'cms-faq-list',
      row: (id: string) => `cms-faq-row-${id}`,
      delete: (id: string) => `cms-faq-delete-${id}`,
      empty: 'cms-faq-empty',
    },

    stats: {
      list: 'cms-stats-list',
      row: (i: number) => `cms-stats-row-${i}`,
      label: (i: number) => `cms-stats-label-${i}`,
      value: (i: number) => `cms-stats-value-${i}`,
      suffix: (i: number) => `cms-stats-suffix-${i}`,
      remove: (i: number) => `cms-stats-remove-${i}`,
      add: 'cms-stats-add',
      save: 'cms-stats-save',
    },

    contact: {
      form: 'cms-contact-form',
      manager: 'cms-contact-manager',
      role: 'cms-contact-role',
      phone: 'cms-contact-phone',
      phoneDisplay: 'cms-contact-phone-display',
      whatsapp: 'cms-contact-whatsapp',
      email: 'cms-contact-email',
      save: 'cms-contact-save',
    },

    legal: {
      /** The Terms/Privacy sub-toggle also gains role="tablist"/"tab". */
      toggle: 'cms-legal-toggle',
      toggleTerms: 'cms-legal-toggle-terms',
      togglePrivacy: 'cms-legal-toggle-privacy',
      editor: 'cms-legal-editor',
      editorBody: 'cms-legal-editor-body',
      save: 'cms-legal-save',
    },
  },

  upload: {
    /** Shared by ImageUploader; `folder` distinguishes concurrent instances. */
    dropZone: (folder: string) => `upload-drop-${folder}`,
    /** The real <input type="file">, which is `className="hidden"`. */
    input: (folder: string) => `upload-input-${folder}`,
    preview: (folder: string) => `upload-preview-${folder}`,
    remove: (folder: string) => `upload-remove-${folder}`,
    galleryAdd: 'upload-gallery-add',
    galleryInput: 'upload-gallery-input',
    galleryItem: (n: number) => `upload-gallery-item-${n}`,
    galleryRemove: (n: number) => `upload-gallery-remove-${n}`,
  },

  /** Shared UI primitives. */
  common: {
    /** Every Skeleton variant. Also gains aria-hidden. */
    skeleton: 'skeleton',
    backButton: 'back-button',
    themeToggle: 'theme-toggle',
    languageToggle: 'language-toggle',
  },
} as const;

/**
 * Flat list of the static (non-parameterised) testids, for the drift-detection
 * spec. Row-scoped ids are excluded — they only exist when data is present.
 */
export function staticTestIds(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (typeof node === 'function') return; // parameterised
    if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v);
  };
  walk(tid);
  return [...new Set(out)];
}
