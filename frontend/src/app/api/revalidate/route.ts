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
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
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

  const secretOk = expected ? secret === expected : true; // open only when unset (dev)
  const sessionOk = secretOk ? false : await hasValidSession(req.headers.get('authorization'));

  if (!secretOk && !sessionOk) {
    return NextResponse.json({ ok: false, message: 'Not authorized.' }, { status: 401 });
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
