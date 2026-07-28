import fs from 'node:fs';
import path from 'node:path';
import { test as teardown } from '@playwright/test';
import { admin, canMutateData, hasAdminCredentials, run } from '@config/env';
import { sweepByPrefix } from '@data/factory';
import { createStandaloneApiClient } from '@fixtures/api-client';

const ADMIN_STATE = path.resolve(__dirname, '../playwright/.auth/admin.json');

/**
 * The `teardown` project, attached to `setup`. Runs once after everything else.
 *
 * This is the THIRD layer of cleanup, not the first. The primary guarantees are
 * `DataFactory.cleanup()` per test and `scripts/run-e2e.mjs`'s `finally` (plus CI's
 * `if: always()`) for the Neon branch. This exists to catch what a hard-killed worker
 * orphaned, so it is written to be best-effort and to never fail the run.
 */

teardown('sweep orphaned records', async () => {
  if (!hasAdminCredentials() || !canMutateData()) {
    // eslint-disable-next-line no-console
    console.log('[teardown] skipping sweep — no admin credentials, or the database is not disposable.');
    return;
  }

  const prefix = `E2E-${run.id}`;
  const { api, dispose } = await createStandaloneApiClient();
  try {
    await api.login(admin.email, admin.password);
    const deleted = await sweepByPrefix(api, prefix);
    // eslint-disable-next-line no-console
    console.log(
      deleted
        ? `[teardown] swept ${deleted} orphaned record(s) matching "${prefix}" — a worker died mid-test.`
        : `[teardown] no orphaned records matching "${prefix}". Per-test cleanup did its job.`,
    );
  } catch (err) {
    /**
     * Never throw: a cleanup failure must not turn a green run red, and the Neon
     * branch is destroyed moments later anyway.
     */
    // eslint-disable-next-line no-console
    console.warn(`[teardown] sweep failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await dispose();
  }
});

teardown('discard the admin storage state', async () => {
  /** It holds a live access + refresh token pair; do not leave it on disk or in CI cache. */
  try {
    if (fs.existsSync(ADMIN_STATE)) fs.rmSync(ADMIN_STATE);
  } catch {
    /* best effort */
  }
});
