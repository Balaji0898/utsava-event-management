#!/usr/bin/env node
/**
 * Boots the ephemeral full stack: NestJS API then Next.js site, each health-gated.
 *
 * Why an orchestrator rather than Playwright's `webServer`:
 *  - Playwright starts `webServer` BEFORE globalSetup, but the database does not
 *    exist until the Neon branch is created and seeded, and `PrismaService`
 *    connects at module init — a webServer-booted backend would come up pointed
 *    at nothing.
 *  - `frontend/src/shared/lib/api.ts` reads NEXT_PUBLIC_API_URL at module scope,
 *    which Next inlines at BUILD time. So `next build` (2-4 min with three,
 *    @react-three, framer-motion, tiptap) must precede `next start`, and that
 *    does not belong inside a webServer timeout.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run, waitForHttp, killTree } from './lib/proc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');

const secret = () => crypto.randomBytes(48).toString('base64url');

/**
 * @param {{ databaseUrl: string, apiUrl: string, baseUrl: string, build?: boolean }} opts
 * @returns {Promise<{ stop: () => Promise<void> }>}
 */
export async function startStack({ databaseUrl, apiUrl, baseUrl, build = true, revalidateSecret }) {
  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];

  const stop = async () => {
    for (const child of [...children].reverse()) killTree(child, 'SIGTERM');
    // Give them a beat to release the ports, then make sure.
    await new Promise((r) => setTimeout(r, 2_000));
    for (const child of children) killTree(child, 'SIGKILL');
  };

  const apiPort = new URL(apiUrl).port || '4000';
  const sitePort = new URL(baseUrl).port || '3000';

  // ------------------------------------------------------------------ backend
  const backendEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: databaseUrl,
    /**
     * Real randoms, not placeholders: `backend/src/common/env.util.ts`
     * `requireSecret()` throws on boot for blank values AND for a blocklist of
     * seven placeholder strings ('change_me_access_secret' and friends). That
     * fail-closed behaviour is finding C-1's fix and we must not defeat it.
     */
    JWT_ACCESS_SECRET: secret(),
    JWT_REFRESH_SECRET: secret(),
    JWT_ACCESS_TTL: process.env.E2E_JWT_ACCESS_TTL ?? '900s',
    JWT_REFRESH_TTL: '7d',
    PORT: apiPort,
    APP_URL: apiUrl,
    CORS_ORIGIN: baseUrl,
    /**
     * 'test', NOT 'production'. `main.ts` gates Swagger on
     * `NODE_ENV !== 'production'`, and we want `/docs-json` for the OpenAPI
     * contract spec plus the same relaxed CSP the developers actually see.
     * Production-hardening assertions live behind an env-gated test.skip.
     */
    NODE_ENV: 'test',
    // Left blank so uploads use the local-disk provider; Cloudinary is
    // intentionally unconfigured for tests.
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
  };

  if (build) await run('npm', ['run', 'build'], { cwd: BACKEND, env: backendEnv, timeoutMs: 300_000 });

  console.log('\n▶ starting backend…');
  children.push(
    spawn('npm', ['run', 'start:prod'], {
      cwd: BACKEND,
      env: backendEnv,
      detached: true,
      stdio: 'inherit',
    }),
  );
  // Same endpoint Render and Railway health-check.
  await waitForHttp(`${apiUrl}/api/departments`, { timeoutMs: 120_000 });

  // ----------------------------------------------------------------- frontend
  const frontendEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
    /** Inlined by `next build` — must be present at build time, not just runtime. */
    NEXT_PUBLIC_API_URL: apiUrl,
    /**
     * A REAL secret, generated per run — not left unset.
     *
     * `next start` sets NODE_ENV=production, and `app/api/revalidate/route.ts` now fails CLOSED
     * there: without a secret it returns 503 rather than allowing an unauthenticated cache purge.
     * So the suite must hold one, and `BasePage.revalidate()` sends it as `?secret=`.
     *
     * This is strictly better than the previous arrangement, which relied on the route falling
     * open: the suite now exercises the same authenticated path production uses, so a regression in
     * that path fails a test instead of hiding behind a dev-only affordance.
     */
    REVALIDATE_SECRET: revalidateSecret,
    PORT: sitePort,
    NEXT_TELEMETRY_DISABLED: '1',
  };

  if (build) await run('npm', ['run', 'build'], { cwd: FRONTEND, env: frontendEnv, timeoutMs: 900_000 });

  console.log('\n▶ starting frontend…');
  children.push(
    spawn('npm', ['run', 'start'], {
      cwd: FRONTEND,
      env: frontendEnv,
      detached: true,
      stdio: 'inherit',
    }),
  );
  await waitForHttp(baseUrl, { timeoutMs: 180_000 });

  /**
   * Explicit guard against the exact failure that broke the running dev stack:
   * a stale `next dev` webpack chunk made every /vendors/[slug] return HTTP 500
   * with "Cannot find module './vendor-chunks/framer-motion.js'". Under
   * `next start` that cannot happen — but assert it here so a bad build fails
   * the boot rather than 27 vendor-detail specs.
   */
  await waitForHttp(`${baseUrl}/vendors`, { timeoutMs: 60_000 });

  console.log('\n✓ stack up:', { api: apiUrl, site: baseUrl });
  return { stop };
}
