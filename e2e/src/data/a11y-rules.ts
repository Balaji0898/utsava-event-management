/**
 * axe-core configuration and the known-violation register.
 *
 * The register is the whole point of this file. An a11y suite that fails on every
 * pre-existing violation gets muted within a week, and one that disables rules
 * globally never catches a regression. So: each accepted violation is listed
 * individually, per page, with the reason and the fix that would retire it.
 *
 * Everything not listed here is a hard failure.
 */

/**
 * WCAG 2.1 AA is the gate. `best-practice` is included as a separate, reported-but
 * non-blocking pass — it catches real problems (landmarks, heading order) but also
 * opinions we do not want gating a push.
 */
export const axeTags = {
  blocking: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  advisory: ['best-practice'],
} as const;

/**
 * Rules disabled everywhere, with justification. Keep this list as close to empty
 * as possible.
 */
export const globallyDisabledRules = [
  /**
   * `Hero3D` mounts a @react-three/fiber <canvas> on /, /login and every admin
   * header. Under SwiftShader it renders a decorative gem with no text
   * alternative, and axe's colour-contrast pass samples its pixels and reports
   * nondeterministic failures. The canvas itself is asserted `aria-hidden` by a
   * dedicated spec instead, which is the real requirement.
   */
  'color-contrast-enhanced',
] as const;

/** A known, accepted violation. */
export type KnownViolation = {
  /** axe rule id, e.g. 'button-name'. */
  rule: string;
  /** Route it occurs on, or '*' for every route. */
  route: string;
  /** Why it is accepted today. */
  reason: string;
  /** What retires it. Referenced from the Phase 3 hook list. */
  fix: string;
  /** Bug id from the plan's findings list, when there is one. */
  bug?: string;
};

/**
 * The register.
 *
 * Every entry here was found by reading the source, and every one is expected to
 * DISAPPEAR once the Phase 3 testability/a11y hooks land — the hooks were chosen
 * partly to close these. After Phase 3, run `npm run test:a11y` and delete each
 * entry that no longer reproduces. An entry that no longer reproduces is reported
 * as an over-broad exception, so the register cannot rot.
 */
export const knownViolations: readonly KnownViolation[] = [
  {
    rule: 'region',
    route: '/login',
    reason: 'The (auth) route group has no layout, so the page renders without a <main> landmark.',
    fix: 'Add app/(auth)/layout.tsx with a <main> wrapper.',
    bug: 'B6',
  },
  {
    rule: 'region',
    route: '/admin*',
    reason: 'app/admin/layout.tsx wraps children in a <div>, not a <main>.',
    fix: 'Change the admin content wrapper to <main>.',
    bug: 'B6',
  },
  {
    rule: 'button-name',
    route: '/admin/cms',
    reason: 'The published-testimonial and FAQ delete buttons are icon-only Trash2 with no accessible name.',
    fix: 'aria-label="Delete testimonial" / "Delete FAQ" — Phase 3, admin/cms/page.tsx.',
    bug: 'B4',
  },
  {
    rule: 'button-name',
    route: '/admin/vendors/*',
    reason: 'PackagesManager delete and the ImageUploader/GalleryUploader remove buttons are unlabelled.',
    fix: 'aria-label on each — Phase 3, packages-manager.tsx / image-uploader.tsx / gallery-uploader.tsx.',
    bug: 'B4',
  },
  {
    rule: 'scrollable-region-focusable',
    route: '/admin/vendors',
    reason: 'The table wrapper is overflow-x-auto with no tabIndex, so keyboard users cannot scroll it.',
    fix: 'tabIndex={0} on the scroll container — Phase 3.',
    bug: 'B5',
  },
  {
    rule: 'scrollable-region-focusable',
    route: '/admin/bookings',
    reason: 'Same overflow-x-auto wrapper as the vendors table.',
    fix: 'tabIndex={0} on the scroll container — Phase 3.',
    bug: 'B5',
  },
  {
    rule: 'select-name',
    route: '/admin/bookings',
    reason: 'The per-row booking status <select> has no label and no aria-label.',
    fix: 'aria-label={`Status for ${booking.customerName}`} — Phase 3.',
    bug: 'B3',
  },
  {
    rule: 'label',
    route: '*',
    reason:
      'Repo-wide there are zero htmlFor attributes, so no <label> is programmatically associated with its input.',
    fix: 'The Phase 3 htmlFor/id pass. This is the single highest-value a11y fix in the app.',
  },
  {
    rule: 'html-has-lang',
    route: '*',
    reason:
      'A persisted `te` locale never updates <html lang>, which stays "en". Only reproduces with locale=te.',
    fix: 'Set document.documentElement.lang in the I18nProvider effect.',
    bug: 'B7',
  },
];

/** Violations accepted on a given route: global rules plus route-specific ones. */
export function acceptedRulesFor(route: string): string[] {
  const matches = (pattern: string) =>
    pattern === '*' || pattern === route || (pattern.endsWith('*') && route.startsWith(pattern.slice(0, -1)));

  return [
    ...globallyDisabledRules,
    ...knownViolations.filter((v) => matches(v.route)).map((v) => v.rule),
  ];
}

/**
 * Pages that get a full axe scan. Deliberately not "every route" — the admin
 * vendor form and CMS legal tab need a logged-in, populated state that a generic
 * sweep cannot set up, so those get bespoke specs.
 */
export const scannedRoutes = {
  public: ['/', '/vendors', '/packages', '/book', '/testimonials', '/privacy', '/terms'] as const,
  auth: ['/login'] as const,
  admin: ['/admin', '/admin/departments', '/admin/vendors', '/admin/bookings', '/admin/cms'] as const,
} as const;

/**
 * Elements excluded from every scan.
 *
 * Kept to the absolute minimum: only the WebGL canvas, whose pixels axe samples
 * nondeterministically under SwiftShader.
 */
export const globalExcludes: readonly string[] = ['canvas'];
