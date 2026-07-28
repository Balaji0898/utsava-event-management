#!/usr/bin/env node
/**
 * Migrate + seed a disposable database.
 *
 *   node scripts/prepare-db.mjs                 # uses E2E_DATABASE_URL / DATABASE_URL
 *   import { prepareDb } from './prepare-db.mjs'  # used by run-e2e.mjs
 *
 * A Neon branch is a copy of its parent, so it arrives holding whatever the
 * parent held. `migrate reset` is what makes the fixtures deterministic.
 */
/**
 * `quiet: true` because dotenv v17 prints a promotional banner to STDOUT on load. This script's
 * stdout is consumed by callers (`db-branch.mjs uri` is read into a shell variable), so the
 * banner would corrupt it.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true });
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDisposableDatabase } from './lib/guard.mjs';
import { run } from './lib/proc.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '../../backend');

export async function prepareDb(databaseUrl, { provisioned = false } = {}) {
  assertDisposableDatabase(databaseUrl, { provisioned });

  const adminPassword = process.env.E2E_ADMIN_PASSWORD?.trim();
  if (!adminPassword || adminPassword.length < 8) {
    throw new Error(
      'E2E_ADMIN_PASSWORD must be set and at least 8 characters.\n' +
        'backend/prisma/seed.ts falls back to a randomly generated password below that ' +
        'length and prints it only once, so the suite could never log in.',
    );
  }

  /**
   * A BARE env — never spread `process.env`.
   *
   * This is the enforcement half of the guard. Prisma's dotenv loader and
   * @nestjs/config both read `backend/.env`, which points at production; if that
   * file's DATABASE_URL reached this child, `migrate reset` would drop production.
   * Passing only these keys makes that impossible rather than merely unlikely.
   */
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    /**
     * On a freshly reset database this is a clean INSERT, so the seed's
     * `user.upsert({ update: {} })` quirk — which silently preserves an existing
     * admin's old password — cannot bite. The credential is deterministic.
     */
    SEED_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@utsava.test',
    SEED_ADMIN_PASSWORD: adminPassword,
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };

  await run('npx', ['prisma', 'generate'], { cwd: BACKEND, env, timeoutMs: 180_000 });

  /**
   * `"prisma": { "seed": "ts-node prisma/seed.ts" }` is configured in
   * backend/package.json, so `migrate reset` applies all migrations and then
   * auto-runs the seed in a single step. Generous timeout: the seed issues ~60
   * unbatched `create` calls, each a TLS round-trip to Neon.
   */
  await run('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-generate'], {
    cwd: BACKEND,
    env,
    timeoutMs: 300_000,
  });

  console.log('✓ Database migrated and seeded.');
}

// Direct invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'prepare-db.mjs')) {
  const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  prepareDb(url).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
