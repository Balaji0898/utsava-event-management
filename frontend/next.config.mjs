/** @type {import('next').NextConfig} */

// Security headers applied to every response. Deliberately conservative so they
// harden the app without breaking rendering, images, geolocation, or the API
// calls the site already makes. (A strict script-src CSP is intentionally not
// set here because Next's hydration/runtime relies on inline scripts; XSS is
// mitigated at the source by the allowlist sanitizer in shared/lib/sanitize.ts.)
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Frame-ancestors is the modern clickjacking control; keep geolocation for the
  // "use my location" feature, disable camera/microphone.
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// Backend origin — resolved server-side only (rewrite destination + RSC fetches).
// Prefer a server-only var so the backend host is never shipped in the client
// bundle; fall back to the existing public var so current deployments keep
// working unchanged.
const BACKEND_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Images can be admin-entered arbitrary https URLs (Unsplash, DiceBear,
    // Cloudinary, and self-hosted uploads), so the host pattern stays broad.
    // Restrict to specific hosts here if the set of image sources is ever fixed.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Same-origin reverse proxy. All browser API traffic goes to /api/backend/* on
  // THIS origin and is forwarded server-side to the backend — the backend origin
  // is never exposed to the browser and there is no cross-origin/CORS surface.
  // Locally-stored uploads are proxied too so their URLs stay same-origin.
  // (Cloudinary URLs are absolute and load directly, unaffected.)
  async rewrites() {
    return [
      { source: '/api/backend/:path*', destination: `${BACKEND_URL}/api/:path*` },
      { source: '/uploads/:path*', destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
