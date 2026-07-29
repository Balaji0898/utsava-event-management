#!/usr/bin/env node
/**
 * The orchestrator. One code path, locally and in CI:
 *
 *   Neon branch → migrate reset + seed → build & boot stack → playwright test
 *                                                          → stop stack
 *                                                          → delete branch
 *
 * Any argument is forwarded to `playwright test`, so:
 *   npm run e2e -- --project=api --grep @smoke
 *
 * Cleanup runs from a single `cleanup()` wired to normal exit, every fatal
 * signal, and uncaught exceptions — because a leaked Neon branch consumes the
 * free plan's per-project quota.
 */
/**
 * `quiet: true` because dotenv v17 prints a promotional banner to STDOUT on load. This script's
 * stdout is consumed by callers (`db-branch.mjs uri` is read into a shell variable), so the
 * banner would corrupt it.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true });
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createBranch, connectionUri, findBranch, deleteBranch, gcBranches, hasNeonCredentials } from './lib/neon.mjs';
import { runIdentity } from './lib/naming.mjs';
import { prepareDb } from './prepare-db.mjs';
import { startStack } from './stack.mjs';

const { runId, branchName } = runIdentity();
const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';
const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

/** `neon` (branch-per-run) | `external` (bring your own Postgres). */
const mode = process.env.E2E_DB_MODE ?? (hasNeonCredentials() ? 'neon' : 'external');

/** Run against a stack someone else already prepared and booted. */
const skipDb = process.env.E2E_SKIP_DB === '1';

/**
 * Per-run secret for POST /api/revalidate.
 *
 * The frontend runs under NODE_ENV=production (`next start`), where that route now fails CLOSED —
 * so the suite must hold a real secret rather than relying on the route falling open. Passed to the
 * frontend as REVALIDATE_SECRET and to the tests as E2E_REVALIDATE_SECRET, so `BasePage.revalidate`
 * can authenticate its cache-busting calls the same way production does.
 */
const revalidateSecret = process.env.E2E_REVALIDATE_SECRET ?? crypto.randomBytes(24).toString('base64url');

let branchId = null;
let stack = null;
let cleaningUp = false;

async function cleanup(code = 0) {
  if (cleaningUp) return;
  cleaningUp = true;

  try {
    await stack?.stop();
  } catch (e) {
    console.error('stack stop failed:', e?.message ?? e);
  }

  if (branchId && process.env.E2E_KEEP_BRANCH !== '1') {
    try {
      await deleteBranch(branchId);
      console.log(`✓ Deleted Neon branch ${branchName}`);
    } catch (e) {
      console.error(`::error::Failed to delete Neon branch ${branchName}: ${e.message}`);
      // No scheduled reaper any more — CI runs against a service container, so GC is manual.
      console.error('::error::Run `npm run db:gc` to reap it.');
    }
  } else if (branchId) {
    console.log(`⚠ E2E_KEEP_BRANCH=1 — ${branchName} left alive. Reap it with \`npm run db:gc\`.`);
  }

  process.exit(code);
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => void cleanup(130));
process.on('uncaughtException', (e) => {
  console.error(e);
  void cleanup(1);
});
process.on('unhandledRejection', (e) => {
  console.error(e);
  void cleanup(1);
});

try {
  let databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

  if (skipDb) {
    console.log('E2E_SKIP_DB=1 — using the already-running stack; every @mutates spec will skip.');
  } else {
    if (mode === 'neon') {
      /* Reap first: keeps the quota clean even after a hard cancellation that
         never reached this script's cleanup. */
      await gcBranches({ maxAgeHours: Number(process.env.E2E_BRANCH_TTL_HOURS ?? 6) }).catch((e) =>
        console.warn(`::warning::branch GC skipped: ${e.message}`),
      );

      const branch = (await findBranch(branchName)) ?? (await createBranch(branchName));
      branchId = branch.id;
      databaseUrl = await connectionUri(branchId);
      console.log(`✓ Neon branch ${branchName} ready.`);
      await prepareDb(databaseUrl, { provisioned: true });
    } else {
      console.log('E2E_DB_MODE=external — using the supplied DATABASE_URL (the guard still applies).');
      await prepareDb(databaseUrl, { provisioned: false });
    }

    stack = await startStack({
      databaseUrl,
      apiUrl,
      baseUrl,
      build: process.env.E2E_SKIP_BUILD !== '1',
      revalidateSecret,
    });
  }

  const code = await new Promise((resolve) => {
    spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        E2E_RUN_ID: runId,
        E2E_BASE_URL: baseUrl,
        E2E_API_URL: apiUrl,
        E2E_EPHEMERAL_DB: skipDb ? '0' : '1',
        E2E_REVALIDATE_SECRET: revalidateSecret,
        ...(databaseUrl ? { E2E_DATABASE_URL: databaseUrl } : {}),
      },
    }).on('exit', (c) => resolve(c ?? 1));
  });

  await cleanup(code);
} catch (err) {
  console.error(`::error::${err.message}`);
  await cleanup(1);
}
