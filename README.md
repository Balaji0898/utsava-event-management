# Utsava — Event Management Platform

*Where every moment becomes a festival.*

A modern, scalable **Event Management Website + Admin Dashboard** with a premium gold UI,
fully dynamic data model (unlimited departments → categories → items, vendors, function halls,
multi-tier pricing, bookings), Three.js 3D, Framer Motion, and EN/Telugu i18n.

## 🚀 Get live URLs (one-click deploy)

GitHub hosts the **code**; to get **live URLs** deploy the backend+DB and the frontend
(both free tiers). Deploy order: **backend first**, then frontend.

**1. Backend + PostgreSQL → Render** (reads `render.yaml`):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Balaji0898/utsava-event-management)

**2. Frontend → Vercel** (set Root Directory to `frontend`, and `NEXT_PUBLIC_API_URL` to the Render API URL):

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Balaji0898/utsava-event-management&root-directory=frontend&env=NEXT_PUBLIC_API_URL&envDescription=Base%20URL%20of%20the%20deployed%20Utsava%20API%20(e.g.%20https://utsava-api.onrender.com))

Then in Render set `CORS_ORIGIN` to your Vercel URL, and run `npm run seed` once (Render → Shell).
You'll end up with:
- **Website:** `https://<your-app>.vercel.app`
- **Admin:** `https://<your-app>.vercel.app/admin` (login with the seeded admin email + the password set/generated at seed time)
- **API / Swagger:** `https://<your-api>.onrender.com/api` · `/docs`

Full walkthrough: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

## Tech Stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, React Hook Form, Zod |
| Backend    | NestJS, TypeScript, Swagger |
| Database   | PostgreSQL + Prisma ORM |
| Auth       | JWT access + refresh tokens, role-based access (SUPER_ADMIN / ADMIN / VENDOR / CUSTOMER) |
| Deploy     | Docker + docker-compose |

## Monorepo Layout

```
Eventmanagement/
├── backend/            # NestJS REST API + Prisma
│   ├── prisma/
│   │   ├── schema.prisma   # Full dynamic data model
│   │   └── seed.ts         # Seed departments, vendors, admin user
│   └── src/
│       ├── auth/           # JWT + refresh + roles
│       ├── departments/    # Dynamic departments CRUD
│       ├── categories/     # Categories CRUD
│       ├── items/          # Items CRUD + dynamic pricing
│       ├── vendors/        # Vendors CRUD
│       ├── packages/       # Multi-tier vendor packages
│       └── bookings/       # Booking workflow
│       ├── cms/            # Banners/sliders, testimonials, FAQs
│       └── uploads/        # File uploads (local disk or Cloudinary) + media library
├── frontend/           # Next.js website + admin dashboard (feature-based)
│   └── src/
│       ├── app/            # thin route files only
│       │   ├── (site)/         # Public website routes
│       │   ├── (auth)/         # Login
│       │   └── admin/          # Admin dashboard routes
│       ├── features/
│       │   ├── website/        # public site components (hero, faq, testimonials…)
│       │   └── admin/          # admin components (sidebar, image-uploader…)
│       └── shared/
│           ├── ui/  lib/  i18n/  motion/  theme/
│           └── i18n/locales/   # en.json + te.json (Telugu)
└── docker-compose.yml  # Postgres + backend + frontend
```

## Quick Start (local dev)

### 1. Database
```bash
# From repo root – starts only Postgres
docker compose up -d db
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # then edit if needed
npm install
npx prisma migrate dev --name init
npm run seed                  # seed admin + demo data
npm run start:dev             # http://localhost:4000  (Swagger at /docs)
```

Seeded super admin:
- **email:** `admin@elite.events` (override with `SEED_ADMIN_EMAIL`)
- **password:** set `SEED_ADMIN_PASSWORD` before seeding, or the seed script
  generates a strong random password and prints it **once** in the console —
  copy it then. No default password is shipped.

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

## Full stack via Docker
```bash
cp .env.example .env
docker compose up --build
```

## Deployment
See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step guides:
- **Vercel** (frontend) + **Render** (backend + Postgres) — recommended, configs included (`render.yaml`, `frontend/vercel.json`)
- **Railway** alternative (`backend/railway.json`)
- Self-hosted via Docker Compose

## What's included
- ✅ Complete Prisma data model (dynamic departments, categories, items, vendors, packages, pricing, bookings, reviews, users/roles, CMS blocks, testimonials, FAQs, media assets)
- ✅ JWT auth with refresh tokens + role guards
- ✅ CRUD REST APIs for all core entities with Swagger docs
- ✅ **CMS module** — homepage banners/sliders/sections, testimonials, FAQs (admin-managed)
- ✅ **File uploads** — local disk storage by default, auto-switches to Cloudinary when configured; media library + drag-and-drop uploader in admin
- ✅ Seed data with curated placeholder imagery (Unsplash)
- ✅ Next.js website (animated home w/ images, testimonials, FAQ) + admin dashboard + login
- ✅ **Bilingual UI** — English + Telugu (తెలుగు) with a language toggle
- ✅ Dark / light theme, Framer Motion animations
- ✅ Docker configuration

## URLs (when running locally)
| Surface | URL |
|---------|-----|
| Website | http://localhost:3000 |
| Admin dashboard | http://localhost:3000/admin (login first) |
| Admin login | http://localhost:3000/login |
| API | http://localhost:4000/api |
| Swagger docs | http://localhost:4000/docs |

## Extend from here
This is a production-structured foundation. Build out remaining modules (CMS, coupons,
notifications, reports/PDF export, Cloudinary uploads) following the same module pattern
in `backend/src/*` and the same page pattern in `frontend/src/app/*`.
