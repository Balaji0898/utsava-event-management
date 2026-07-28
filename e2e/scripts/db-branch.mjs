#!/usr/bin/env node
/**
 * Neon branch lifecycle CLI.
 *
 *   node scripts/db-branch.mjs create   # create (or adopt) this run's branch
 *   node scripts/db-branch.mjs uri      # print its connection string
 *   node scripts/db-branch.mjs delete   # delete it
 *   node scripts/db-branch.mjs gc       # reap orphaned e2e/* branches
 *
 * `create` and `delete` are idempotent so a retried CI attempt is safe.
 */
/**
 * `quiet: true` because dotenv v17 prints a promotional banner to STDOUT on load. This script's
 * stdout is consumed by callers (`db-branch.mjs uri` is read into a shell variable), so the
 * banner would corrupt it.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ quiet: true });
import { appendFile } from 'node:fs/promises';
import { createBranch, connectionUri, findBranch, deleteBranch, gcBranches } from './lib/neon.mjs';
import { runIdentity } from './lib/naming.mjs';

const [cmd] = process.argv.slice(2);
const { branchName } = runIdentity();

/** Emit to stdout and, under Actions, to $GITHUB_OUTPUT. */
async function emit(key, value) {
  console.log(value);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

try {
  switch (cmd) {
    case 'create': {
      const branch = (await findBranch(branchName)) ?? (await createBranch(branchName));
      await emit('branch_id', branch.id);
      await emit('branch_name', branch.name);
      break;
    }

    case 'uri': {
      const branch = await findBranch(branchName);
      if (!branch) throw new Error(`Branch ${branchName} not found — run \`create\` first.`);
      /**
       * Deliberately NOT written to $GITHUB_OUTPUT: job outputs are unmasked and
       * would print the database credential into the run log. Each job re-derives
       * the URI from the branch NAME using NEON_API_KEY, which IS masked.
       */
      console.log(await connectionUri(branch.id));
      break;
    }

    case 'delete': {
      const branch = await findBranch(branchName);
      if (branch) await deleteBranch(branch.id);
      console.log(`Deleted ${branchName}`);
      break;
    }

    case 'gc': {
      const reaped = await gcBranches({ maxAgeHours: Number(process.env.E2E_BRANCH_TTL_HOURS ?? 6) });
      console.log(reaped.length ? reaped.join('\n') : 'No stale branches.');
      break;
    }

    default:
      throw new Error('usage: db-branch.mjs <create|uri|delete|gc>');
  }
} catch (err) {
  console.error(`::error::${err.message}`);
  process.exit(1);
}
