import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Rotate an existing admin's password.
 *
 *   NEW_ADMIN_PASSWORD='…' npm run admin:rotate
 *   SEED_ADMIN_EMAIL=you@example.com NEW_ADMIN_PASSWORD='…' npm run admin:rotate
 *
 * Why this exists as a separate script rather than being folded into the seed:
 *
 * `prisma/seed.ts` upserts the admin with `update: {}`, so `passwordHash` is only ever written on
 * INSERT. That is the right default — re-running a seed must not silently rotate a live credential
 * — but it means every environment seeded under the previously-committed code still holds the
 * `Admin@123` hash that was published in the README, and **deploying the seed fix does not change
 * it**. This is the tool that does.
 *
 * Run it once per environment (Render → your service → Shell) as part of the deploy, then delete
 * the value from your shell history.
 *
 * Safety properties, all deliberate:
 *   - it UPDATES only. If no admin with that email exists it exits non-zero rather than creating
 *     one, so a typo in SEED_ADMIN_EMAIL can never mint a second admin account;
 *   - it refuses a password under 12 characters, and refuses the known-published `Admin@123`;
 *   - it never prints the password, only the email and the outcome;
 *   - it uses the same `bcrypt.hash(pw, 10)` cost as `AuthService`, so the resulting hash is
 *     verifiable by the normal login path;
 *   - it clears `refreshToken`, so any session issued under the old password is revoked
 *     immediately rather than surviving for its 7-day TTL.
 */

const prisma = new PrismaClient();

/** The credential published in README.md / DEPLOYMENT.md on the public repo (audit C-2). */
const PUBLISHED_DEFAULT = 'Admin@123';
const MIN_LENGTH = 12;

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@elite.events';
  const password = process.env.NEW_ADMIN_PASSWORD?.trim();

  if (!password) {
    throw new Error(
      'NEW_ADMIN_PASSWORD is required.\n' +
        "  Usage:  NEW_ADMIN_PASSWORD='your-new-password' npm run admin:rotate\n" +
        '  Optionally set SEED_ADMIN_EMAIL to target a different admin.',
    );
  }
  /**
   * Checked BEFORE the length rule on purpose. `Admin@123` is 9 characters, so the length message
   * would otherwise be the only thing shown — and someone reaching for that value specifically
   * needs to be told it is public knowledge, not merely that it is short.
   */
  if (password === PUBLISHED_DEFAULT) {
    throw new Error(
      `Refusing to set "${PUBLISHED_DEFAULT}" — that credential was published in this repo's ` +
        "README and DEPLOYMENT docs on a public remote, so it is public knowledge. Pick something else.",
    );
  }
  if (password.length < MIN_LENGTH) {
    throw new Error(`NEW_ADMIN_PASSWORD must be at least ${MIN_LENGTH} characters (got ${password.length}).`);
  }

  const admin = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!admin) {
    /** Deliberately not an upsert — see the safety notes above. */
    throw new Error(
      `No user found with email "${email}", so there is nothing to rotate.\n` +
        '  This script never creates an account. Check SEED_ADMIN_EMAIL, or run `npm run seed`\n' +
        '  against an empty database to create the admin in the first place.',
    );
  }

  if (admin.role !== Role.ADMIN && admin.role !== Role.SUPER_ADMIN) {
    throw new Error(
      `"${email}" has role ${admin.role}, not an admin role. Refusing to act on a non-admin account.`,
    );
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      /** Revoke any live session so the old password cannot be refreshed into a new one. */
      refreshToken: null,
    },
  });

  console.log(`\n✅ Password rotated for ${admin.email} (${admin.role}).`);
  console.log('   Existing sessions were revoked — sign in again with the new password.');
  console.log('   Remember to clear NEW_ADMIN_PASSWORD from your shell history.\n');
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
