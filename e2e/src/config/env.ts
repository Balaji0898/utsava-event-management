/**
 * Typed environment accessors.
 *
 * Everything the suite reads from the environment goes through here, so a spec
 * never touches `process.env` directly and a missing variable produces one clear
 * message instead of an `undefined` that surfaces as a mystery timeout.
 *
 * Convention borrowed from the sibling Playright suite: a private `readEnv`,
 * exported `as const` groups, and predicate helpers for `test.skip(...)` guards.
 */

function readEnv(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim();
}

function readBool(key: string, fallback: boolean): boolean {
  const raw = readEnv(key);
  if (!raw) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/**
 * 127.0.0.1 rather than localhost — Node 18+ prefers ::1, which stalls for the
 * full connect timeout against Nest's IPv4-only listener.
 */
export const urls = {
  base: readEnv('E2E_BASE_URL', 'http://127.0.0.1:3000').replace(/\/$/, ''),
  api: readEnv('E2E_API_URL', 'http://127.0.0.1:4000').replace(/\/$/, ''),
} as const;

/** The seeded SUPER_ADMIN. Deterministic only because `prepare-db.mjs` injects it. */
export const admin = {
  email: readEnv('E2E_ADMIN_EMAIL', 'e2e-admin@utsava.test'),
  password: readEnv('E2E_ADMIN_PASSWORD'),
} as const;

export const run = {
  /**
   * Identity of this run, set by `scripts/run-e2e.mjs`. Prefixes every record the
   * suite creates so a crashed worker's leftovers can be swept by name, and so
   * two concurrent runs against the same branch cannot collide.
   */
  id: readEnv('E2E_RUN_ID', 'local-adhoc'),

  /**
   * True when the database is a throwaway (a Neon branch or a marked local
   * Postgres) that the suite reset and seeded itself. False when running against
   * a stack someone else booted — in which case every @mutates spec skips,
   * because that database might be production.
   */
  ephemeralDb: readBool('E2E_EPHEMERAL_DB', readEnv('E2E_SKIP_DB') !== '1'),

  /**
   * Give each worker its own throttler bucket via X-Forwarded-For.
   * `backend/src/main.ts` sets `trust proxy: 1`, so Express resolves req.ips[0]
   * from that header and @nestjs/throttler keys on it — which is what lets the
   * suite run in parallel despite login 10/min, register 5/min, bookings 8/min
   * and testimonial-submit 5/min limits.
   *
   * The rate-limit security specs set this to 0 so they share one bucket and can
   * observe a real 429.
   */
  ipPartition: readBool('E2E_IP_PARTITION', true),
} as const;

/**
 * Secret for `POST /api/revalidate`, set by `scripts/run-e2e.mjs`.
 *
 * The frontend runs under NODE_ENV=production, where that route fails closed — so cache-busting
 * must authenticate. Empty when running against an externally-booted stack, in which case
 * `BasePage.revalidate()` sends no secret and relies on the route's non-production affordance.
 */
export const revalidateSecret = readEnv('E2E_REVALIDATE_SECRET');

/** Absolute API URL for a path like `/auth/login` (the backend prefix is `/api`). */
export function apiUrl(path: string): string {
  return `${urls.api}/api${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute site URL for a path like `/vendors`. */
export function siteUrl(path = '/'): string {
  return `${urls.base}${path.startsWith('/') ? path : `/${path}`}`;
}

// ---------------------------------------------------------------- predicates

/** Guard for every spec that logs in or calls an authenticated endpoint. */
export function hasAdminCredentials(): boolean {
  return admin.email.length > 0 && admin.password.length >= 8;
}

/**
 * Guard for every spec that creates, updates or deletes data.
 *
 * `backend/.env` points at the live production database, so a suite pointed at
 * an unknown stack must not write. Tag those specs `@mutates` and gate them on
 * this predicate rather than hoping nobody runs them in the wrong place.
 */
export function canMutateData(): boolean {
  return run.ephemeralDb;
}

/** Visual baselines are committed for linux only — see playwright.config.ts. */
export function canCompareScreenshots(): boolean {
  return process.platform === 'linux';
}

/**
 * `scripts/stack.mjs` boots the backend with NODE_ENV=test, so Swagger is
 * mounted and the relaxed dev CSP is active. Production-hardening assertions
 * skip unless someone deliberately points the suite at a prod-mode server.
 */
export function isProdModeApi(): boolean {
  return readBool('E2E_API_PROD_MODE', false);
}
