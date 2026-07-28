# Utsava E2E — Test-Case Matrix

The authoritative index of what this suite covers. Each row maps a case ID to the spec that
implements it, so a reviewer can go from "is X tested?" to the code in one hop.

**ID format:** `<AREA>-<TYPE>-<nn>`, where `TYPE` is
`P` positive · `N` negative · `E` edge · `S` security · `A` accessibility · `V` visual.
`API-<MODULE>-<TYPE>-<nn>` for API contract cases, `SEC-<nn>` for security regressions.

Every case ID appears verbatim in its test title, so `--grep BOOK-N-01` runs exactly one case and
`scripts/generate-e2e-report.js` can key its report rows off the ID.

**510 tests across 25 files.** Many rows below are data-driven and expand into several tests at
runtime — the RBAC sweep alone is 4 assertions × 34 protected routes.

---

## Coverage by area

| Area | Spec file | Cases | Notes |
|---|---|---:|---|
| `API-AUTH` | `tests/api/auth/auth.api.spec.ts` | 20 | Login, register, refresh rotation, logout, DPDP erasure |
| `API-RBAC` | `tests/api/rbac.api.spec.ts` | 4×34 + 8 | Data-driven over the whole `@Roles` surface |
| `API-VAL` | `tests/api/validation.api.spec.ts` | 40 | DTO sweep, whitelist stripping, 404s, uniqueness, cascades |
| `API-VEND` | `tests/api/vendors/vendors.api.spec.ts` | 35 | 14 query params, coercion edges, slug derivation, SQL safety |
| `API-UPL` | `tests/api/uploads/uploads.api.spec.ts` | 12 | MIME allowlist, 8 MB cap, traversal, served-file headers |
| `SEC` | `tests/security/*.security.spec.ts` | 29 | The audit, encoded permanently — see the policy below |
| `HOME` `NAV` `RESP` | `tests/e2e/public/home-and-nav.spec.ts` | 24 | Nine sections, hero search, Lenis anchors, routing, mobile |
| `VENDORS` | `tests/e2e/public/vendors.spec.ts` | 18 | Listing, filters, pagination, proximity fallback, injection |
| `VDETAIL` | `tests/e2e/public/vendor-detail.spec.ts` | 20 | Detail page, packages, gallery lightbox, 404 |
| `BOOK` | `tests/e2e/public/book.validation.spec.ts` | 20 | Validation, **the B1/B2 regression guards**, submission |
| `LOGIN` | `tests/e2e/auth/login.spec.ts` | 15 | Auth, role redirect, credential hygiene, throttling |
| `SESSION` | `tests/e2e/auth/session.spec.ts` | 12 | Client-side gate, silent refresh, forced logout, two tabs |
| `ADMDASH` `ADMDEPT` `ADMVEND` `ADMPKG` `ADMBOOK` `ADMCMS` `UPLOAD` | `tests/e2e/admin/admin-crud.spec.ts` | 36 | Every admin CRUD surface |
| `JOURNEY` | `tests/e2e/journeys/*.spec.ts` | 11 | Cross-actor end-to-end paths |
| `A11Y` | `tests/a11y/axe.*.a11y.spec.ts` | 30 | axe per route, keyboard, focus, motion, the register |
| `VIS` | `tests/visual/public.visual.spec.ts` | 10 | Component-scoped baselines, Linux only |

---

## The P0 smoke gate

Tagged `@smoke`, run on every push. ~40 cases, ~5 minutes. Chosen so that each one would have
caught a real failure this project has actually had, rather than by even coverage.

| Case | What it guards |
|---|---|
| `SEC-00-a`…`SEC-00-d` | **A stale backend build.** The observed incident: `dist/main` predated helmet, the throttler and the `?all=true` gate, so three security controls were silently off. |
| `VDETAIL-P-01` | **A stale frontend build.** A dead `next dev` chunk made every vendor URL a 500 while `/vendors` stayed 200. |
| `BOOK-N-01`, `BOOK-N-06` | **Bugs B1 and B2** — the booking form cannot be submitted with only the required fields filled. |
| `LOGIN-S-03`, `LOGIN-S-04` | The demo credential is gone, and the documented default does not authenticate. |
| `SEC-06`, `TEST-S-01` | Unapproved content is not publicly readable. |
| `UPLOAD-S-01`, `UPLOAD-S-02` | SVG and oversize uploads are refused. |
| `JOURNEY-01`, `JOURNEY-03` | The two cross-actor paths the product exists to serve. |
| `SESSION-S-01`, `SESSION-N-01` | The admin gate holds, and a dead session force-logs-out. |
| `A11Y-A-01`, `A11Y-A-03`, `A11Y-A-10` | No new a11y violations; the booking form stays labelled; reduced motion is honoured. |
| `HOME-E-01` | The launch splash never blocks a click. |

Everything else runs per-PR, plus the full axe sweep and both visual themes nightly.

---

## Security regression policy

Every case asserts the **secure** expectation. A case whose finding is still present is wrapped in
`test.fail()` with a mandatory `known-vulnerability` annotation naming the audit ID and an owner.

- CI is green on day one, so the suite is adoptable.
- Fixing the bug makes Playwright report *"expected to fail but passed"*, which forces the
  annotation to be deleted in the same PR as the fix.
- The assertion body never changes when the fix lands — only the wrapper goes.
- `npm run report` collects the annotations into a register and **fails the build if the count
  rises** above `known-vulnerabilities.json`.

| ID | Finding | Status |
|---|---|---|
| `SEC-01`…`SEC-05` | H-2 — `passwordHash` / `refreshToken` leaking through `customer: true` | Asserted secure |
| `SEC-06`…`SEC-08` | `?all=true` exposing unapproved and INACTIVE content | Asserted secure |
| `SEC-09`…`SEC-11` | IDOR on booking detail | Asserted secure |
| `SEC-12` | Stack traces and Prisma internals in error bodies | Asserted secure |
| `SEC-13`…`SEC-16` | helmet and Next security headers | Asserted secure |
| `SEC-17` | **M-2 — no `script-src` CSP on the frontend** | `test.fail()` |
| `SEC-18`…`SEC-20` | CORS with `credentials: true` | Asserted secure |
| `SEC-21` | **M-3 — tokens in localStorage, readable by any script** | `test.fail()` |
| `SEC-XSS-*` | H-1 — the regex sanitizer, 12 distinct bypass classes | Asserted secure |
| `SEC-22`…`SEC-24` | Brute-force and spam throttling | Asserted secure |
| `SEC-25` | **Rate limits key on client-supplied `X-Forwarded-For`** | Annotated (infrastructure control) |
| `SEC-26`…`SEC-29` | The open `POST /api/revalidate` | `SEC-27` is `test.fail()` |
| `API-AUTH-S-01` | C-2 — the documented default admin credential | Asserted secure |
| `VDETAIL-A-01`, `A11Y-A-16` | `aria-modal` without a focus trap | `test.fail()` |

The twelve XSS payloads are distinct bypass classes, not variations: a regex allowlist typically
catches bare `<script>` and misses event handlers, SVG, split attributes, HTML entities,
`javascript:` URLs and mixed-case nesting. One payload would prove almost nothing.

---

## Bugs pinned by named tests

| ID | Bug | Test | Assertion direction |
|---|---|---|---|
| **B1** | `/book` unsubmittable unless Guest count **and** Budget are filled — silent no-op, no error markup on either field | `BOOK-N-01`…`N-05` | Asserts **current** behaviour; a fix turns it red |
| **B2** | Empty Event date → HTTP 400 (`@IsOptional` skips only `null`/`undefined`) | `BOOK-N-06`, `API-VAL-N-01` | Asserts current behaviour |
| **B3** | Booking status `<select>`: no focus style, no accessible name | `ADMBOOK-A-01` | Fixed; test guards it |
| **B4** | Five icon-only destructive buttons unnamed | `A11Y-A-13` | Fixed; test guards it |
| **B5** | Admin table scroll containers not keyboard-reachable | `A11Y-A-15` | Fixed; test guards it |
| **B6** | `(auth)` and `/admin` had no `<main>` landmark | `A11Y-A-04`, `A11Y-A-12` | Fixed; test guards it |
| **B8** | `h2 "Packages"` renders with zero packages | `VDETAIL-E-05` | Asserts current behaviour |
| **B10** | Stored `0` renders as an empty input | `ADMVEND-E-01` | Asserts current behaviour |

"Asserts current behaviour" is deliberate: the test documents the defect and turns red when it is
fixed, so the fix has to be acknowledged rather than landing silently against a test that was
written to accept it.

---

## Product gaps recorded rather than tested

Annotated with `type: 'note'` so they surface in the report instead of living in a commit message.

| Gap | Where noted |
|---|---|
| Hero search submits a `date` parameter that `/vendors` never reads | `HOME-E-02` |
| Revenue chart is a hard-coded array with no relation to data | `ADMDASH-E-02` |
| `/admin/bookings` has no pagination, filter, sort or search | `ADMBOOK-E-01` |
| No mobile admin navigation at all — the sidebar is `hidden md:flex` with no replacement | `RESP-E-01` |
| CMS tabs are not deep-linkable | `ADMCMS-E-01` |
| Vendor contact fields accept anything, with no validation | `ADMVEND-N-01` |
| Rejecting a review hard-deletes it, with no audit trail | `JOURNEY-02` |
| Deleting a department silently removes its vendors and packages | `ADMDEPT-E-01`, `API-VAL-P-01` |
| Booking status changes have no confirmation step | `ADMBOOK-P-02` |
| Past event dates are accepted — there is no minimum-date rule | `BOOK-E-03` |

---

## Not covered, and why

| Not covered | Reason |
|---|---|
| Registration / forgot-password / reset UI | No such pages exist. `POST /auth/register` is covered in `API-AUTH-P-03`. |
| Customer or vendor portal | No routes exist; `VENDOR`/`CUSTOMER` role coverage lives in the API and RBAC specs. |
| Profile edit / account deletion UI | Backend-only; `API-AUTH-P-06`, `API-AUTH-P-07`. |
| Cloudinary upload provider | Intentionally unconfigured for tests; the local-disk path is covered. |
| Email / SMS delivery | The app has no such integration. |
| Full-page and slider visual baselines | Nine streamed islands, animated counters and a 5-second autoplay — see `VIS-V-skip`. |
| `te` locale beyond one fallback spec | Backend strings are machine-translated by a live external API that rewrites the DOM after load. |
| Lighthouse / performance budgets | Meaningless while a WebGL `useFrame` loop runs on every page and reads go through a 300s cache. |
| Unit tests | Out of scope. The API contract project is the deliberate boundary — resist pushing unit concerns into E2E. |
