import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CACHE_TAGS } from '@/shared/lib/api';

/**
 * On-demand cache invalidation.
 *
 * Public pages serve content from Next's Data Cache (see `serverApi`), so the
 * backend is only hit when a cache tag is invalidated or the time fallback
 * elapses. This endpoint refreshes a slice immediately after content changes:
 *
 *   POST /api/revalidate?tag=vendors   (tag is one of the cache tags, or "all")
 *
 * The admin panel calls it automatically after every successful create/update/
 * delete (see `api()` in shared/lib/api.ts). Authorization is granted when the
 * caller either:
 *   - provides the shared REVALIDATE_SECRET (for server-to-server / webhooks), or
 *   - forwards a valid admin session token (verified against the backend).
 *
 * ⚠️ REVALIDATE_SECRET is REQUIRED in production — the route returns 503 without it rather than
 * falling open. Outside production a missing secret allows unauthenticated calls, which is what
 * lets the E2E suite bust the cache; it logs a warning each time.
 *
 * ⚠️ Note `api()` forwards `Authorization` and never `?secret=`, so once the secret is set the
 * admin panel relies entirely on the session path below. Those pings are fire-and-forget
 * (`void fetch`), so a failure here surfaces only as "admin edits don't appear on the public
 * site" — with no error anywhere. Verify the session path before enabling the secret.
 */
// Server-side only (route handler) — call the backend directly.
const API_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const VALID_TAGS = new Set<string>(Object.values(CACHE_TAGS));

/** Confirm the bearer token belongs to a real, active session. */
async function hasValidSession(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: authHeader },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  const expected = process.env.REVALIDATE_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  /**
   * Authorization. The two paths are evaluated INDEPENDENTLY and either one grants access:
   *
   *   - a matching `?secret=` — for server-to-server callers and webhooks;
   *   - a bearer token that the backend confirms belongs to a live admin session — this is the
   *     path the admin panel actually uses, since `api()` in shared/lib/api.ts forwards
   *     `Authorization` and never `?secret=`.
   *
   * Previously these were chained (`secretOk ? false : await hasValidSession(...)`), so the session
   * check was never reached whenever the secret check passed — and `secretOk` defaulted to `true`
   * when REVALIDATE_SECRET was unset. The combined effect was that a deployment which simply
   * forgot the variable served an unauthenticated cache-purge endpoint: any caller could
   * `POST ?tag=all` in a loop and force cold backend fetches (serverApi retries twice at a 10s
   * timeout), which is cheap amplification against a free-tier API.
   *
   * Now: missing configuration fails CLOSED in production and is an explicit, logged development
   * affordance everywhere else.
   */
  const secretOk = expected ? secret === expected : false;
  const sessionOk = await hasValidSession(req.headers.get('authorization'));

  if (!expected && isProd) {
    /**
     * A distinct status from 401 on purpose: this is our own misconfiguration, not a rejected
     * caller, and it should read that way in logs and to whoever is debugging a stale page.
     */
    // eslint-disable-next-line no-console
    console.error('[revalidate] REVALIDATE_SECRET is not set — refusing to revalidate in production.');
    return NextResponse.json(
      { ok: false, message: 'Revalidation is not configured. Set REVALIDATE_SECRET.' },
      { status: 503 },
    );
  }

  if (!secretOk && !sessionOk) {
    if (!expected) {
      /**
       * Development convenience, and deliberately loud. The E2E suite depends on this path: it
       * busts the 300s Data Cache so that "admin writes → public page shows it" journeys are
       * deterministic, and scripts/stack.mjs leaves the variable unset for exactly that reason.
       */
      // eslint-disable-next-line no-console
      console.warn(
        '[revalidate] REVALIDATE_SECRET is not set — allowing an unauthenticated revalidation. ' +
          'This is permitted outside production only.',
      );
    } else {
      return NextResponse.json({ ok: false, message: 'Not authorized.' }, { status: 401 });
    }
  }

  const tag = req.nextUrl.searchParams.get('tag') ?? 'all';

  if (tag === 'all') {
    VALID_TAGS.forEach((t) => revalidateTag(t));
    return NextResponse.json({ ok: true, revalidated: [...VALID_TAGS] });
  }

  if (!VALID_TAGS.has(tag)) {
    return NextResponse.json(
      { ok: false, message: `Unknown tag "${tag}". Valid: ${[...VALID_TAGS].join(', ')}, all.` },
      { status: 400 },
    );
  }

  revalidateTag(tag);
  return NextResponse.json({ ok: true, revalidated: [tag] });
}
