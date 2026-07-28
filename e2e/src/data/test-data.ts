/**
 * Inputs, attack payloads, and the app's exact user-facing copy.
 *
 * Every literal a spec asserts on lives here. A wording change in the app is then
 * a one-line update in this file rather than a grep across 400 specs — the same
 * discipline as the sibling Playright suite's `src/data/test-data.ts`.
 *
 * All copy below was read out of the source, not guessed. Where the string comes
 * from the i18n dictionary the key is noted, because those strings change per
 * locale and are therefore only safe to assert with `locale === 'en'`.
 */

// ---------------------------------------------------------------- inputs

export const emails = {
  valid: 'valid.person@utsava.test',
  /** Rejected by both zod (`.email()`) and class-validator (`@IsEmail`). */
  malformed: ['plainstring', 'no-at-sign.com', '@nodomain.com', 'spaces in@email.com', 'trailing@dot.', 'a@b'],
  /** RFC-legal shapes that must be ACCEPTED — guards over-eager validation. */
  unusualButValid: ['first+tag@utsava.test', 'x@utsava.test', "o'brien@utsava.test"],
  unregistered: 'definitely-not-registered-8f3a@utsava.test',
} as const;

export const passwords = {
  /** `RegisterDto` enforces `@MinLength(8)` — these two straddle the boundary. */
  tooShort: 'Abc123!',
  minimumLength: 'Abc123!x',
  strong: 'Str0ng!Passw0rd#2026',
  wrong: 'ThisIsNotThePassword1!',
  /**
   * The credential SECURITY_AUDIT.md C-2 flags as shipped-by-default and still
   * printed on the login page. A security spec asserts it does NOT authenticate.
   */
  documentedDefault: 'Admin@123',
} as const;

export const documentedDefaultAdminEmail = 'admin@elite.events';

/** Boundary values for the numeric fields across booking, vendor and package forms. */
export const numbers = {
  zero: '0',
  negative: '-5',
  fractional: '2.5',
  one: '1',
  /** `guestCount` is `@IsInt`; `budget` is `@IsNumber` with `Decimal(12,2)` storage. */
  aboveDecimalPrecision: '99999999999999',
  hugeButValid: '1000000',
  /** `discountPercent` is `Decimal(5,2)` and the form caps it at max=100. */
  percentAboveMax: '101',
  ratingBelowMin: 0,
  ratingAboveMax: 6,
} as const;

export const strings = {
  /** `customerName` is `min(2, 'Name is required')` in the booking zod schema. */
  oneChar: 'x',
  twoChars: 'Jo',
  /** No max length anywhere in the DTOs — asserts the app degrades gracefully. */
  veryLong: 'A'.repeat(5_000),
  /** Telugu — the app's second locale. Must survive round-tripping unmangled. */
  telugu: 'ఉత్సవ వేడుక — పెళ్లి ఫోటోగ్రఫీ',
  emoji: '🎉 Wedding 💍 Reception 🎊',
  /** Slugify must collapse these to something URL-safe and still unique. */
  slugHostile: 'Ünïcödé  &&  Slashes / Plus + Dots... Test',
  whitespaceOnly: '   ',
  /** Newlines matter: PackagesManager splits the features textarea on '\n'. */
  multiline: 'Line one\nLine two\nLine three',
} as const;

// ---------------------------------------------------------------- payloads

/**
 * Attack payloads.
 *
 * Prisma parameterises every query, so the SQL strings are asserted to produce a
 * normal empty result — never a 500 and never a leaked error — rather than to
 * "work". The XSS strings target `frontend/src/shared/lib/sanitize.ts`, a custom
 * regex allowlist that SECURITY_AUDIT.md H-1 identifies as bypassable; the legal
 * pages render its output through `dangerouslySetInnerHTML`.
 */
export const payloads = {
  sqlInjection: [
    "' OR '1'='1",
    "'; DROP TABLE \"Vendor\"; --",
    "1' UNION SELECT NULL, passwordHash FROM \"User\" --",
    '%27%20OR%201=1--',
  ],

  /**
   * Deliberately diverse: a regex allowlist typically catches bare `<script>` and
   * misses event handlers, SVG, split attributes, entities and `javascript:` URLs.
   * Each of these is a distinct bypass class.
   */
  xss: {
    bareScript: '<script>window.__xssProbe="pwned"</script>',
    imgOnError: '<img src=x onerror="window.__xssProbe=\'pwned\'">',
    svgOnLoad: '<svg/onload="window.__xssProbe=\'pwned\'">',
    mixedCase: '<ScRiPt>window.__xssProbe="pwned"</ScRiPt>',
    nested: '<scr<script>ipt>window.__xssProbe="pwned"</script>',
    entityEncoded: '&lt;img src=x onerror=window.__xssProbe=&#39;pwned&#39;&gt;',
    javascriptHref: '<a href="javascript:window.__xssProbe=\'pwned\'">click</a>',
    dataUri: '<iframe src="data:text/html,<script>parent.__xssProbe=\'pwned\'</script>"></iframe>',
    styleExpression: '<div style="background:url(javascript:window.__xssProbe=\'pwned\')">x</div>',
    bodyOnload: '<body onload="window.__xssProbe=\'pwned\'">',
    detailsOnToggle: '<details open ontoggle="window.__xssProbe=\'pwned\'">x</details>',
    /** Split across an attribute boundary — defeats naive tag-name matching. */
    splitAttribute: '<img src="x" o' + 'nerror="window.__xssProbe=\'pwned\'">',
  },

  /** Path traversal against `safeFolder()` in `backend/src/uploads/uploads.controller.ts`. */
  pathTraversal: ['../../etc', '..%2f..%2fetc', '/absolute/path', 'a/../../b', '....//....//etc'],

  /** Mass-assignment attempts. `ValidationPipe({ whitelist: true })` must strip these. */
  massAssignment: {
    register: { role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: 'injected', id: 'injected-id' },
    profile: { role: 'SUPER_ADMIN', email: 'attacker@utsava.test', passwordHash: 'injected', refreshToken: 'injected' },
    testimonialSubmit: { approved: true, status: 'ACTIVE', sortOrder: -1 },
  },

  /** Forged JWTs for the token-security specs. */
  tokens: {
    /** Not a JWT at all. */
    garbage: 'not-a-token',
    /** Structurally valid, signature nonsense. */
    badSignature:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdHRhY2tlciIsImVtYWlsIjoiYUBiLmMiLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.thisIsNotAValidSignatureAtAll',
    /** `alg: none` — must be rejected outright, not treated as unsigned-but-valid. */
    algNone:
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhdHRhY2tlciIsImVtYWlsIjoiYUBiLmMiLCJyb2xlIjoiU1VQRVJfQURNSU4iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6OTk5OTk5OTk5OX0.',
    /** Signed with a placeholder secret — `requireSecret()` blocklists these. */
    placeholderSecret: 'change_me_access_secret',
    empty: '',
  },
} as const;

/** Keys the XSS specs probe on `window`. One per spec file so runs can't collide. */
export const xssProbes = {
  booking: '__bookXssProbe',
  testimonial: '__testimonialXssProbe',
  vendor: '__vendorXssProbe',
  legal: '__legalXssProbe',
  search: '__searchXssProbe',
} as const;

// ------------------------------------------------------------------- copy

/**
 * The app's exact user-facing strings, namespaced per feature.
 *
 * ⚠️ Strings marked `[i18n]` come from `frontend/src/shared/i18n/locales/en.json`
 * and are locale-dependent. Every spec asserting one must run with locale 'en',
 * which `src/fixtures/init-scripts.ts` pins by default.
 */
export const messages = {
  nav: {
    /** [i18n] nav.* — note "Our Work", not "Vendors". */
    home: 'Home',
    vendors: 'Our Work',
    packages: 'Packages',
    services: 'Services',
    contact: 'Contact Us',
    bookNow: 'Book Now',
  },

  home: {
    /** [i18n] hero.* */
    heroBadge: 'Trusted by 5,000+ celebrations',
    heroSubtitle:
      'From intimate gatherings to grand weddings, we blend creativity, elegance and precision to make your dream event come to life.',
    ctaPrimary: 'Book Now',
    ctaSecondary: 'Explore our work',
    datePlaceholder: 'Select date',
    searchPlaceholderEvent: 'Wedding, Birthday…',
    /** [i18n] bestEvents.*, services.*, testimonials.*, faq.*, contact.*, cta.* */
    bestEventsTitle: 'Best Events',
    bestEventsSubtitle: 'Our standout work — the best from each category.',
    servicesTitle: 'What We Create',
    servicesSubtitle: 'Every service is crafted and curated by our team — explore our work.',
    servicesVendorsSuffix: 'listings',
    testimonialsTitle: 'Loved by our clients',
    testimonialsSeeAll: 'See all',
    faqTitle: 'Frequently asked questions',
    contactTitle: "Let's plan your celebration",
    contactCall: 'Call now',
    contactWhatsapp: 'WhatsApp',
    contactEmail: 'Email us',
    ctaTitle: 'Ready to plan your event?',
    ctaButton: 'Book your event',
    viewAll: 'View all',
    /** BestEventsSlider's per-slide CTA — "Explore", not "View all". */
    slideCta: 'Explore',
    functionHallsViewAll: 'View all venues',
  },

  vendors: {
    /**
     * ⚠️ `/vendors` does NOT use the `vendorsPage.*` dictionary keys, despite them
     * existing in en.json ("Our Work", "listings available.", "Nothing to show
     * yet."). The page hardcodes English inside `<Tr>` wrappers instead
     * (`app/(site)/vendors/page.tsx:102-118`). In the `en` locale `<Tr>` is a
     * passthrough, so these are the strings that actually render.
     *
     * The navbar link to this page still reads "Our Work" (nav.vendors), so the
     * link text and the page heading legitimately disagree.
     */
    title: 'Vendors',
    countCopy: (total: number) => `${total} vendors available. Filter by department from the home page.`,
    countSuffix: 'vendors available. Filter by department from the home page.',
    empty: 'No vendors found.',
    from: 'From',
    backToHome: 'Back to home',
    /** Proximity fallback copy, `app/(site)/vendors/page.tsx:76`. */
    nearNoResults: 'No events found near your location — showing all events instead.',
    nearWithResults: 'Showing events near your current location.',
    prev: 'Prev',
    next: 'Next',
  },

  vendorDetail: {
    gallery: 'Gallery',
    packages: 'Packages',
    reviews: 'Reviews',
    bookThisPackage: 'Book this package',
    mostPopular: 'Most popular',
    anonymousReviewer: 'Customer',
    backToWork: 'Back to work',
  },

  packages: {
    /** [i18n] packagesPage.* */
    title: 'Packages',
    subtitle: 'Transparent, multi-tier pricing for every celebration.',
    bookNow: 'Book now',
    empty: 'No packages yet.',
  },

  book: {
    /** [i18n] book.* — these are the LABEL texts, which have no htmlFor before Phase 3. */
    title: 'Book Your Event',
    name: 'Full name',
    email: 'Email',
    phone: 'Phone',
    date: 'Event date',
    location: 'Location',
    guests: 'Guest count',
    budget: 'Budget',
    requirements: 'Special requirements',
    submit: 'Submit booking',
    submitting: 'Submitting…',
    successTitle: 'Booking received!',
    successBody: 'Our team will reach out to you shortly to confirm the details.',
    consent: 'I agree to the processing of my personal details for this enquiry, as described in the',
    privacyPolicy: 'privacy policy',
    /** zod messages from `app/(site)/book/page.tsx:16-29`. */
    errors: {
      name: 'Name is required',
      email: 'Valid email required',
      consent: 'Please agree to the privacy policy to continue',
    },
  },

  testimonialForm: {
    /** [i18n] reviewForm.* */
    title: 'Share your experience',
    subtitle: 'Loved working with us? Leave a review — it appears after a quick check.',
    namePlaceholder: 'Your name',
    rolePlaceholder: 'Role (e.g. Bride, Groom)',
    messagePlaceholder: 'Your review',
    submit: 'Submit review',
    sending: 'Submitting…',
    thanksTitle: 'Thank you!',
    thanksBody: 'Your review has been submitted and will appear once approved.',
    ratingRequired: 'Please select a star rating.',
  },

  legal: {
    privacyFallback: 'Our privacy policy will be published here soon.',
    termsFallback: 'Our terms & conditions will be published here soon.',
  },

  login: {
    heading: 'Welcome back',
    subtitle: 'Sign in to the admin dashboard.',
    submit: 'Sign in',
    submitting: 'Signing in…',
    genericFailure: 'Login failed',
    /** Backend `AuthService.login` — identical for unknown email AND bad password. */
    invalidCredentials: 'Invalid credentials',
    passwordRequired: 'Password required',
    invalidEmail: 'Invalid email',
    /**
     * SECURITY_AUDIT.md C-2: the login page prints a working-looking default
     * credential. Phase 3 deletes it; `LOGIN-S-04` asserts it is gone.
     */
    staleDemoHint: 'Demo:',
  },

  session: {
    expired: 'Your session has expired. Please sign in again.',
    adminLoading: 'Loading Utsava dashboard…',
  },

  admin: {
    headerTitle: 'Admin Dashboard',
    logout: 'Logout',

    dashboard: {
      heading: 'Overview',
      subtitle: 'Live metrics from your platform.',
      cards: ['Total Vendors', 'Departments', 'Categories', 'Bookings'] as const,
      revenue: 'Revenue (confirmed)',
      bookingStatus: 'Booking status',
      /** `app/admin/page.tsx:69`. `{error}` is interpolated. */
      errorPrefix: 'Could not load stats:',
    },

    departments: {
      /** ⚠️ The sidebar link says "Departments" but the page h2 says "Categories". */
      heading: 'Categories',
      sidebarLabel: 'Departments',
      addButton: 'Add category',
      editModalHeading: 'Edit category',
      save: 'Save',
      empty: 'No categories yet.',
      noImage: 'No image',
      confirmDelete: 'Delete this department?',
      fields: { name: 'Name', icon: 'Icon (emoji)', description: 'Description', banner: 'Banner image' },
      placeholders: { name: 'e.g. Mehendi', icon: '🎨', description: 'Short description shown on the category card' },
    },

    vendors: {
      heading: 'Vendors & Work',
      subtitle: 'Edit every detail — work, gallery, contact and pricing.',
      addButton: 'Add vendor',
      empty: 'No vendors yet. Click "Add vendor".',
      confirmDelete: 'Delete this vendor and all its packages?',
      save: 'Save vendor',
      saving: 'Saving…',
      backToVendors: 'Back to vendors',
      fields: {
        name: 'Vendor / work name',
        department: 'Department / service',
        experience: 'Experience (years)',
        location: 'Location',
        cities: 'Available cities (comma separated)',
        description: 'Description',
        logo: 'Logo',
        cover: 'Cover image',
        gallery: 'Gallery (portfolio of work)',
        contactNumber: 'Contact number',
        whatsapp: 'WhatsApp',
        email: 'Email',
        website: 'Website',
        instagram: 'Instagram',
        facebook: 'Facebook',
        priceFrom: 'Price from (₹)',
        priceTo: 'Price to (₹)',
        discount: 'Discount (%)',
        available: 'Available',
        bestEvent: 'Best Event (home slider — one per category)',
        trending: 'Trending',
        verified: 'Verified',
      },
      selectPlaceholder: 'Select…',
    },

    packages: {
      heading: 'Packages (pricing tiers)',
      addButton: 'Add package',
      popularChip: 'Popular',
      confirmDelete: 'Delete package?',
      placeholders: { name: 'Package name (e.g. Premium)', price: 'Price (₹)' },
      popularCheckbox: 'Mark as most popular',
    },

    bookings: {
      heading: 'Bookings',
      empty: 'No bookings yet.',
      columns: ['Customer', 'Vendor', 'Date', 'Budget', 'Status', 'Action'] as const,
      statuses: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] as const,
    },

    cms: {
      /** Tab buttons carry the raw lowercase strings; CSS capitalises them. */
      tabs: ['testimonials', 'faqs', 'stats', 'contact', 'legal'] as const,
      savedIndicator: 'Saved ✓',
      testimonials: {
        addHeading: 'Add testimonial',
        pendingHeading: 'Pending approval',
        publishedHeading: 'Published',
        approve: 'Approve',
        reject: 'Reject',
        add: 'Add',
        emptyPublished: 'No published testimonials yet.',
        confirmDelete: 'Delete testimonial?',
        placeholders: { name: 'Customer name', role: 'Role (e.g. Bride)', message: 'Message' },
      },
      faqs: {
        addHeading: 'Add FAQ',
        add: 'Add',
        empty: 'No FAQs yet.',
        confirmDelete: 'Delete FAQ?',
        placeholders: { question: 'Question', answer: 'Answer' },
      },
      stats: { addButton: 'Add stat', save: 'Save', placeholders: { label: 'Label', value: 'Value', suffix: 'Suffix' } },
      contact: {
        save: 'Save',
        fields: {
          manager: 'Manager name',
          role: 'Role / title',
          phone: 'Phone (digits, for tel: link)',
          phoneDisplay: 'Phone (display)',
          whatsapp: 'WhatsApp number (with country code)',
          email: 'Email',
        },
      },
      legal: {
        terms: 'Terms & Conditions',
        privacy: 'Privacy Policy',
        save: 'Save',
        /** tiptap toolbar aria-labels — the only well-labelled control set in admin. */
        toolbar: ['Heading 2', 'Heading 3', 'Bold', 'Italic', 'Bullet list', 'Numbered list', 'Link', 'Undo', 'Redo'] as const,
        linkPrompt: 'Link URL',
      },
    },

    uploads: {
      dropZone: 'Click or drop an image',
      uploading: 'Uploading…',
      galleryAdd: 'Add',
      folders: { departments: 'departments', vendors: 'vendors', testimonials: 'testimonials' } as const,
      /** `MaxFileSizeValidator(8MB)` + `FileTypeValidator(/^image\/(png|jpe?g|webp|gif)$/)`. */
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const,
      /** SVG is deliberately excluded — it can carry <script> and be served from /uploads. */
      rejectedMimeTypes: ['image/svg+xml', 'text/html', 'application/pdf', 'application/javascript'] as const,
    },
  },

  errors: {
    site: { heading: 'Something went wrong', tryAgain: 'Try again', goHome: 'Go home' },
    admin: { heading: 'Dashboard error', tryAgain: 'Try again', backToLogin: 'Back to login' },
    global: { body: 'Something went wrong while loading the page.', reload: 'Reload' },
  },

  loading: {
    /** [i18n] loading.* — BrandLoader rotates these every 1800ms. */
    brand: 'Utsava',
    tagline: 'Where Every Moment Becomes a Festival',
    rotating: ['Gathering inspiration…', 'Setting the stage…', 'Curating vendors & venues…', 'Almost ready…'] as const,
    srOnly: 'Loading…',
  },

  location: {
    /** [i18n] location.* */
    useMy: 'Use my current location',
    nearMe: 'Near me',
    locating: 'Locating…',
    denied: 'Location permission denied — enter your city manually.',
    unavailable: "Couldn't detect your location — enter your city manually.",
  },

  /** Backend error messages worth asserting verbatim. */
  api: {
    emailAlreadyRegistered: 'Email already registered',
    invalidCredentials: 'Invalid credentials',
    accessDenied: 'Access denied',
    passwordTooShort: 'Password must be at least 8 characters',
    /** `AllExceptionsFilter` maps Prisma P2002. */
    duplicateRecord: 'A record with this value already exists.',
    unknownLegalSlug: 'Unknown legal page',
    noFileProvided: 'No file provided',
  },
} as const;

/** Backend rate limits, from the `@Throttle` decorators. Keys drive the 429 specs. */
export const rateLimits = {
  global: { limit: 120, ttlMs: 60_000, route: 'GET /api/departments' },
  login: { limit: 10, ttlMs: 60_000, route: 'POST /api/auth/login' },
  register: { limit: 5, ttlMs: 60_000, route: 'POST /api/auth/register' },
  bookings: { limit: 8, ttlMs: 60_000, route: 'POST /api/bookings' },
  testimonialSubmit: { limit: 5, ttlMs: 60_000, route: 'POST /api/cms/testimonials/submit' },
} as const;
