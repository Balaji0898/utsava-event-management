import { spawn } from 'node:child_process';

/**
 * Run a command to completion, rejecting on a non-zero exit.
 *
 * `env` is passed through VERBATIM and is never merged with `process.env` by this
 * helper. That is deliberate: `backend/.env` is picked up by Prisma's dotenv
 * loader and by @nestjs/config, and it points at production. Callers build a
 * bare env containing only what the child legitimately needs, which is what
 * actually enforces database isolation.
 */
export function run(cmd, args, { cwd, env, timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const label = `${cmd} ${args.join(' ')}`;
    console.log(`\n$ (${cwd ?? process.cwd()}) ${label}`);
    const child = spawn(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn "${label}": ${err.message}`));
    });
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolve(undefined);
      reject(new Error(`"${label}" exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
    });
  });
}

/**
 * Poll an HTTP endpoint until it answers with a non-5xx status.
 *
 * This is load-bearing, not belt-and-braces: `frontend/src/shared/lib/api.ts`
 * `serverApi()` swallows every error and returns null, so a page rendered
 * against a dead backend shows "No vendors found." — an empty state that would
 * pass most assertions. A hard health gate is what stops a broken stack from
 * masquerading as a green run.
 */
export async function waitForHttp(url, { timeoutMs = 120_000, intervalMs = 1_000, expect = 'ok' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      if (expect === 'ok' ? res.status < 500 : res.status === expect) {
        console.log(`✓ ${url} → ${res.status}`);
        return res.status;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Health check failed for ${url} after ${timeoutMs}ms (last: ${lastError})`);
}

/**
 * SIGTERM a detached child's whole process group, escalating to SIGKILL.
 * `npm run start:prod` spawns node as a grandchild, so killing the npm pid alone
 * leaves the server holding port 4000 and the next run fails to bind.
 */
export function killTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      /* already dead */
    }
  }
}
