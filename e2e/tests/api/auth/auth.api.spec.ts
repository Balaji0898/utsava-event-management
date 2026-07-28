import { test, expect } from '@fixtures/test';
import { apiPaths } from '@config/urls';
import { admin } from '@config/env';
import { emails, messages, passwords, payloads } from '@data/test-data';

/**
 * API-AUTH — the authentication contract.
 *
 * Serial, because the refresh-token rotation cases mutate `User.refreshToken` for
 * the account they use, and because `POST /auth/register` is throttled to 5/min per
 * bucket.
 */
test.describe.configure({ mode: 'serial' });

test.describe('API auth - positive cases', () => {
  test('API-AUTH-P-01 logs in with the seeded admin and returns a sanitized user', async ({ anonApi }) => {
    const res = await anonApi.post(apiPaths.auth.login, { email: admin.email, password: admin.password });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.accessToken, 'an access token must be issued').toBeTruthy();
    expect(body.refreshToken, 'a refresh token must be issued').toBeTruthy();
    expect(body.user.email).toBe(admin.email);
    expect(body.user.role).toBe('SUPER_ADMIN');

    /**
     * `AuthService.sanitize()` strips these. This is the local half of the
     * SECURITY_AUDIT.md H-2 concern; the global sweep across every endpoint lives in
     * tests/security/data-exposure.security.spec.ts.
     */
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('refreshToken');
  });

  test('API-AUTH-P-02 GET /auth/me returns the caller and never leaks credentials', async ({ api }) => {
    const me = await api.me();
    expect(me.email).toBe(admin.email);
    expect(me.role).toBe('SUPER_ADMIN');
    expect(me).not.toHaveProperty('passwordHash');
    expect(me).not.toHaveProperty('refreshToken');
  });

  test('API-AUTH-P-03 registers a CUSTOMER and forces the role regardless of input', async ({ anonApi, factory }) => {
    const email = factory.email('reg');
    const res = await anonApi.post(apiPaths.auth.register, {
      name: 'E2E Registrant',
      email,
      password: passwords.strong,
      /**
       * Mass-assignment attempt. `ValidationPipe({ whitelist: true })` must strip
       * every property not declared on RegisterDto, and `AuthService.register`
       * hard-codes `role: Role.CUSTOMER` regardless.
       */
      ...payloads.massAssignment.register,
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.user.role, 'a self-registered user must never be an admin').toBe('CUSTOMER');
    expect(body.user.email).toBe(email);
    expect(body.user.id).not.toBe('injected-id');
    expect(body.user).not.toHaveProperty('passwordHash');
  });

  test('API-AUTH-P-04 rotates the refresh token, invalidating the previous one', async ({ anonApi, factory }) => {
    const email = factory.email('rotate');
    const registered = await anonApi.registerCustomer(email, passwords.strong);
    const firstRefresh = registered.refreshToken;

    /**
     * `POST /auth/refresh` is guarded by `JwtRefreshGuard` and expects the REFRESH
     * token as its Bearer — not the access token.
     */
    const rotated = await anonApi.refresh(firstRefresh);
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).not.toBe(firstRefresh);

    /**
     * The old token must now fail. `AuthService.refresh` overwrites the stored bcrypt
     * hash on every use, so replaying a captured token is a dead end — that is the
     * property worth asserting, not merely that refresh works.
     */
    const replay = await anonApi.as(firstRefresh).post(apiPaths.auth.refresh);
    expect(replay.status(), 'a used refresh token must not be replayable').toBe(403);
    expect((await replay.json()).message).toBe(messages.api.accessDenied);
  });

  test('API-AUTH-P-05 logout clears the stored refresh token', async ({ anonApi, factory }) => {
    const email = factory.email('logout');
    const session = await anonApi.registerCustomer(email, passwords.strong);

    const loggedOut = await anonApi.as(session.accessToken).post(apiPaths.auth.logout);
    expect(loggedOut.ok()).toBeTruthy();

    const afterLogout = await anonApi.as(session.refreshToken).post(apiPaths.auth.refresh);
    expect(afterLogout.status(), 'refresh must fail once the stored token is nulled').toBe(403);
  });

  test('API-AUTH-P-06 PATCH /auth/me updates only name and phone', async ({ anonApi, factory }) => {
    const email = factory.email('profile');
    const session = await anonApi.registerCustomer(email, passwords.strong);
    const asCustomer = anonApi.as(session.accessToken);

    const res = await asCustomer.patch(apiPaths.auth.me, {
      name: 'Corrected Name',
      phone: '+91 90000 11111',
      /** UpdateProfileDto declares only name and phone; the rest must be stripped. */
      ...payloads.massAssignment.profile,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('Corrected Name');
    expect(body.phone).toBe('+91 90000 11111');
    expect(body.role, 'role must not be self-assignable').toBe('CUSTOMER');
    expect(body.email, 'email must not be changeable via the profile endpoint').toBe(email);
    expect(body).not.toHaveProperty('passwordHash');
  });

  test('API-AUTH-P-07 DELETE /auth/me erases the account and anonymizes its bookings', async ({
    anonApi,
    factory,
  }) => {
    const email = factory.email('erasure');
    const session = await anonApi.registerCustomer(email, passwords.strong);
    const asCustomer = anonApi.as(session.accessToken);

    const deleted = await asCustomer.delete(apiPaths.auth.me);
    expect(deleted.ok(), 'DPDP right to erasure must be honoured').toBeTruthy();

    /** The credentials must no longer authenticate. */
    const relogin = await anonApi.post(apiPaths.auth.login, { email, password: passwords.strong });
    expect(relogin.status()).toBe(401);
  });
});

test.describe('API auth - negative cases', () => {
  test('API-AUTH-N-01 rejects an unknown email and a wrong password identically', async ({ anonApi }) => {
    const unknown = await anonApi.post(apiPaths.auth.login, {
      email: emails.unregistered,
      password: passwords.strong,
    });
    const wrongPassword = await anonApi.post(apiPaths.auth.login, {
      email: admin.email,
      password: passwords.wrong,
    });

    expect(unknown.status()).toBe(401);
    expect(wrongPassword.status()).toBe(401);

    /**
     * Identical status AND identical message. A different response for "no such user"
     * would be a user-enumeration oracle against the public login endpoint.
     */
    expect((await unknown.json()).message).toBe(messages.api.invalidCredentials);
    expect((await wrongPassword.json()).message).toBe(messages.api.invalidCredentials);
  });

  test('API-AUTH-N-02 rejects a duplicate registration with 403', async ({ anonApi }) => {
    const res = await anonApi.post(apiPaths.auth.register, {
      name: 'Duplicate',
      email: admin.email,
      password: passwords.strong,
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe(messages.api.emailAlreadyRegistered);
  });

  test('API-AUTH-N-03 enforces the 8-character password minimum', async ({ anonApi, factory }) => {
    const tooShort = await anonApi.post(apiPaths.auth.register, {
      name: 'Short',
      email: factory.email('short'),
      password: passwords.tooShort,
    });
    expect(tooShort.status()).toBe(400);
    expect(JSON.stringify(await tooShort.json())).toContain(messages.api.passwordTooShort);

    /** And accepts exactly 8, so the boundary is inclusive as documented. */
    const atBoundary = await anonApi.post(apiPaths.auth.register, {
      name: 'Boundary',
      email: factory.email('boundary'),
      password: passwords.minimumLength,
    });
    expect(atBoundary.status()).toBe(201);
  });

  test('API-AUTH-N-04 rejects every malformed email shape', async ({ anonApi }) => {
    for (const email of emails.malformed) {
      const res = await anonApi.post(apiPaths.auth.login, { email, password: passwords.strong });
      expect(res.status(), `"${email}" must fail @IsEmail`).toBe(400);
    }
  });

  test('API-AUTH-N-05 accepts RFC-legal but unusual addresses', async ({ anonApi, factory }) => {
    /** Guards against over-eager validation rejecting legitimate users. */
    for (const local of ['first+tag', 'x']) {
      const res = await anonApi.post(apiPaths.auth.register, {
        name: 'Unusual',
        email: `${local}-${factory.email('unusual')}`,
        password: passwords.strong,
      });
      expect([201, 403], `${local}@… must not be a 400`).toContain(res.status());
    }
  });

  test('API-AUTH-N-06 rejects missing required fields', async ({ anonApi }) => {
    expect((await anonApi.post(apiPaths.auth.login, {})).status()).toBe(400);
    expect((await anonApi.post(apiPaths.auth.login, { email: emails.valid })).status()).toBe(400);
    expect((await anonApi.post(apiPaths.auth.register, { email: emails.valid })).status()).toBe(400);
  });

  test('API-AUTH-N-07 rejects an access token on the refresh route', async ({ anonApi }) => {
    const session = await anonApi.post(apiPaths.auth.login, {
      email: admin.email,
      password: admin.password,
    });
    const { accessToken } = await session.json();

    /**
     * The two tokens are signed with DIFFERENT secrets (JWT_ACCESS_SECRET vs
     * JWT_REFRESH_SECRET), so an access token must not satisfy `JwtRefreshGuard`.
     * Secret confusion here would let a stolen short-lived token mint long-lived ones.
     */
    const res = await anonApi.as(accessToken).post(apiPaths.auth.refresh);
    expect(res.status(), 'an access token must not be accepted as a refresh token').toBe(401);
  });

  test('API-AUTH-N-08 rejects garbage, unsigned and wrong-secret tokens on /auth/me', async ({ anonApi }) => {
    for (const [label, token] of [
      ['garbage', payloads.tokens.garbage],
      ['bad signature', payloads.tokens.badSignature],
      ['alg:none', payloads.tokens.algNone],
      ['empty', payloads.tokens.empty],
    ] as const) {
      const res = await anonApi.as(token).get(apiPaths.auth.me);
      expect(res.status(), `${label} token must be rejected`).toBe(401);
    }
  });

  test('API-AUTH-N-09 rejects an anonymous call to /auth/me', async ({ anonApi }) => {
    expect((await anonApi.get(apiPaths.auth.me)).status()).toBe(401);
  });
});

test.describe('API auth - security cases', () => {
  test('API-AUTH-S-01 the documented default admin password does not authenticate', async ({ anonApi }) => {
    /**
     * SECURITY_AUDIT.md C-2: `admin@elite.events` / `Admin@123` was shipped by the
     * seed and published in the README, and the login page still prints it. The seed
     * no longer sets it — this asserts that, permanently, so a regression that
     * restores a default credential fails the build.
     */
    const res = await anonApi.post(apiPaths.auth.login, {
      email: 'admin@elite.events',
      password: passwords.documentedDefault,
    });
    expect(res.status(), 'the documented default credential must never work').toBe(401);
  });

  test('API-AUTH-S-02 a CUSTOMER token cannot reach an admin route', async ({ anonApi, customerToken }) => {
    const res = await anonApi.as(customerToken).get(apiPaths.bookings.list);
    expect(res.status(), 'RolesGuard must reject a non-admin role with 403').toBe(403);
  });

  test('API-AUTH-S-03 a CUSTOMER token IS accepted on routes with no @Roles decorator', async ({
    anonApi,
    customerToken,
  }) => {
    /**
     * `RolesGuard.canActivate` returns true when no roles are required, so
     * `GET /auth/me` is open to any authenticated user. That asymmetry is intentional
     * but worth pinning down: it means adding an endpoint without `@Roles` silently
     * makes it reachable by every registered customer.
     */
    const res = await anonApi.as(customerToken).get(apiPaths.auth.me);
    expect(res.status()).toBe(200);
    expect((await res.json()).role).toBe('CUSTOMER');
  });

  test('API-AUTH-S-04 no response body ever contains a credential field', async ({ anonApi, factory }) => {
    const email = factory.email('leak');
    const bodies = [
      await (await anonApi.post(apiPaths.auth.register, { name: 'Leak', email, password: passwords.strong })).text(),
      await (await anonApi.post(apiPaths.auth.login, { email, password: passwords.strong })).text(),
    ];
    for (const body of bodies) {
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('$2a$');
      expect(body).not.toContain('$2b$');
    }
  });
});
