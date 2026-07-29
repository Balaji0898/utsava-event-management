/**
 * Constants read straight out of the application source.
 *
 * The frontend and backend are separate deployables with no shared package, so a
 * few values have to be declared twice and kept in step by hand. Nothing at
 * runtime couples them, which means a drift is invisible until someone notices
 * the API disagreeing with the site — exactly the class of bug a comment cannot
 * prevent. Reading both declarations here lets a spec assert they still agree.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Repo root: this file lives at `e2e/src/config/`. The E2E job checks out the
 * whole repository and boots the backend and frontend inside the runner, so the
 * sibling `frontend/` and `backend/` trees are always on disk.
 */
const ROOT = path.resolve(__dirname, '../../..');

/**
 * Reads `export const <name> = <number>;` out of a TypeScript file.
 *
 * Parsing the text rather than importing it is deliberate. `site.ts` belongs to a
 * Next app (`@/` path aliases, ESM) and `vendors.service.ts` pulls in Nest and
 * the Prisma client; importing either from this CommonJS suite would drag a
 * whole framework in to read one integer.
 */
function readNumericConstant(relPath: string, name: string): number {
  const file = path.resolve(ROOT, relPath);

  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read ${relPath} (resolved to ${file}) — has the file moved?`);
  }

  const match = new RegExp(`export const ${name}\\s*(?::[^=]+)?=\\s*(\\d+(?:\\.\\d+)?)\\s*;`).exec(source);
  if (!match) {
    throw new Error(
      `No \`export const ${name} = <number>;\` found in ${relPath}. ` +
        'If it was renamed, moved, or became a computed expression, update e2e/src/config/source-constants.ts.',
    );
  }

  return Number(match[1]);
}

/**
 * The "near me" search radius, declared once per deployable:
 *  - `NEARBY_RADIUS_KM` drives the homepage section, the hero search, and the
 *    `/vendors` default, and is interpolated into the localized copy;
 *  - `DEFAULT_NEARBY_RADIUS_KM` is what the API applies when a caller supplies
 *    coordinates but omits `radius`.
 *
 * They must be the same number — see API-VEND-R-01.
 */
export const nearbyRadiusKm = {
  frontend: (): number =>
    readNumericConstant('frontend/src/shared/config/site.ts', 'NEARBY_RADIUS_KM'),
  backend: (): number =>
    readNumericConstant('backend/src/vendors/vendors.service.ts', 'DEFAULT_NEARBY_RADIUS_KM'),
} as const;
