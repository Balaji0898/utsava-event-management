/**
 * The refusal guard — the single most important safety feature in this suite.
 *
 * `prisma migrate reset --force` DROPS AND RECREATES the schema. At the time this
 * suite was written, `backend/.env` pointed at the LIVE Neon production database
 * (SECURITY_AUDIT.md finding C-4). An accidentally-inherited DATABASE_URL is
 * therefore a data-loss event, not a flaky test.
 *
 * Every DB-touching script calls `assertDisposableDatabase()` before doing
 * anything. It fails closed: no positive proof of disposability, no run.
 */

/**
 * Hosts that must NEVER be reset, under any circumstances — not even with
 * E2E_ALLOW_DESTRUCTIVE_DB=1. Add every production endpoint you ever point this
 * repo at. This is the last line of defence and it is deliberately absolute.
 */
const FORBIDDEN_HOST_FRAGMENTS = [
  'ep-steep-block-awogjuek', // the live Utsava production Neon endpoint
];

/** Matches an `e2e` / `test` / `ci` marker delimited in a host or database name. */
const DISPOSABLE_MARKER = /(^|[-_/.])(e2e|test|ci|staging)([-_/.]|$)/i;

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)$/;

/**
 * @param {string | undefined} url  a postgres:// or postgresql:// connection string
 * @param {{ provisioned?: boolean }} [opts]  `provisioned: true` means we created
 *        this Neon branch moments ago in this same process, so it is disposable
 *        by construction.
 * @returns {string} the url, unchanged, when it is safe to destroy
 */
export function assertDisposableDatabase(url, { provisioned = false } = {}) {
  if (!url || !url.trim()) {
    throw new Error(
      'No DATABASE_URL resolved — refusing to continue.\n' +
        'Set NEON_API_KEY + NEON_PROJECT_ID for branch-per-run, or E2E_DATABASE_URL for an external Postgres.',
    );
  }

  // `new URL` needs a known scheme to populate hostname; postgres:// is opaque to it.
  let parsed;
  try {
    parsed = new URL(url.replace(/^postgres(ql)?:/, 'http:'));
  } catch {
    throw new Error('DATABASE_URL is not a parseable connection string — refusing to continue.');
  }
  const { hostname, pathname } = parsed;
  const identity = `${hostname}${pathname}`;

  for (const bad of FORBIDDEN_HOST_FRAGMENTS) {
    if (hostname.includes(bad)) {
      throw new Error(
        `REFUSING: "${hostname}" is a known production endpoint.\n` +
          'This script runs `prisma migrate reset --force`, which drops the schema.\n' +
          'There is no override for this check. Point the suite at a Neon branch or a local Postgres.',
      );
    }
  }

  // A branch we just created in this process. Disposable by construction.
  if (provisioned) return url;

  if (LOCAL_HOST.test(hostname)) return url;
  if (DISPOSABLE_MARKER.test(identity)) return url;

  if (process.env.E2E_ALLOW_DESTRUCTIVE_DB === '1') {
    console.warn(
      `::warning::E2E_ALLOW_DESTRUCTIVE_DB=1 — about to DROP AND RESEED ${identity}. ` +
        'This was explicitly authorised by the environment.',
    );
    return url;
  }

  throw new Error(
    `REFUSING to reset ${identity}.\n` +
      'It is not localhost, its host/database name carries no e2e/test/ci/staging marker, ' +
      'and it is not a freshly provisioned Neon branch.\n' +
      'If you are certain this database is disposable, set E2E_ALLOW_DESTRUCTIVE_DB=1.',
  );
}

/**
 * Exported for the guard's own self-test spec, so the forbidden list cannot be
 * silently emptied without a test noticing.
 */
export const _internals = { FORBIDDEN_HOST_FRAGMENTS, DISPOSABLE_MARKER, LOCAL_HOST };
