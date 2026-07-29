# Security & Data-Protection Audit — Elite Event Management Platform

**Date:** 2026-07-28
**Scope:** Full codebase — NestJS + Prisma backend, Next.js 14 frontend, infra config (`docker-compose.yml`, `render.yaml`), seed/migration scripts.
**Frameworks:** OWASP-style application security review + India's **Digital Personal Data Protection Act, 2023 (DPDP Act)** as the primary privacy framework, with GDPR cross-referenced.
**Method:** Source code was read and traced (no dynamic scanning). `npm audit` run against both packages. Every finding cites `file:line`.

> ⚠️ This report describes real, exploitable weaknesses in a system that appears to be connected to a live production database. Treat it as confidential. Address the **Critical** items before the next deployment.

---

## 1. Executive Summary

The application has a **solid authorization backbone** — global JWT + role guards are correctly wired, every mutating endpoint is role-gated, there is no SQL injection surface, passwords are properly bcrypt-hashed, refresh tokens are SHA-256 hashed, and real secrets are git-ignored. That foundation is good.

However, the audit found a **trivial full-admin-compromise path** (weak/guessable JWT secret + a publicly documented default admin password), several **stored-XSS vectors**, **PII over-exposure** (password hashes leaking through a booking endpoint), **critical dependency vulnerabilities** (Next.js), and a **near-total absence of DPDP Act compliance** (no consent, no data-subject rights, no privacy policy, no grievance officer, unconsented cross-border data transfers).

### Findings by severity

| Severity | Count | Headline items |
|---|---|---|
| 🔴 **Critical** | 5 | Forgeable JWT secret, default admin creds, Next.js CVE, live DB credential on disk, no lawful basis for processing (DPDP) |
| 🟠 **High** | 7 | Bypassable HTML sanitizer → stored XSS, `passwordHash` leaked via bookings API, vulnerable deps (multer/lodash/postcss), unconsented cross-border transfers, no retention limits, no breach process, no children's-data safeguards |
| 🟡 **Medium** | 9 | No rate limiting, no security headers, tokens in localStorage, upload path traversal, spoofable upload MIME/SVG, `?all=true` content leak, Swagger in prod, open image optimizer, no consent withdrawal |
| 🔵 **Low / Info** | 7 | Registration user-enumeration, weak password policy, logout doesn't revoke access tokens, `target=_blank` tabnabbing, `{...dto}` mass-assignment (contained), no global exception filter, public booking not linked to user |

---

## 2. Critical Findings

### C-1 — Forgeable JWT signing secrets (full admin takeover)
**Severity: Critical** · `backend/.env:2-3`, `src/auth/strategies/jwt.strategy.ts:17`, `jwt-refresh.strategy.ts:13`, `docker-compose.yml:24-25`

The deployed secret is a human-readable phrase (`dev_access_secret_change_me`), and the strategies **fall back to a hardcoded public literal** when the env var is unset:
```ts
secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'change_me_access_secret',
```
Tokens are HS256 (symmetric). Anyone who knows/guesses/brute-forces the secret — or hits the fallback path — can forge `{ role: "SUPER_ADMIN" }` and pass both guards. `docker-compose.yml` ships the same default.
**Fix:** Generate 256-bit random secrets (`openssl rand -base64 48`), inject only via env, **remove the `??` fallbacks so the app fails closed** on boot, and rotate current secrets. `render.yaml` already does this correctly with `generateValue: true` — apply everywhere.

### C-2 — Default, documented SUPER_ADMIN credentials
**Severity: Critical** · `backend/prisma/seed.ts:204-214,420`, `README.md:92-93`, `DEPLOYMENT.md:43,118`

Every seeded deployment ships `admin@elite.events` / `Admin@123` (bcrypt-hashed, `role: SUPER_ADMIN`), the password is **printed to logs** and **published in the README/DEPLOYMENT docs**, and there is no forced rotation. Combined with C-1 this is a one-step admin takeover reachable through the public `POST /auth/login`.
**Fix:** Seed the admin password from an env var (no default; fail if unset) or generate a random one printed once; force change on first login; remove the plaintext password from all docs; do not seed privileged users in production.

### C-3 — Next.js critical dependency vulnerabilities
**Severity: Critical** · `frontend/package.json` → `next@14.2.13`

`npm audit` reports **1 critical + 1 high** in the frontend. Notable: **Authorization Bypass in Next.js Middleware (GHSA-f82v-jwr5-mffw)**, SSRF via middleware redirects (GHSA-4342-x723-ch2f), cache poisoning, and multiple DoS. `postcss <=8.5.17` (High: XSS + path traversal) is pulled transitively.
**Fix:** Upgrade Next.js to the latest patched 14.2.x (or newer) and re-run `npm audit`.

### C-4 — Live production database credential in working-tree `backend/.env`
**Severity: Critical** · `backend/.env:1`

A **real Neon Postgres connection string** (owner user + password, `...aws.neon.tech/neondb`) sits in plaintext on disk. It is correctly **not tracked in git** (`git ls-files` shows only `.env.example`), but a shared/distributed secret on disk is one `git add -f`, backup, or screen-share from disclosure and grants full read/write to production.
**Fix:** **Rotate the Neon credential now** (assume it is compromised once distributed), and keep it only in the deploy platform's secret store.

### C-5 — No lawful basis for processing personal data (DPDP S.5–6, S.11–14, S.13)
**Severity: Critical (compliance)** · `frontend/src/app/(site)/book/page.tsx`, `bookings.controller.ts:23-28`, `src/app/(site)/privacy/page.tsx`

Three foundational DPDP failures combine:
- **No notice or consent at collection.** The booking form collects name/email/phone/event details with no consent checkbox and no privacy notice; the "use my location" button captures precise geolocation with no prior notice. Booking creation is fully public/unauthenticated.
- **No data-principal rights.** There is **no `users` controller**, no self-service profile view/edit/delete, and **no `DELETE` on bookings** — customer PII is a one-way ingest with no access, correction, or erasure path.
- **No privacy policy or grievance officer.** `/privacy` and `/terms` render admin-CMS HTML that is **empty by default** ("Our privacy policy will be published here soon."); no grievance-officer/DPO contact exists anywhere.

**Fix:** Add unbundled consent + itemized notice at every collection point; build authenticated `GET/PATCH/DELETE /me` and booking-erasure flows; publish a real privacy policy naming a contactable grievance officer (see §6).

---

## 3. High Findings

### H-1 — Bypassable HTML sanitizer → stored XSS on public legal pages
**Severity: High** · `frontend/src/shared/lib/sanitize.ts:9-28`, sink at `features/website/components/legal-page.tsx:34`

`sanitizeHtml` is a **regex blocklist**, not an allowlist. The event-handler strippers anchor on whitespace (`\s`) before `on…`, and `<img>`/`<svg>` are not stripped. **Confirmed-working, no-interaction payloads** that survive the sanitizer and execute after `dangerouslySetInnerHTML` on the public Terms/Privacy pages:
```
<img/onerror="alert(document.cookie)"src=x>
<svg/onload="alert(document.cookie)">
<a href=javascript:alert(document.cookie)>x</a>        (unquoted js: URL)
<a href="javascript&#58;alert(1)">x</a>                (entity-encoded colon)
```
With tokens in `localStorage` (M-3) and no CSP (M-2), this exfiltrates admin/user tokens. Rated High (not Critical) only because writing the content requires an admin role today.
**Fix:** Replace with a real allowlist sanitizer (`isomorphic-dompurify`, or sanitize at write-time on the backend) and add a CSP.

### H-2 — API leaks customer `passwordHash` and refresh-token hash
**Severity: High** · `backend/src/bookings/bookings.service.ts:41` (`include: { customer: true }`), `GET /bookings/:id`

`findOne` includes the full `User` row, which contains `passwordHash` and `refreshToken`. There is no `ClassSerializerInterceptor`/`@Exclude` anywhere, so both are serialized into the JSON response. Even though the route is ADMIN-only, password hashes must never leave the DB (offline cracking, widened blast radius). The auth service does this correctly via `sanitize()` — the same discipline is missing on relations.
**Fix:** Replace `customer: true` with an explicit `select` of safe fields (id/name/email/phone), or add a global `ClassSerializerInterceptor` with `@Exclude()` on the sensitive columns.

### H-3 — Vulnerable backend dependencies (multer / lodash) + frontend postcss
**Severity: High** · `backend/package.json`, `frontend/package.json`

`npm audit` totals: **backend 12 (prod) / 27 (full)**, **frontend 2**. Runtime-reachable highs:
- `multer <=2.1.1` — 5 DoS advisories; used by the upload endpoint.
- `lodash <=4.17.23` — code injection + prototype pollution (via `@nestjs/config`).
- `qs`/`express 4.21.0` — moderate DoS.
- `postcss <=8.5.17` (frontend) — XSS + path traversal.
**Fix:** `npm audit fix`, bump `multer`, `@nestjs/config`, `express`, and Next.js; re-audit.

### H-4 — Unconsented cross-border transfers of precise location & free text (DPDP S.16)
**Severity: High (compliance)** · `frontend/src/shared/lib/geo.ts:56,68,98`, `i18n/translate.ts:45`, `uploads/storage.service.ts`

Personal data leaves the browser/server to foreign processors with **no consent, notice, or processor terms in code**:

| Processor | Jurisdiction | Data sent |
|---|---|---|
| Photon / komoot.io | Germany | Precise `lat/lng` + typed location strings |
| Nominatim / OpenStreetMap | UK | Precise `lat/lng` |
| MyMemory / translated.net | Italy | Content strings (via URL query) |
| Cloudinary | US | Uploaded imagery (when configured) |

**Fix:** Disclose all four in the privacy policy; gate geolocation/translation behind consent; prefer a coarse city over precise coordinates; use POST for translation; consider self-hosting (LibreTranslate). Transport is HTTPS for all (good).

### H-5 — No data retention limits; PII retained indefinitely (DPDP S.8(7))
**Severity: High (compliance)** · `backend/prisma/schema.prisma` (Booking/Testimonial)

No retention field, purge job, or anonymization exists. `Booking` and `Testimonial` PII persists forever.
**Fix:** Define a retention schedule and add a scheduled purge/anonymization after purpose completion.

### H-6 — No breach detection or notification capability (DPDP S.8(6))
**Severity: High (compliance)** · whole codebase

No audit logging of PII access, no anomaly alerting, no DPB/data-principal notification procedure.
**Fix:** Add audit logging on PII access/export and a documented breach-notification runbook.

### H-7 — No children's-data safeguards (DPDP S.9)
**Severity: High (compliance)** · booking/upload flows

No age gate, no DOB, no verifiable parental consent — yet weddings/events routinely involve minors' data in free-text fields and uploaded photos.
**Fix:** Add age attestation and restrict processing of minors' data absent verifiable parental consent; no behavioral tracking of children.

---

## 4. Medium Findings

| ID | Finding | Location | Fix |
|---|---|---|---|
| M-1 | **No rate limiting / brute-force protection.** Login, register, public booking & testimonial POSTs are unthrottled → credential stuffing + PII/spam flooding. | `auth`/`bookings`/`cms` controllers; no `@nestjs/throttler` | Add `@nestjs/throttler` globally; stricter on `/auth/*`; CAPTCHA on public POSTs |
| M-2 | **No security headers.** No helmet, CSP, HSTS, or `X-Content-Type-Options`. | `backend/src/main.ts` | Add `helmet()` + CSP + `nosniff` on static uploads |
| M-3 | **Tokens (incl. 7-day refresh) in `localStorage`.** JS-readable → any XSS = durable account takeover. | `frontend/src/shared/lib/api.ts:19-23,46-47` | httpOnly+Secure+SameSite cookie for refresh; access token in memory |
| M-4 | **Path traversal via upload `folder` param.** Unvalidated `folder` → `mkdir(recursive)` outside upload root. | `uploads/storage.service.ts` `uploadToDisk` | Allowlist `^[a-z0-9_-]+$`; reject `..`/separators |
| M-5 | **Spoofable upload MIME + no extension allowlist + SVG allowed.** `FileTypeValidator` trusts client MIME; extension taken from `originalname`; SVG can carry script; served from `/uploads`. | `uploads/uploads.controller.ts:58`, `storage.service.ts` `safeName` | Sniff magic bytes; extension from sniffed type; drop SVG or serve `attachment` + `nosniff` |
| M-6 | **`?all=true` leaks unapproved/inactive content.** Public routes return admin view (unapproved testimonials, draft CMS, inactive departments) based only on a query param. | `cms.controller.ts:36-38,70-73,105-108`; `departments.controller.ts:23-27` | Split into a role-gated admin route; ignore `all` for non-admins |
| M-7 | **Swagger UI/JSON exposed in production.** Full API/DTO schema public. | `backend/src/main.ts:22-28` | Gate behind `NODE_ENV !== 'production'` or auth |
| M-8 | **Next image optimizer open to any remote host** (`hostname: '**'`) → SSRF/DoS (GHSA-9g9p-9gw9-jx7f). | `frontend/next.config.mjs` | Restrict `remotePatterns` to your image domains |
| M-9 | **No consent-withdrawal mechanism** (DPDP S.6(4-7)). Follows from C-5; no consent records to withdraw. | whole codebase | Persist consent records + withdrawal endpoint |

---

## 5. Low / Informational

| ID | Finding | Location |
|---|---|---|
| L-1 | Registration reveals whether an email exists (`ForbiddenException('Email already registered')`). Login itself is safe (uniform "Invalid credentials"). | `auth.service.ts:48-49` |
| L-2 | Weak password policy — `@MinLength(6)`, no complexity/breach check. | `auth/dto/auth.dto.ts:18-21` |
| L-3 | Logout revokes the refresh token but not outstanding access tokens (valid up to 15 min; acceptable with short TTL). | `auth.service.ts:79-85` |
| L-4 | `target="_blank"` without `rel="noopener"` (reverse tabnabbing; mostly mitigated by modern browsers). | `whatsapp-fab.tsx:13`, `footer.tsx:55`, `contact-section.tsx:65` |
| L-5 | `{...dto}` spread into Prisma writes (mass-assignment) — currently **contained** by `whitelist:true` + admin-only routes, but `forbidNonWhitelisted` is `false`, so it's fragile. | `vendors.service.ts:56,135`, `cms.service.ts:26,49,65` |
| L-6 | No global exception filter (Nest default does not leak stack traces, but Prisma errors surface as opaque 500s with no redacted logging). | `backend/src/main.ts` |
| L-7 | Public `POST /bookings` is `@Public()`, so `@CurrentUser('id')` is always `undefined` — bookings are never linked to a logged-in customer. | `bookings.controller.ts:24-28` |

---

## 6. DPDP Act 2023 — Compliance Scorecard

**Overall: Non-compliant.** The platform collects personal data (name, email, phone, precise location, event details, imagery) but implements essentially none of the DPDP obligations.

| # | Obligation (DPDP §) | Status | Evidence |
|---|---|---|---|
| 1 | Notice & Consent (S.5–6) | 🔴 Non-compliant | No consent checkbox/notice on booking or testimonial forms; geolocation captured without notice |
| 2 | Purpose limitation & minimization (S.6, S.8(3)) | 🟡 Partial | `whitelist:true` strips extra fields (+), but no stated purpose; precise coords sent when a city would do |
| 3 | Data-principal rights: access/correction/erasure (S.11–14) | 🔴 Non-compliant | No `users` controller; no booking `DELETE`; no self-service |
| 4 | Consent Manager / withdrawal (S.6(4-7)) | 🔴 Non-compliant | No consent recorded, so none can be withdrawn |
| 5 | Retention / erasure on completion (S.8(7)) | 🔴 Non-compliant | No retention field or purge job; PII kept forever |
| 6 | Security safeguards (S.8(5)) | 🟡 Partial | bcrypt hashing + guards + validation (+); no helmet/rate-limit, localStorage tokens, no encryption at rest (−) |
| 7 | Breach notification (S.8(6)) | 🔴 Non-compliant | No detection, audit logging, or notification path |
| 8 | Children's data (S.9) | 🔴 Non-compliant | No age gate / parental consent |
| 9 | Grievance officer / DPO (S.8(9), S.13) | 🔴 Non-compliant | No contact anywhere; privacy page empty |
| 10 | Accurate privacy/terms pages | 🔴 Non-compliant | CMS pages empty by default; no mention of transfers/retention/rights |

**Bright spot:** No analytics, pixels, GA/GTM, or cookie trackers were found — there is no non-consented tracking (auth uses localStorage, not cookies). GDPR maps to the same gaps: Art. 6/7, 12–17, 13, 30, 33–34, 44–49, and 8.

### Personal-data inventory (abridged)
| Data | Category | Collected at | Stored | Third parties |
|---|---|---|---|---|
| name / email / phone | Identifier / contact | register, **public** booking, testimonial | `User`, `Booking`, `Testimonial` | — |
| passwordHash / refreshToken | Credentials (bcrypt) | register / login | `User` | — (but leaked via H-2) |
| precise lat/lng | Precise location | "use my location" button | not persisted | Photon (DE), Nominatim (UK) |
| booking location / budget / specialRequirements | Personal (free text) | booking form | `Booking` | Photon (autocomplete) |
| uploaded imagery | Personal / possibly special-category | `POST /uploads` | disk or Cloudinary | Cloudinary (US) |

---

## 7. What's Done Well (verified)

- **Authorization backbone is correct:** global `JwtAuthGuard` + `RolesGuard` as `APP_GUARD` (`auth.module.ts:20-21`), `@Public()` opt-out honored, and **every** create/update/delete + stats + uploads route carries `@Roles(ADMIN, SUPER_ADMIN)`. No mutating route is accidentally public.
- **No SQL injection surface** — all DB access is via Prisma's typed query builder; no `$queryRaw`/`$executeRaw`.
- **Passwords bcrypt-hashed** (cost 10). **Refresh tokens SHA-256 hashed**, deliberately not bcrypt: bcrypt truncates at 72 bytes, and every token for a user shares an identical prefix well past that, so a rotated-away token still validated and rotation revoked nothing. Regression-guarded by API-AUTH-P-04.
- Refresh-token **rotation** on every refresh; auth responses strip `passwordHash`/`refreshToken` via `sanitize()`.
- **Bookings (customer PII) are strictly admin-only** — no customer by-id read means no IDOR surface.
- **Global `ValidationPipe({ whitelist:true, transform:true })`** neutralizes most mass-assignment.
- **Self-registration cannot escalate role** (hardcoded `role: CUSTOMER`); public testimonial submit hardcodes `approved:false` without spreading the DTO.
- **CORS is an env allowlist**, not wildcard; **no SSRF** in server-side fetches; **no `eval`/`new Function`**.
- **Real secrets are git-ignored** (only `.env.example` placeholders tracked); `render.yaml` uses `generateValue`/`fromDatabase`.
- **No unconsented trackers/cookies.**

---

## 8. Prioritized Remediation Roadmap

**Now (before next deploy) — Critical**
1. Rotate the Neon DB credential (C-4) and JWT secrets; remove the `?? 'change_me…'` fallbacks so the app fails closed (C-1).
2. Remove the default admin password from seed/docs; require an env-provided or rotate-on-first-login admin (C-2).
3. Upgrade Next.js + run `npm audit fix` (C-3, H-3).
4. Stop returning `customer: true` (use `select`) so `passwordHash` stops leaking (H-2).

**This sprint — High**
5. Replace the regex sanitizer with DOMPurify + add a CSP (H-1, M-2).
6. Add `@nestjs/throttler` rate limiting + `helmet` (M-1, M-2).
7. Move refresh tokens to httpOnly cookies (M-3).
8. Harden uploads: validate `folder`, sniff MIME, drop SVG, `nosniff` (M-4, M-5).

**Compliance track — DPDP (parallel, needs product + legal)**
9. Consent + notice at every collection point; disclose the four cross-border processors (C-5, H-4, M-9).
10. Build `GET/PATCH/DELETE /me` + booking erasure (data-principal rights) (C-5).
11. Publish a real privacy policy with a named grievance officer; add retention purge + breach runbook + age gating (C-5, H-5, H-6, H-7).

**Backlog — Medium/Low**
12. Gate Swagger to non-prod (M-7); restrict image `remotePatterns` (M-8); split `?all=true` into an admin route (M-6); `forbidNonWhitelisted:true` (L-5); global exception filter (L-6); registration enumeration + password policy + `rel=noopener` (L-1, L-2, L-4).

---

*Prepared by automated multi-agent source review (auth/authz, injection/XSS/uploads, secrets/deps/exposure, DPDP compliance). Findings are code-cited; no dynamic exploitation was performed against a live host.*
