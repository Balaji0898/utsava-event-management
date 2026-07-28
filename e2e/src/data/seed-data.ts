/**
 * A read-only mirror of what `backend/prisma/seed.ts` creates.
 *
 * The seed IS the fixture set. Specs assert against these names rather than
 * against absolute counts, and nothing in the suite mutates a seeded record — a
 * failed test must never corrupt the fixtures for the rest of the run. When the
 * seed changes, this file is the single place to update.
 *
 * Verified against seed.ts, prisma/outdoor-events.ts and the FUNCTION_HALLS block.
 *
 * NOTE on counts: deliberately expressed as `atLeast` minimums. `findAll` returns
 * a global `total`, and the suite creates its own records in parallel, so an
 * exact-equality assertion on any total is guaranteed to flake.
 */

export const seededDepartments = [
  { name: 'Photography', slug: 'photography', icon: '📸', description: 'Capture your moments in style.' },
  { name: 'Catering', slug: 'catering', icon: '🍽️', description: 'Delicious food for every occasion.' },
  { name: 'Decoration', slug: 'decoration', icon: '🎈', description: 'Stunning décor and stage setups.' },
  { name: 'Lighting', slug: 'lighting', icon: '💡', description: 'Ambient and event lighting.' },
  { name: 'Entertainment', slug: 'entertainment', icon: '🎤', description: 'DJs, artists and live shows.' },
  {
    name: 'Function Halls',
    slug: 'function-halls',
    icon: '🏛️',
    description: 'Banquet halls, convention centres and lawns for every occasion.',
  },
  { name: 'Outdoor Events', slug: 'outdoor-events', icon: '🌤️', description: '' },
] as const;

/** The five `<Department> Studio <n>` vendors, one per core department. */
export const seededStudios = [
  { name: 'Photography Studio 1', slug: 'photography-studio-1', department: 'Photography', featured: true },
  { name: 'Catering Studio 2', slug: 'catering-studio-2', department: 'Catering', featured: true },
  { name: 'Decoration Studio 3', slug: 'decoration-studio-3', department: 'Decoration', featured: true },
  { name: 'Lighting Studio 4', slug: 'lighting-studio-4', department: 'Lighting', featured: false },
  { name: 'Entertainment Studio 5', slug: 'entertainment-studio-5', department: 'Entertainment', featured: false },
] as const;

/**
 * Function halls. `capacity` is embedded in the description as
 * "Capacity: N guests." and the home page parses it back out with
 * `/Capacity:\s*(\d+)/i` — so a description-format change silently breaks the
 * Function Halls section, which is why the capacity is asserted in a spec.
 */
export const seededFunctionHalls = [
  { name: 'Grand Palace Convention', slug: 'grand-palace-convention', capacity: 800, priceFrom: 150000, priceTo: 600000, location: 'Bengaluru' },
  { name: 'Royal Gardens Banquet & Lawns', slug: 'royal-gardens-banquet-lawns', capacity: 400, priceFrom: 80000, priceTo: 300000, location: 'Hyderabad' },
  { name: 'Lotus Community Hall', slug: 'lotus-community-hall', capacity: 200, priceFrom: 40000, priceTo: 120000, location: 'Chennai' },
  { name: 'Emerald Hall & Lawns', slug: 'emerald-hall-lawns', capacity: 1000, priceFrom: 200000, priceTo: 800000, location: 'Bengaluru' },
] as const;

export const seededOutdoorEvents = [
  { name: 'Serene Garden Weddings', slug: 'serene-garden-weddings' },
  { name: 'Azure Beachside Events', slug: 'azure-beachside-events' },
  { name: 'Skyline Rooftop Celebrations', slug: 'skyline-rooftop-celebrations' },
  { name: 'Meadow Open-Air Venues', slug: 'meadow-open-air-venues' },
] as const;

/** Every studio vendor gets these three packages; `Premium` is `popular`. */
export const seededStudioPackages = [
  { name: 'Basic', price: 25000, popular: false, features: ['1 Professional', '100 Deliverables', '4 Hours'] },
  { name: 'Premium', price: 60000, popular: true, features: ['2 Professionals', 'Add-ons included', 'Full Day'] },
  { name: 'Luxury', price: 120000, popular: false, features: ['Team of experts', 'All premium add-ons', 'Unlimited deliverables'] },
] as const;

/** Function-hall package tiers. `Full Day (12 hrs)` is `popular`. */
export const seededHallPackages = ['Half Day (6 hrs)', 'Full Day (12 hrs)', 'Wedding Package'] as const;

/** Outdoor-event package tiers. `Signature` is `popular`. */
export const seededOutdoorPackages = ['Essentials', 'Signature', 'Grand'] as const;

/** All four seeded testimonials are created `approved: true`, so all are public. */
export const seededTestimonials = [
  { name: 'Ananya Rao', role: 'Bride', message: 'Our wedding was flawless. Every vendor was a delight to work with!' },
  { name: 'Vikram Shetty', role: 'Corporate Lead', message: 'Booked catering and lighting for our gala — seamless and professional.' },
  { name: 'Priya Nair', role: 'Event Planner', message: 'The best platform to find reliable vendors in minutes.' },
  { name: 'Rahul Mehta', role: 'Groom', message: 'Transparent pricing and amazing packages. Highly recommend!' },
] as const;

export const seededFaqs = [
  { question: 'How do I book a vendor?', answer: 'Browse vendors or packages, then submit a booking request. Our team confirms the details with you.' },
  { question: 'Are the vendors verified?', answer: 'Vendors marked with a shield badge are verified by our team for quality and reliability.' },
  { question: 'Can I customise a package?', answer: 'Yes — mention your requirements in the booking form and the vendor will tailor a quote.' },
  { question: 'What areas do you cover?', answer: 'We currently operate across 32+ cities, with new locations added regularly.' },
] as const;

/** `home-stats` block — drives the four AnimatedCounter cards on the home page. */
export const seededStats = [
  { label: 'Events Delivered', value: 5200, suffix: '+' },
  { label: 'Verified Vendors', value: 480, suffix: '+' },
  { label: 'Cities', value: 32, suffix: '' },
  { label: 'Happy Customers', value: 12000, suffix: '+' },
] as const;

/**
 * `site-contact` block. These values feed the footer, the contact section and the
 * WhatsApp FAB site-wide through `SiteContactProvider`, so editing them in
 * /admin/cms is observable on every public page — which is what the CMS
 * propagation journey asserts.
 */
export const seededContact = {
  manager: 'Balaji Guggilam',
  role: 'Event Manager & Owner',
  phone: '8790233572',
  phoneDisplay: '+91 87902 33572',
  whatsapp: '918790233572',
  email: 'hello@utsava.events',
} as const;

/** CMS block keys the seed creates. */
export const seededCmsBlocks = ['home-hero', 'site-contact', 'home-stats', 'about-main'] as const;

/**
 * The seed does NOT create `legal-terms` or `legal-privacy`.
 *
 * So on a freshly seeded database /privacy and /terms render their fallback copy
 * ("Our privacy policy will be published here soon."), and every legal-content
 * spec must author the content first. Do not "fix" this by asserting real prose.
 */
export const seededLegalBlocks: readonly string[] = [];

/** Minimums, never equalities — see the note at the top of this file. */
export const seedTotals = {
  departmentsAtLeast: 7,
  vendorsAtLeast: 13,
  packagesAtLeast: 39,
  approvedTestimonialsAtLeast: 4,
  faqsAtLeast: 4,
  /** Every seeded vendor has exactly one review, so ratings render non-zero. */
  reviewsPerSeededVendor: 1,
} as const;

/** A seeded vendor guaranteed to have a gallery, packages and a review. */
export const anchorVendor = seededStudios[0];

/** A seeded vendor in a department the home page renders a dedicated panel for. */
export const anchorHall = seededFunctionHalls[0];
