import { NextRequest, NextResponse } from 'next/server';

/**
 * Tells the backend who the visitor is.
 *
 * Browser API calls go through the /api/backend rewrite (next.config.mjs), so
 * the backend only ever sees this server's address, and its per-IP rate limits
 * would otherwise lump every visitor into one bucket. Here we forward the
 * visitor's IP plus PROXY_SHARED_SECRET; the backend trusts the IP only when
 * the secret matches (backend/src/common/app-throttler.guard.ts).
 *
 * Inbound copies of both headers are always replaced, so a browser can't
 * choose its own rate-limit key.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete('x-client-ip');
  headers.delete('x-proxy-secret');

  const secret = process.env.PROXY_SHARED_SECRET;
  const ip = clientIp(req);
  if (secret && ip) {
    headers.set('x-client-ip', ip);
    headers.set('x-proxy-secret', secret);
  }

  return NextResponse.next({ request: { headers } });
}

/**
 * On Vercel, `req.ip`, `x-real-ip` and `x-forwarded-for` are set by the
 * platform from the connection; a client-sent X-Forwarded-For is overwritten,
 * not appended to. Elsewhere (next dev, a self-hosted container) those headers
 * arrive straight from the client, so only `req.ip` is used, and without it
 * nothing is forwarded and the backend keeps its connection-IP behaviour.
 */
function clientIp(req: NextRequest): string | null {
  if (req.ip) return req.ip;
  if (process.env.VERCEL !== '1') return null;
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

export const config = {
  matcher: '/api/backend/:path*',
};
