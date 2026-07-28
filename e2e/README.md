# Utsava E2E Suite

Playwright automation for the Utsava event-management platform: UI end-to-end, API contract,
security regression, accessibility and visual regression — in one runner, against an ephemeral
stack.

---

## ⚠️ Read this before running anything

`backend/.env` points at the **live production database**. This suite runs
`prisma migrate reset --force`, which **drops and recreates the schema**.

Every database-touching script therefore calls `assertDisposableDatabase()`
(`scripts/lib/guard.mjs`) first, and it **fails closed**: no positive proof that the target is
disposable, no run. The known production endpoint is on an absolute deny-list with **no
override**.

Verify the guard works before you trust anything else:

```bash
cd e2e
# Should REFUSE, loudly:
E2E_DATABASE_URL="$(grep '^DATABASE_URL=' ../backend/.env | cut -d= -f2-)" \
  node scripts/prepare-db.mjs
```

---

## Quick start

```bash
cd e2e
npm install
npm run install:browsers

cp .env.example .env      # then fill in NEON_API_KEY, NEON_PROJECT_ID, E2E_ADMIN_PASSWORD

npm run e2e               # the whole thing, end to end
npm run e2e -- --grep @smoke
```

`npm run e2e` is the only command that provisions a database. It:

1. reaps stale `e2e/*` Neon branches, then creates a fresh one for this run;
2. runs `prisma migrate reset --force` + seed against it, with a known admin password;
3. builds and boots the NestJS API and the Next.js site, health-gating both;
4. runs Playwright;
5. stops the stack and **deletes the branch**, even on failure or Ctrl-C.

---

## Why it is built this way

Four decisions explain most of the structure.

**A Neon branch per run, not a shared test database.** A branch is a copy-on-write fork, so it
costs seconds and gives byte-identical isolation. Branch names key on
`(commit, run id, attempt)` — never `Date.now()` — so a retried CI attempt reuses its own branch
instead of orphaning one. Neon's free plan caps branches per project, which is why
`e2e-branch-gc.yml` exists and is not optional.

**An orchestrator script boots the stack, not Playwright's `webServer`.** `webServer` starts
*before* `globalSetup`, but the database does not exist until the branch is created and seeded,
and `PrismaService` connects at module init. And `NEXT_PUBLIC_API_URL` is inlined by
`next build`, so a 2-4 minute build must precede `next start` — which does not belong inside a
`webServer` timeout. `scripts/run-e2e.mjs` is correct regardless of Playwright's internal
ordering, and is the same code path locally and in CI.

**Rate limits are dodged with a header, not with serialization.** `backend/src/main.ts` sets
`app.set('trust proxy', 1)`, so `@nestjs/throttler` keys on the client-supplied
`X-Forwarded-For`. Each worker sends its own value and gets its own bucket, so full parallelism
survives the login 10/min, register 5/min, bookings 8/min and testimonial 5/min limits. (This
also means the limiter is spoofable when the API is reachable directly — asserted deliberately
as `SEC-25`.)

**`reducedMotion` is the single biggest stability win.** `globals.css` zeroes every animation
under `prefers-reduced-motion`, and `useReducedMotion()` is honoured in the motion primitives,
`TiltCard`, `Magnetic`, the Best Events slider and the gallery. So Reveal/Stagger settle
instantly, click targets stop drifting under the cursor, and the slider stops auto-advancing.
It does **not** stop Lenis, the launch splash, the WebGL canvas or BrandLoader's interval —
those are handled by `src/fixtures/init-scripts.ts` and per-spec waits.

---

## Layout

```
e2e/
├── playwright.config.ts          projects: setup · api · security · chromium · a11y · visual · mobile
├── src/config/                   env · urls (route + RBAC tables) · testids · third-party hosts
├── src/data/                     test-data (exact app copy) · seed-data · a11y register · factory
├── src/fixtures/                 test.ts (the only import specs use) · api-client · network
│                                 init-scripts · dialogs · axe
├── src/pages/                    BasePage → SitePage/AdminPage → 14 page objects
├── src/components/               navbar · sidebar · pagination · uploaders · lightbox · editor …
├── tests/
│   ├── global.setup.ts           health gate + one real login → storageState
│   ├── global.teardown.ts        prefix sweep + discard the stored tokens
│   ├── api/                      auth · rbac (data-driven) · validation · vendors · uploads
│   ├── security/                 build-freshness · data-exposure · headers-cors · xss · rate-limit
│   ├── e2e/{public,auth,admin,journeys}/
│   ├── a11y/                     axe.public · axe.admin
│   └── visual/                   component-scoped baselines (linux only)
└── scripts/                      run-e2e · stack · prepare-db · db-branch · lib/{neon,guard,proc}
```

Specs import from **one place**:

```ts
import { test, expect, serial } from '@fixtures/test';
```

`expect` is re-exported there on purpose, so a spec never imports `@playwright/test` directly
and an accidental bare import is obvious in review.

---

## Commands

| Command | What it does |
|---|---|
| `npm run e2e` | Full run: provision → boot → test → teardown |
| `npm run e2e:smoke` | The `@smoke` gate only (~5 min) |
| `npm run e2e:nobuild` | Reuse the existing `next build` / `nest build` — fast local loop |
| `npm run e2e:keep` | Leave the Neon branch alive for post-mortem `psql` |
| `npm run test:api` | API contract project only, against an already-running stack |
| `npm run test:security` | Security regression project only |
| `npm run test:a11y` | axe scans only |
| `npm run test:visual` | Visual regression (renders but skips comparison off Linux) |
| `npm run test:admin:headed` | Watch the admin specs drive a real browser |
| `npm run typecheck` | `strict` + `noUnusedLocals` + `noUnusedParameters` — a real gate |
| `npm run report` | JSON → `test-results/e2e-summary.md` + the security ratchet |
| `npm run db:gc` | Reap orphaned `e2e/*` Neon branches |

To run against a stack you have already booted yourself:

```bash
E2E_SKIP_DB=1 npm test          # every @mutates spec skips — the DB may not be disposable
```

---

## Security debt: the `test.fail()` policy

Every security case asserts the **secure** expectation. A case whose finding is still present is
wrapped in `test.fail()` and carries a mandatory annotation:

```ts
test.info().annotations.push({
  type: 'known-vulnerability',
  description: 'M-2 (SECURITY_AUDIT.md) — no script-src CSP … Owner: frontend.',
});
test.fail();
```

Why this and not the alternatives:

- CI is **green on day one**, so the suite is adoptable.
- The moment the bug is fixed, Playwright reports *"expected to fail but passed"* — which forces
  the annotation to be deleted in the same PR as the fix.
- The assertion body always encodes the secure state, so **nothing is rewritten** when the fix
  lands. Only the wrapper goes.
- A plain failing test turns CI red forever and gets `--grep-invert`'d within a week. A
  `test.skip` produces no signal in either direction, which is the worst option for security
  debt.

`scripts/generate-e2e-report.js` collects the annotations into a machine-readable register and
**fails the build if the count rises** above the baseline in `known-vulnerabilities.json`. The
count may fall freely; lower the baseline in the same PR to lock the improvement in.

**One exception:** the build-freshness checks (`SEC-00-*`) are plain `test()`s, never
`test.fail()`. Their whole job is to detect a stale deploy — see below.

---

## `SEC-00`: why build freshness gets its own spec

While this suite was being written, the API on `:4000` was a `node dist/main` process started
*before* three shipped security controls were compiled in. Live probing showed no helmet
headers, no throttler headers, and `GET /cms/testimonials?all=true` returning unapproved content
to an anonymous caller — all of which `src/` handles correctly.

Every header and rate-limit spec would have failed for a purely environmental reason and been
muted as flaky within a week. So `tests/security/build-freshness.security.spec.ts` asserts the
controls are *present* first, with error messages that name the real cause. `scripts/stack.mjs`
guarantees a fresh `npm run build` before boot.

---

## Intentional skips

These are **not failures**. The app genuinely lacks these surfaces, and pretending otherwise
would mean writing tests that can never pass.

| Skipped | Reason |
|---|---|
| Registration / signup UI | No `/register` page. `POST /auth/register` exists and is covered in the API project. |
| Forgot password / reset | Not implemented anywhere. |
| Customer or vendor portal | No routes exist. `VENDOR`/`CUSTOMER` roles only redirect to `/`. Role coverage lives in the API and RBAC specs. |
| Profile edit / account deletion UI | Backend-only (`PATCH`/`DELETE /auth/me`); covered in `api/auth`. |
| Revenue chart **values** | `[40,65,45,80,55,90,70]` is hard-coded in `app/admin/page.tsx` with no relation to any data. |
| `/admin/bookings` pagination, filters, search | Not implemented — `GET /bookings` returns a flat array. |
| Mobile admin navigation | The sidebar is `hidden md:flex` with **no** replacement. Admin is desktop-only; `RESP-E-01` asserts that. |
| `/admin/cms` tab deep-linking | Tab state is component-local `useState`. |
| Branded 404 for an unknown vendor | No `not-found.tsx` exists anywhere, so the specs assert Next's default. |
| Visual comparison off Linux | Baselines are byte-sensitive to font rasterisation; committed for Linux only. |
| Full-page `/` and slider baselines | Nine streamed islands, animated counters and an autoplaying slider — see the note in `tests/visual/public.visual.spec.ts`. |
| Every `@mutates` spec under `E2E_SKIP_DB=1` | The target database may not be disposable. |

Two cases assert the **correct** behaviour and are marked expected-fail because a focus trap does
not exist yet: the gallery lightbox (`VDETAIL-A-01`) and the departments edit modal
(`A11Y-A-16`). Both declare `aria-modal="true"` without containing focus.

---

## Bugs this suite pins down

Found while writing it, each with a named regression test.

| ID | Bug | Test |
|---|---|---|
| **B1** | **`/book` cannot be submitted unless Guest count *and* Budget are filled.** RHF yields `''` for untouched number inputs; `''` is not `undefined` so `.optional()` doesn't short-circuit; `z.coerce.number()` makes it `0`; `.positive()` fails — and neither field renders error markup, so the click is a **silent no-op**. | `BOOK-N-01`…`N-05` |
| **B2** | An empty Event date passes zod but fails the backend's `@IsOptional() @IsDateString()` (class-validator skips only `null`/`undefined`) → HTTP 400. | `BOOK-N-06`, `API-VAL-N-01` |
| **B3** | The booking status `<select>` had `outline-none` with no replacement focus style and no accessible name. | `ADMBOOK-A-01` |
| **B4** | Five icon-only destructive buttons had no accessible name. | `A11Y-A-13` |
| **B5** | Admin table scroll containers had no `tabIndex`, so keyboard users could not scroll them. | `A11Y-A-15` |
| **B6** | `(auth)` and all of `/admin` had no `<main>` landmark. | `A11Y-A-04`, `A11Y-A-12` |
| **B8** | `/vendors/[slug]` renders an `h2 "Packages"` even with zero packages. | `VDETAIL-E-05` |
| **B10** | `VendorForm` renders a stored `0` as an empty input, so "free" and "not set" are indistinguishable. | `ADMVEND-E-01` |

B3–B6 were fixed by the Phase 3 hook pass; their tests now guard the fix. B1, B2, B8 and B10
assert the **current** behaviour, so a fix turns the test red and has to be acknowledged.

---

## Writing a new spec

1. Put it in the right area: `tests/e2e/{public,auth,admin,journeys}`, `tests/api`,
   `tests/security`, `tests/a11y` or `tests/visual`. The filename suffix picks the project.
2. `import { test, expect } from '@fixtures/test';` — never from `@playwright/test`.
3. **New locators go on the page object**, new copy goes in `src/data/test-data.ts`. Keep specs
   free of raw selectors and magic strings.
4. Title format: `<AREA>-<P|N|E|S|A|V>-<nn> <lowercase behavioural sentence>`. Add `@smoke` for
   the push gate, `@mobile` / `@cross-browser` for those projects.
5. Never assert an absolute count or total — use `expectContains` / `expectDoesNotContain`, or
   scope to a department the test created itself.
6. Call `serial()` if the file hits a throttled route or mutates a CMS singleton
   (`site-contact`, `home-stats`, `legal-*`) or a vendor's `featured` flag.
7. Run `npm run typecheck`, then `npm run test:report` and read
   `test-results/e2e-summary.md`.

### Parallel-safety rules

- `total` is global; other workers are writing concurrently.
- Scope list assertions with `?search=<prefix>` — the factory prefixes every record
  `E2E-{runId}-w{worker}-t{test}`.
- The three CMS singletons are one row each, last writer wins. Use
  `factory.snapshotAndRestore()`.
- `featured: true` fires `demoteOtherFeatured()`, silently un-featuring a **sibling** in the same
  department. `factory.createVendor()` creates its own department by default for exactly this
  reason — do not pass `ownDepartment: false` and then set `featured`.

---

## CI

| Workflow | Trigger | What it does |
|---|---|---|
| `e2e.yml` | push + PR to `main`, `workflow_dispatch` | Provision a branch → boot the stack per shard (×3) → run → merge reports → delete the branch |
| `e2e-branch-gc.yml` | every 6h | Reap orphaned `e2e/*` branches — `if: always()` does not fire on a hard cancel |
| `e2e-visual-baselines.yml` | manual | Regenerate Linux baselines and open a PR |

Secrets: `NEON_API_KEY`, `NEON_PROJECT_ID`, `E2E_ADMIN_PASSWORD`. Without them the workflow
emits a `::warning::` and skips, rather than failing red — matching the house style of the two
existing deploy workflows.

**`e2e.yml` is warn-only by default.** Set the `E2E_BLOCKING` repo variable to `'true'` once it
has been green for a few days.

> **Note:** `deploy-backend.yml` and `deploy-frontend.yml` currently fire on push to `main` *in
> parallel* with this workflow, so a red suite does not stop a deploy. Once this is green and
> blocking, add `needs: e2e` to both deploy jobs, or move to a PR-based flow with branch
> protection.
