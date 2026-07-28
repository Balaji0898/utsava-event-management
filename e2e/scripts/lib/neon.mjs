/**
 * Neon REST API v2 client — plain `fetch`, zero dependencies.
 *
 * Chosen over `neondatabase/create-branch-action` (GitHub-Actions-only, would
 * force two provisioning implementations) and over `neonctl` (not installed
 * locally; `npx neonctl` pays a 20-40s cold install per invocation). Four
 * endpoints via fetch behaves identically on macOS and ubuntu-latest, and lets
 * us implement branch GC — which is not optional, because Neon's free plan caps
 * branches per project and one leak per cancelled run bricks it within days.
 *
 * Docs: https://api-docs.neon.tech/reference/getting-started-with-neon-api
 */

const API = 'https://console.neon.tech/api/v2';

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}. See e2e/.env.example.`);
  return v;
}

async function neon(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv('NEON_API_KEY')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`Neon ${init.method ?? 'GET'} ${pathname} → ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

const projectId = () => requireEnv('NEON_PROJECT_ID');

/** True when both Neon credentials are present, so branch mode is viable. */
export function hasNeonCredentials() {
  return !!(process.env.NEON_API_KEY?.trim() && process.env.NEON_PROJECT_ID?.trim());
}

/**
 * Create a branch off the parent (default: the project's primary branch) with a
 * read-write compute endpoint attached.
 */
export async function createBranch(name) {
  const body = {
    branch: {
      name,
      ...(process.env.NEON_PARENT_BRANCH_ID ? { parent_id: process.env.NEON_PARENT_BRANCH_ID } : {}),
    },
    endpoints: [{ type: 'read_write' }],
  };
  const out = await neon(`/projects/${projectId()}/branches`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: out.branch.id, name: out.branch.name };
}

/**
 * `pooled: false` on purpose — `prisma migrate` needs a direct connection, not
 * PgBouncer, or DDL in a transaction fails.
 */
export async function connectionUri(branchId, { pooled = false } = {}) {
  const q = new URLSearchParams({
    database_name: process.env.NEON_DATABASE_NAME ?? 'neondb',
    role_name: process.env.NEON_ROLE_NAME ?? 'neondb_owner',
    pooled: String(pooled),
  });
  const out = await neon(`/projects/${projectId()}/branches/${branchId}/connection_uri?${q}`);
  const uri = out.uri;
  return uri.includes('sslmode=') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}sslmode=require`;
}

export async function findBranch(name) {
  const { branches } = await neon(`/projects/${projectId()}/branches`);
  return branches.find((b) => b.name === name) ?? null;
}

/** Idempotent: a 404 means someone else already reaped it, which is success. */
export async function deleteBranch(branchId) {
  try {
    await neon(`/projects/${projectId()}/branches/${branchId}`, { method: 'DELETE' });
    return true;
  } catch (e) {
    if (/→ 404/.test(String(e))) return true;
    throw e;
  }
}

/**
 * Reap orphaned `e2e/*` branches older than `maxAgeHours`.
 *
 * CI's `if: always()` does NOT fire on every runner cancellation or timeout, so
 * this — not the cleanup step — is what actually keeps the branch quota clean
 * over time. Never touches the primary branch, and never touches a branch whose
 * name lacks the prefix.
 */
export async function gcBranches({ maxAgeHours = 6, prefix = 'e2e/' } = {}) {
  const { branches } = await neon(`/projects/${projectId()}/branches`);
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  const stale = branches.filter(
    (b) => b.name.startsWith(prefix) && !b.primary && !b.default && Date.parse(b.created_at) < cutoff,
  );
  for (const b of stale) {
    console.log(`::warning::Reaping stale Neon branch ${b.name} (${b.id})`);
    await deleteBranch(b.id);
  }
  return stale.map((b) => b.name);
}
