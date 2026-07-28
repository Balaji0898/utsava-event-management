# 🚀 Deploying Utsava

Utsava is a 3-part app, so deployment has 3 pieces:

| Piece | What | Recommended host |
|-------|------|------------------|
| **Database** | PostgreSQL | Render Postgres / Neon / Supabase |
| **Backend** | NestJS API (`/backend`) | Render / Railway (Docker) |
| **Frontend** | Next.js site + admin (`/frontend`) | Vercel |

The repo already includes the configs:
- `render.yaml` — Render blueprint (API + Postgres)
- `backend/railway.json` — Railway (Docker) config
- `frontend/vercel.json` — Vercel (Next.js) config
- `backend/Dockerfile`, `frontend/Dockerfile`, root `docker-compose.yml`

> **Order matters:** deploy **Database → Backend → Frontend**, because the frontend needs the backend URL and the backend needs the database URL.

---

## Option 1 — Render (backend + DB) + Vercel (frontend)  ← recommended

### A. Backend + Database on Render (via Blueprint)
1. Push this repo to GitHub (done ✅).
2. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New +** → **Blueprint**.
3. Connect the **`utsava-event-management`** repo. Render reads `render.yaml` and proposes:
   - a **PostgreSQL** database (`utsava-db`)
   - a **web service** (`utsava-api`) built from `backend/Dockerfile`
4. Click **Apply**. Render provisions the DB, injects `DATABASE_URL`, and auto-generates the JWT secrets.
5. First boot runs `prisma migrate deploy` automatically (in the Docker `CMD`), creating all tables.
6. When it's live, copy the API URL, e.g. `https://utsava-api.onrender.com`.
7. In the **utsava-api** service → **Environment**, set:
   - `APP_URL` = `https://utsava-api.onrender.com` (used for local-upload URLs)
   - `CORS_ORIGIN` = your Vercel URL (fill in after step B) — e.g. `https://utsava.vercel.app`
   - *(optional, for persistent uploads)* `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - Save → Render redeploys.

**Seed demo data (once):** open the service → **Shell** and run:
```bash
npm run seed
```
This creates the departments, vendors, Function Halls, testimonials, FAQs, and the admin user.
Set `SEED_ADMIN_PASSWORD` (and optionally `SEED_ADMIN_EMAIL`) before seeding, or the script
generates a strong random password and prints it **once** — copy it from the console.

### Rotating the seeded admin password

**The seed only ever sets a password when it CREATES the admin.** It upserts with `update: {}`, so
re-running `npm run seed` against a database that already has an admin changes nothing — even if
`SEED_ADMIN_PASSWORD` is set. (The seed now says so explicitly when it detects this.)

That matters for one specific reason: earlier versions of this repo shipped a hardcoded
`Admin@123` and published it in the README. **Any environment seeded before that was removed still
has that password, and deploying the fix does not change it.** Rotate it explicitly:

```bash
# Render → your service → Shell
NEW_ADMIN_PASSWORD='<a long, unique password>' npm run admin:rotate
```

The script updates the existing admin only — it never creates an account, refuses anything under
12 characters, refuses the old published default, and revokes live sessions so the previous
password cannot be refreshed into a new one. Clear the value from your shell history afterwards.

> **Note on uploads:** Render's disk is ephemeral — locally-uploaded images are wiped on redeploy.
> For production, set the `CLOUDINARY_*` vars above; the backend auto-switches to Cloudinary.

### B. Frontend on Vercel
1. Go to **[vercel.com/new](https://vercel.com/new)** → import the **`utsava-event-management`** repo.
2. **Root Directory:** set to **`frontend`** (important — the Next.js app lives there).
3. Framework preset: **Next.js** (auto-detected).
4. **Environment Variables** → add:
   - `NEXT_PUBLIC_API_URL` = your Render API URL, e.g. `https://utsava-api.onrender.com`
5. **Deploy.** Vercel gives you `https://utsava-<something>.vercel.app`.
6. Go back to **Render → utsava-api → Environment** and set `CORS_ORIGIN` to that Vercel URL, save (redeploys).

Done — visit the Vercel URL for the site, `/admin` for the dashboard, `/login` to sign in.

---

## Option 2 — Railway (backend + DB) + Vercel (frontend)
1. **[railway.app](https://railway.app)** → **New Project** → **Deploy from GitHub repo** → pick the repo.
2. Railway detects `backend/railway.json` (Docker). Set the service **Root Directory** to `backend` if prompted.
3. In the same project: **New → Database → PostgreSQL**. Railway exposes `DATABASE_URL`.
4. On the API service → **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference the DB plugin)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` = long random strings
   - `JWT_ACCESS_TTL` = `900s`, `JWT_REFRESH_TTL` = `7d`
   - `APP_URL` = the Railway public URL, `CORS_ORIGIN` = the Vercel URL
   - *(optional)* `CLOUDINARY_*`
5. Railway builds the Dockerfile and runs `prisma migrate deploy` on start. Use the service shell to `npm run seed` once.
6. Deploy the **frontend on Vercel** exactly as in Option 1.B, pointing `NEXT_PUBLIC_API_URL` at the Railway URL.

---

## Option 3 — All-in-one with Docker Compose (VPS / your own server)
On any Docker host:
```bash
git clone https://github.com/Balaji0898/utsava-event-management.git
cd utsava-event-management
cp .env.example .env      # edit secrets, set CORS_ORIGIN / NEXT_PUBLIC_API_URL to your domain
docker compose up -d --build
# seed once:
docker compose exec backend npm run seed
```
Then put a reverse proxy (Caddy/Nginx) in front for TLS. Frontend → :3000, API → :4000.

---

## Environment variables reference

### Backend (`/backend`)
| Var | Example | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/utsava` | from your Postgres host |
| `JWT_ACCESS_SECRET` | long random string | |
| `JWT_REFRESH_SECRET` | long random string | different from access |
| `JWT_ACCESS_TTL` | `900s` | |
| `JWT_REFRESH_TTL` | `7d` | |
| `PORT` | injected by host | leave unset on Render/Railway |
| `APP_URL` | `https://utsava-api.onrender.com` | for local-upload URLs |
| `CORS_ORIGIN` | `https://utsava.vercel.app` | your frontend origin(s), comma-separated |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | — | optional; enables persistent uploads |

### Frontend (`/frontend`)
| Var | Example | Notes |
|-----|---------|-------|
| `NEXT_PUBLIC_API_URL` | `https://utsava-api.onrender.com` | must be set **before** build (it's inlined) |

---

## Post-deploy checklist
- [ ] Backend health: open `https://<api>/api/departments` → returns JSON `200`
- [ ] Swagger docs: `https://<api>/docs`
- [ ] Ran `npm run seed` once (departments, vendors, admin user exist)
- [ ] `CORS_ORIGIN` on the backend = the exact Vercel URL (no trailing slash)
- [ ] `NEXT_PUBLIC_API_URL` on Vercel = the exact API URL
- [ ] Set a strong `SEED_ADMIN_PASSWORD` (or captured the generated one) and logged into `/login`
- [ ] **Ran `NEW_ADMIN_PASSWORD='…' npm run admin:rotate`** — mandatory on any environment seeded before the hardcoded `Admin@123` was removed, since the seed will not rotate an existing admin
- [ ] Set `REVALIDATE_SECRET` on Vercel — without it `POST /api/revalidate` returns 503 in production, and admin edits will not refresh the public pages
- [ ] (Production) set `CLOUDINARY_*` so uploaded images persist
- [ ] (Optional) add a custom domain in Vercel and update `CORS_ORIGIN`

## CI/CD — auto-deploy on push (GitHub Actions)

The repo includes two workflows in `.github/workflows/`:
- `deploy-backend.yml` — pings a Render **Deploy Hook** when `backend/**` changes
- `deploy-frontend.yml` — builds & deploys to **Vercel** when `frontend/**` changes

They **skip safely** until you add the secrets below (no failed runs). Do the manual
deploy once (Options 1/2) so the Render service and Vercel project exist, then wire up:

### Add these in GitHub → repo → Settings → Secrets and variables → Actions → *New repository secret*

| Secret | Where to get it |
|--------|-----------------|
| `RENDER_DEPLOY_HOOK_URL` | Render → your `utsava-api` service → **Settings → Deploy Hook** → copy URL |
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → create token |
| `VERCEL_ORG_ID` | run `vercel link` inside `frontend/` once → read `frontend/.vercel/project.json` (`orgId`) |
| `VERCEL_PROJECT_ID` | same `project.json` (`projectId`), or Vercel → Project → Settings → General |

Once set, every push to `main` that touches `backend/**` redeploys the API, and any push
touching `frontend/**` redeploys the site. You can also trigger them manually from the
**Actions** tab (**Run workflow**).

> Simpler alternative for the backend: in Render, enable **Auto-Deploy = Yes** on the service
> (it redeploys on every push natively) and you can skip `RENDER_DEPLOY_HOOK_URL`. Vercel also
> auto-deploys if you connect the Git repo directly — the Actions workflow is for teams that
> want deploys controlled from CI instead.

## Free-tier note
Render/Railway free web services **sleep when idle** and cold-start in ~30–60s on the first request. For an always-on demo, use a paid instance or ping the health URL periodically.
