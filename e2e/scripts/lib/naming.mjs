import { execSync } from 'node:child_process';
import os from 'node:os';

/**
 * Run identity — deliberately NOT time-based.
 *
 * `Date.now()` would make every CI retry of the same attempt provision a brand
 * new Neon branch, orphaning the previous one. Neon's free plan caps branches per
 * project, so a handful of retried runs would brick the project. Keying on
 * (commit, run id, attempt) instead means a retried attempt reuses/replaces its
 * own branch, and one identity derives both the branch name and the test-data
 * prefix — so GC and cleanup can find each other's leftovers.
 */

function sha7() {
  const raw =
    process.env.GITHUB_SHA ??
    (() => {
      try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        return 'nogit00';
      }
    })();
  return raw.trim().slice(0, 7) || 'nogit00';
}

/** @returns {{ runId: string, branchName: string }} */
export function runIdentity() {
  if (process.env.GITHUB_RUN_ID) {
    const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
    const id = `${process.env.GITHUB_RUN_ID}-${attempt}`;
    return { runId: id, branchName: `e2e/${sha7()}-${id}` };
  }
  const who = (os.userInfo().username || 'dev').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const id = `local-${who}-${sha7()}`;
  return { runId: id, branchName: `e2e/${id}` };
}
