/**
 * Every third-party host the browser reaches from this app.
 *
 * These are route-mocked centrally by `src/fixtures/network.ts`. Without that,
 * the suite depends on five external services being up and, worse, on
 * `api.mymemory.translated.net` — which the i18n layer calls for every
 * backend-sourced string and which **mutates rendered text after page load**.
 * A text assertion racing a machine translation is unfixably flaky.
 *
 * Verified by reading:
 *   frontend/src/shared/i18n/translate.ts   → mymemory
 *   frontend/src/shared/lib/geo.ts          → photon, nominatim
 *   frontend/src/app/layout.tsx             → Google Fonts <link>
 *   frontend/src/features/website/components/hero.tsx + prisma/seed.ts → unsplash, dicebear, pravatar
 */

export const thirdPartyHosts = {
  /**
   * Live machine translation. Called once per unique backend string when
   * locale === 'te', then rewrites the DOM. Mocked to echo the input so the
   * `te` locale becomes deterministic (and English-passthrough).
   */
  translate: 'https://api.mymemory.translated.net/**',

  /** Location autocomplete behind `LocationInput` (350ms debounce). */
  photon: 'https://photon.komoot.io/**',

  /** Reverse-geocode fallback when photon fails. */
  nominatim: 'https://nominatim.openstreetmap.org/**',

  /** Root layout injects <link> tags for these; blocking them saves ~400ms/page. */
  googleFonts: 'https://fonts.googleapis.com/**',
  googleFontsStatic: 'https://fonts.gstatic.com/**',

  /** Every seeded cover image and gallery item, plus the hard-coded hero image. */
  unsplash: 'https://images.unsplash.com/**',

  /** Seeded vendor logos. */
  dicebear: 'https://api.dicebear.com/**',

  /** Seeded testimonial avatars. */
  pravatar: 'https://i.pravatar.cc/**',
} as const;

/**
 * Hosts whose responses we replace with a deterministic stub rather than block,
 * because the app's behaviour depends on the shape of the answer.
 */
export const stubbedHosts = [thirdPartyHosts.translate, thirdPartyHosts.photon, thirdPartyHosts.nominatim] as const;

/**
 * Hosts we simply abort. Images and fonts are decorative; aborting them keeps
 * layout intact (Next/Image reserves the box) and cuts a lot of network noise.
 * Excluded from the `visual` project, where the images ARE the subject —
 * those specs mask the image regions instead.
 */
export const blockedHosts = [
  thirdPartyHosts.googleFonts,
  thirdPartyHosts.googleFontsStatic,
  thirdPartyHosts.unsplash,
  thirdPartyHosts.dicebear,
  thirdPartyHosts.pravatar,
] as const;

/** Canned photon response — two Indian cities, enough for autocomplete specs. */
export const photonStub = {
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [77.5946, 12.9716] },
      properties: { name: 'Bengaluru', city: 'Bengaluru', state: 'Karnataka', country: 'India', countrycode: 'IN' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [78.4867, 17.385] },
      properties: { name: 'Hyderabad', city: 'Hyderabad', state: 'Telangana', country: 'India', countrycode: 'IN' },
    },
  ],
} as const;

/** Canned nominatim reverse-geocode response. */
export const nominatimStub = {
  address: { city: 'Bengaluru', state: 'Karnataka', country: 'India', country_code: 'in' },
  display_name: 'Bengaluru, Karnataka, India',
} as const;

/** Coordinates used by the geolocation ("near me") specs — Bengaluru city centre. */
export const geolocation = { latitude: 12.9716, longitude: 77.5946 } as const;
