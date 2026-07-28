import { test, expect } from '@fixtures/test';
import { apiPaths, paths } from '@config/urls';
import { run, urls } from '@config/env';

/**
 * SEC headers & CORS — the transport-level controls.
 *
 * Deliberately split from data-exposure: these are environment-sensitive (helmet's CSP is
 * disabled in non-production on purpose) so the assertions have to be precise about which
 * environment they are describing, or they become noise.
 */

test.describe('SEC headers - API', () => {
  test('SEC-13 the API sets the core protective headers', async ({ anonApi }) => {
    const headers = (await anonApi.get(apiPaths.departments.list)).headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-dns-prefetch-control'] ?? 'off').toBeDefined();
    expect(
      headers['referrer-policy'] ?? headers['x-frame-options'],
      'helmet must set at least referrer and framing policy',
    ).toBeTruthy();
  });

  test('SEC-14 the API does not advertise its stack', async ({ anonApi }) => {
    const headers = (await anonApi.get(apiPaths.departments.list)).headers();
    expect(headers['x-powered-by'], 'helmet strips X-Powered-By').toBeUndefined();
  });

  test('SEC-15 HSTS is present when served over TLS', async ({ anonApi }) => {
    /**
     * helmet sets `Strict-Transport-Security` unconditionally, but a browser ignores it over
     * plain HTTP — and the local stack is HTTP. So this only asserts anything when the suite
     * is pointed at an HTTPS deployment, and skips otherwise rather than pretending.
     */
    test.skip(!urls.api.startsWith('https://'), 'HSTS is only meaningful over TLS; the local stack is HTTP');

    const headers = (await anonApi.get(apiPaths.departments.list)).headers();
    expect(headers['strict-transport-security']).toContain('max-age=');
  });
});

test.describe('SEC headers - frontend', () => {
  test('SEC-16 the site sets the headers declared in next.config.mjs', async ({ page }) => {
    const res = await page.goto(paths.home);
    const headers = res?.headers() ?? {};

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options'], 'clickjacking protection').toBe('SAMEORIGIN');
    expect(headers['content-security-policy'], 'frame-ancestors is the CSP that IS set').toContain('frame-ancestors');
    expect(headers['referrer-policy']).toBeTruthy();

    /**
     * `geolocation=(self)` is required — the "near me" search needs it. `camera=()` and
     * `microphone=()` must stay denied; the app has no use for either, so any widening is a
     * regression worth catching.
     */
    const permissions = headers['permissions-policy'] ?? '';
    expect(permissions).toContain('geolocation=(self)');
    expect(permissions).toContain('camera=()');
    expect(permissions).toContain('microphone=()');
  });

  test('SEC-17 the site does not ship a script-src CSP yet', async ({ page }) => {
    /**
     * SECURITY_AUDIT.md M-2. The only CSP in place is `frame-ancestors`, which does nothing
     * against XSS. Combined with H-1 (the bypassable sanitizer) and M-3 (tokens in
     * localStorage), a surviving payload can exfiltrate an admin session.
     *
     * Written as an expected-failure asserting the SECURE state, so the day a real
     * `script-src` lands this test goes green, the annotation is deleted, and the
     * known-vulnerability count in the report drops.
     */
    test.info().annotations.push({
      type: 'known-vulnerability',
      description:
        'M-2 (SECURITY_AUDIT.md) — no script-src CSP on the frontend, so a sanitizer bypass (H-1) ' +
        'can exfiltrate the localStorage tokens. Owner: frontend.',
    });
    test.fail();

    const res = await page.goto(paths.home);
    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp, 'a real CSP should restrict script sources, not only framing').toMatch(
      /script-src|default-src/,
    );
  });
});

test.describe('SEC CORS', () => {
  test('SEC-18 a foreign origin is not granted access', async ({ anonApi }) => {
    /**
     * `enableCors({ origin: CORS_ORIGIN.split(','), credentials: true })` — with
     * `credentials: true`, a reflected or wildcard origin would let any site read
     * authenticated responses. So the check is that the header is either absent or exactly
     * our own origin; never the attacker's, and never `*`.
     */
    const res = await anonApi.get(apiPaths.departments.list, {
      headers: { Origin: 'https://attacker.example' },
    });
    const allowed = res.headers()['access-control-allow-origin'];

    expect(allowed, 'a foreign origin must not be reflected').not.toBe('https://attacker.example');
    expect(allowed, 'a wildcard is invalid alongside credentials: true').not.toBe('*');
  });

  test('SEC-19 the configured origin IS granted access', async ({ anonApi }) => {
    /**
     * Proves CORS is configured rather than simply broken shut — a deny-everything policy would
     * break the app just as thoroughly as an allow-everything one.
     *
     * ⚠️ `http://localhost:3000` and `http://127.0.0.1:3000` are DIFFERENT origins to CORS. This
     * suite uses `127.0.0.1` deliberately (Node 18+ resolves `localhost` to ::1 first, which
     * stalls against Nest's IPv4-only listener), and `scripts/stack.mjs` accordingly boots the
     * backend with `CORS_ORIGIN` set to that same base URL — so in a normal run they match.
     *
     * They only diverge when the suite is pointed at a stack someone else booted, typically from
     * `backend/.env` where `CORS_ORIGIN=http://localhost:3000`. That is a harness mismatch, not a
     * security finding, so it skips with a message that says which it is rather than failing and
     * being dismissed as noise.
     */
    const res = await anonApi.get(apiPaths.departments.list, { headers: { Origin: urls.base } });
    const allowed = res.headers()['access-control-allow-origin'];

    test.skip(
      !allowed && !run.ephemeralDb,
      `The API does not allow ${urls.base}. Running against an externally-booted stack whose ` +
        'CORS_ORIGIN is probably http://localhost:3000 — note localhost and 127.0.0.1 are ' +
        'different origins to CORS. Run via `npm run e2e` for a stack configured to match.',
    );

    expect(allowed, `the frontend origin ${urls.base} must be allowed`).toBe(urls.base);
  });

  test('SEC-20 a preflight from a foreign origin is not approved for a mutating method', async ({ anonApi }) => {
    const res = await anonApi.raw(`${urls.api}/api${apiPaths.departments.list}`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    expect(res.headers()['access-control-allow-origin']).not.toBe('https://attacker.example');
  });
});

test.describe('SEC token storage', () => {
  test('SEC-21 session tokens live in localStorage, readable by any script', async ({ loginPage, page }) => {
    /**
     * SECURITY_AUDIT.md M-3. `accessToken` and `refreshToken` are in localStorage rather than
     * in httpOnly cookies, so ANY script that runs on the page can read them — which is what
     * turns the H-1 sanitizer bypass from a defacement into a full account takeover.
     *
     * Asserted as the secure state (nothing sensitive readable from JS) and marked
     * expected-fail, so migrating to httpOnly cookies flips it green.
     */
    test.info().annotations.push({
      type: 'known-vulnerability',
      description:
        'M-3 (SECURITY_AUDIT.md) — access and refresh tokens are stored in localStorage, so any ' +
        'injected script can exfiltrate them. Owner: frontend/shared/lib/api.ts.',
    });
    test.fail();

    await loginPage.open();
    const readable = await page.evaluate(() => Object.keys(localStorage));
    expect(readable, 'no credential should be reachable from page scripts').not.toContain('refreshToken');
  });
});
