import { type APIRequestContext, type APIResponse, request as playwrightRequest } from '@playwright/test';
import { admin, run, urls } from '@config/env';
import { apiPaths } from '@config/urls';

/**
 * A thin, typed client over Playwright's APIRequestContext for the Nest API.
 *
 * Three things it does that raw `request` does not:
 *
 *  1. **Per-worker rate-limit buckets.** `backend/src/main.ts:17` sets
 *     `app.set('trust proxy', 1)`, so Express resolves `req.ips[0]` from a
 *     client-supplied `X-Forwarded-For` and @nestjs/throttler keys on exactly
 *     that. Sending a per-worker value gives every worker its own bucket, which
 *     is what lets the suite run in parallel despite login 10/min, register
 *     5/min, bookings 8/min and testimonial-submit 5/min limits. Without it,
 *     four workers share one bucket and the suite 429s en masse.
 *
 *  2. **A loud 429.** An unexpected 429 is the single most confusing failure this
 *     suite can produce, so it gets an explanatory error rather than a bare
 *     status assertion somewhere downstream.
 *
 *  3. **Token plumbing** for the auth lifecycle and RBAC specs, including the
 *     access/refresh distinction — `POST /auth/refresh` expects the REFRESH token
 *     as its Bearer, which is unusual and easy to get wrong.
 */

export type Tokens = { accessToken: string; refreshToken: string };
export type AuthUser = { id: string; name: string; email: string; role: string; status: string };
export type LoginResult = Tokens & { user: AuthUser };

export class ApiClient {
  /**
   * @param request  a Playwright APIRequestContext
   * @param workerIndex used to derive this worker's throttler bucket
   * @param token   bearer token applied to every request unless overridden
   */
  constructor(
    private readonly request: APIRequestContext,
    private readonly workerIndex = 0,
    private token: string | null = null,
    /**
     * Per-instance so `withoutIpPartition()` actually takes effect. Reading the
     * module-level `run.ipPartition` inside `headers()` would ignore the clone.
     */
    private readonly ipPartition: boolean = run.ipPartition,
  ) {}

  // ------------------------------------------------------------------ plumbing

  /**
   * A private /8 address unique to this worker. Deliberately RFC1918 so it can
   * never be mistaken for a real client, and stable across a worker's lifetime so
   * the bucket is consistent within a spec file.
   */
  get forwardedFor(): string {
    return `10.42.${this.workerIndex % 254}.1`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json', ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    /** Opt-out exists so the rate-limit specs can share one bucket on purpose. */
    if (this.ipPartition) h['X-Forwarded-For'] = this.forwardedFor;
    return h;
  }

  setToken(token: string | null): this {
    this.token = token;
    return this;
  }

  /** A clone with a different token — for RBAC sweeps that need several identities. */
  as(token: string | null): ApiClient {
    return new ApiClient(this.request, this.workerIndex, token, this.ipPartition);
  }

  /**
   * A clone that never sends X-Forwarded-For, so it shares the runner's single
   * real-IP bucket. The throttling specs need this to observe a genuine 429.
   */
  withoutIpPartition(): ApiClient {
    return new ApiClient(this.request, this.workerIndex, this.token, false);
  }

  private url(path: string): string {
    return `${urls.api}/api${path.startsWith('/') ? path : `/${path}`}`;
  }

  private assertNotThrottled(res: APIResponse, method: string, path: string): void {
    if (res.status() !== 429) return;
    /**
     * A client built by `withoutIpPartition()` is deliberately trying to hit the
     * limit — a 429 there is the assertion, not a failure.
     */
    if (!this.ipPartition) return;
    throw new Error(
      `Unexpected 429 on ${method} ${path}.\n` +
        `This worker's throttler bucket (X-Forwarded-For: ${this.forwardedFor || 'not sent'}) is exhausted.\n` +
        'Likely causes:\n' +
        '  - `app.set("trust proxy", 1)` was removed from backend/src/main.ts, collapsing every\n' +
        '    worker into a single bucket (see src/fixtures/api-client.ts for why that matters);\n' +
        '  - E2E_IP_PARTITION=0 leaked out of the rate-limit specs;\n' +
        '  - a spec is looping over a throttled route without withoutIpPartition().',
    );
  }

  // --------------------------------------------------------------- raw verbs

  async get(path: string, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    const res = await this.request.get(this.url(path), { headers: this.headers(opts.headers) });
    this.assertNotThrottled(res, 'GET', path);
    return res;
  }

  async post(path: string, data?: unknown, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    const res = await this.request.post(this.url(path), { headers: this.headers(opts.headers), data: data ?? {} });
    this.assertNotThrottled(res, 'POST', path);
    return res;
  }

  async patch(path: string, data?: unknown, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    const res = await this.request.patch(this.url(path), { headers: this.headers(opts.headers), data: data ?? {} });
    this.assertNotThrottled(res, 'PATCH', path);
    return res;
  }

  async put(path: string, data?: unknown, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    const res = await this.request.put(this.url(path), { headers: this.headers(opts.headers), data: data ?? {} });
    this.assertNotThrottled(res, 'PUT', path);
    return res;
  }

  async delete(path: string, opts: { headers?: Record<string, string> } = {}): Promise<APIResponse> {
    const res = await this.request.delete(this.url(path), { headers: this.headers(opts.headers) });
    this.assertNotThrottled(res, 'DELETE', path);
    return res;
  }

  /**
   * Multipart POST — the only shape `POST /uploads` accepts.
   *
   * Kept on the client so the upload specs do not have to reach for the raw request
   * context and re-derive the bearer token by hand. `Content-Type` is deliberately NOT
   * set: Playwright generates the multipart boundary itself.
   */
  async postMultipart(
    path: string,
    multipart: Record<string, string | number | boolean | { name: string; mimeType: string; buffer: Buffer }>,
  ): Promise<APIResponse> {
    const res = await this.request.post(this.url(path), { headers: this.headers(), multipart });
    this.assertNotThrottled(res, 'POST', path);
    return res;
  }

  /** Absolute URL for a path the server returned, which may be relative to the API. */
  absoluteUrl(pathOrUrl: string): string {
    return pathOrUrl.startsWith('http') ? pathOrUrl : `${urls.api}${pathOrUrl}`;
  }

  /** Fetch an arbitrary absolute URL with this client's context — for served uploads. */
  async fetchAbsolute(pathOrUrl: string): Promise<APIResponse> {
    return this.request.get(this.absoluteUrl(pathOrUrl));
  }

  /**
   * Escape hatch for requests this client cannot express — currently only the CORS
   * preflight, which needs a bare OPTIONS with no auth and no forwarded-IP header.
   */
  async raw(url: string, init: Parameters<APIRequestContext['fetch']>[1]): Promise<APIResponse> {
    return this.request.fetch(url, init);
  }

  /** Dispatch by method name — powers the data-driven RBAC sweep. */
  async call(method: string, path: string, data?: unknown): Promise<APIResponse> {
    switch (method.toUpperCase()) {
      case 'GET':
        return this.get(path);
      case 'POST':
        return this.post(path, data);
      case 'PATCH':
        return this.patch(path, data);
      case 'PUT':
        return this.put(path, data);
      case 'DELETE':
        return this.delete(path);
      default:
        throw new Error(`Unsupported method ${method}`);
    }
  }

  /** GET and parse, throwing with the body on a non-2xx so failures are readable. */
  async json<T = unknown>(path: string): Promise<T> {
    const res = await this.get(path);
    if (!res.ok()) throw new Error(`GET ${path} → ${res.status()} ${await res.text()}`);
    return (await res.json()) as T;
  }

  // ------------------------------------------------------------------- auth

  async login(email = admin.email, password = admin.password): Promise<LoginResult> {
    const res = await this.post(apiPaths.auth.login, { email, password });
    if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
    const body = (await res.json()) as LoginResult;
    this.setToken(body.accessToken);
    return body;
  }

  /**
   * Register a throwaway CUSTOMER.
   *
   * Used by the RBAC sweep to prove that a non-admin token yields 403 rather than
   * 200 — the only way to exercise `RolesGuard`'s negative branch, since the app
   * has no customer-facing UI at all. Note `POST /auth/register` is throttled to
   * 5/min, so a spec must create these sparingly (one per worker, cached).
   */
  async registerCustomer(email: string, password: string, name = 'E2E Customer'): Promise<LoginResult> {
    const res = await this.post(apiPaths.auth.register, { name, email, password });
    if (!res.ok()) throw new Error(`Register failed for ${email}: ${res.status()} ${await res.text()}`);
    const body = (await res.json()) as LoginResult;
    return body;
  }

  /**
   * `POST /auth/refresh` is guarded by `JwtRefreshGuard` and expects the REFRESH
   * token as its Bearer — not the access token. Getting that backwards is the
   * classic mistake here, so it lives in one method.
   */
  async refresh(refreshToken: string): Promise<Tokens> {
    const res = await this.as(refreshToken).post(apiPaths.auth.refresh);
    if (!res.ok()) throw new Error(`Refresh failed: ${res.status()} ${await res.text()}`);
    return (await res.json()) as Tokens;
  }

  async me(): Promise<AuthUser> {
    return this.json<AuthUser>(apiPaths.auth.me);
  }
}

/**
 * Build a standalone client outside a test — used by `global.teardown.ts`, which
 * has no `request` fixture of its own to borrow.
 */
export async function createStandaloneApiClient(token?: string): Promise<{ api: ApiClient; dispose: () => Promise<void> }> {
  const ctx = await playwrightRequest.newContext({ baseURL: urls.api });
  const api = new ApiClient(ctx, 0, token ?? null);
  return { api, dispose: () => ctx.dispose() };
}
