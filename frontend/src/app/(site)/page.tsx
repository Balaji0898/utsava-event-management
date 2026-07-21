import { Suspense } from 'react';
import Link from 'next/link';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Hero } from '@/features/website/components/hero';
import { Reveal, Stagger, StaggerItem } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { AnimatedCounter } from '@/shared/motion/counter';
import { Testimonials } from '@/features/website/components/testimonials';
import { Faq } from '@/features/website/components/faq';
import { ContactSection } from '@/features/website/components/contact-section';
import { FunctionHallsSection, type Hall } from '@/features/website/components/function-halls-section';
import { VendorGridSkeleton } from '@/shared/ui/skeletons';
import { T } from '@/shared/i18n';
import { formatCurrency } from '@/shared/lib/utils';
import { Star, ShieldCheck, TrendingUp } from 'lucide-react';

// Render at request time (not prerendered at build) so the homepage always
// shows live data and never a stale/empty page baked while the backend was
// cold. Data itself is still cached across requests via `serverApi`.
export const dynamic = 'force-dynamic';

type Department = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  banner?: string;
  description?: string;
  _count?: { vendors: number };
};

type Vendor = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  rating: number;
  reviewCount: number;
  priceFrom: string | number;
  verified: boolean;
  trending: boolean;
  department?: { name: string };
};

type Testimonial = {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  rating: number;
  message: string;
};
type FaqItem = { id: string; question: string; answer: string };

const stats = [
  { key: 'stats.events', value: 5200, suffix: '+' },
  { key: 'stats.vendors', value: 480, suffix: '+' },
  { key: 'stats.cities', value: 32, suffix: '' },
  { key: 'stats.customers', value: 12000, suffix: '+' },
];

/**
 * The page shell (hero, stats, section headings, contact, CTA) renders
 * instantly, and each data-driven grid streams in on its own via <Suspense>.
 * This means the homepage paints immediately instead of blocking on the
 * slowest backend call — the biggest source of the earlier "noticeable delay".
 */
export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Stats — static, paints immediately */}
      <section className="container-page relative z-10 mt-6">
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <StaggerItem key={s.key}>
              <div className="card p-6 text-center">
                <div className="text-3xl font-extrabold text-brand-500">
                  <AnimatedCounter to={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-1 text-sm text-[rgb(var(--foreground))]/60">
                  <T k={s.key} />
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Services / departments */}
      <section id="services" className="container-page py-20">
        <Reveal>
          <h2 className="text-3xl font-bold">
            <T k="services.title" />
          </h2>
          <p className="mt-2 text-[rgb(var(--foreground))]/60">
            <T k="services.subtitle" />
          </p>
        </Reveal>
        <Suspense fallback={<div className="mt-10"><VendorGridSkeleton count={6} /></div>}>
          <ServicesGrid />
        </Suspense>
      </section>

      {/* Featured vendors */}
      <section className="container-page py-10">
        <Reveal>
          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold">
              <T k="featured.title" />
            </h2>
            <Link href="/vendors" className="text-sm font-medium text-brand-500">
              <T k="featured.viewAll" /> →
            </Link>
          </div>
        </Reveal>
        <Suspense fallback={<div className="mt-10"><VendorGridSkeleton count={6} /></div>}>
          <FeaturedGrid />
        </Suspense>
      </section>

      {/* Function Halls & Venues */}
      <Suspense fallback={null}>
        <HallsSection />
      </Suspense>

      {/* Testimonials */}
      <Suspense fallback={null}>
        <TestimonialsSection />
      </Suspense>

      {/* FAQ */}
      <Suspense fallback={null}>
        <FaqSection />
      </Suspense>

      {/* Contact — static */}
      <ContactSection />

      {/* CTA — static */}
      <section className="container-page py-20">
        <Reveal>
          <div className="card relative overflow-hidden bg-gradient-to-r from-brand-600 to-amber-600 p-12 text-center text-white">
            <h2 className="text-3xl font-bold">
              <T k="cta.title" />
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              <T k="cta.subtitle" />
            </p>
            <Link
              href="/book"
              className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 transition hover:scale-105"
            >
              <T k="cta.button" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Streamed, data-driven sections — each fetches independently.        */
/* ------------------------------------------------------------------ */

async function ServicesGrid() {
  const departments =
    (await serverApi<Department[]>('/departments', { tags: [CACHE_TAGS.departments] })) ?? [];

  return (
    <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((d) => (
        <StaggerItem key={d.id}>
          <TiltCard className="card h-full overflow-hidden">
            <Link href={`/vendors?departmentId=${d.id}`}>
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.banner ?? ''}
                  alt={d.name}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2 text-2xl">
                  <span>{d.icon}</span>
                  <span className="text-lg font-bold text-white">{d.name}</span>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm text-[rgb(var(--foreground))]/60">
                  {d.description ?? <T k="services.explore" />}
                </p>
                <div className="mt-4 text-sm font-medium text-brand-500">
                  {d._count?.vendors ?? 0} <T k="services.vendorsSuffix" /> →
                </div>
              </div>
            </Link>
          </TiltCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

async function FeaturedGrid() {
  const vendorsRes = await serverApi<{ data: Vendor[] }>('/vendors?featured=true&limit=6', {
    tags: [CACHE_TAGS.vendors],
  });
  const featured = vendorsRes?.data ?? [];

  return (
    <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map((v) => (
        <StaggerItem key={v.id}>
          <TiltCard className="card h-full overflow-hidden">
            <Link href={`/vendors/${v.slug}`}>
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.coverImage ?? ''}
                  alt={v.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-500">
                    {v.department?.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    {v.rating} ({v.reviewCount})
                  </span>
                </div>
                <h3 className="mt-2 flex items-center gap-1 text-lg font-semibold">
                  {v.name}
                  {v.verified && <ShieldCheck size={16} className="text-brand-500" />}
                  {v.trending && <TrendingUp size={16} className="text-amber-500" />}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--foreground))]/60">
                  {v.description}
                </p>
                <div className="mt-4 text-sm">
                  <T k="featured.from" />{' '}
                  <span className="font-bold">{formatCurrency(Number(v.priceFrom))}</span>
                </div>
              </div>
            </Link>
          </TiltCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

async function HallsSection() {
  const departments =
    (await serverApi<Department[]>('/departments', { tags: [CACHE_TAGS.departments] })) ?? [];
  const fhDept = departments.find((d) => d.slug === 'function-halls');
  if (!fhDept) return null;
  const hallsRes = await serverApi<{ data: Hall[] }>(
    `/vendors?departmentId=${fhDept.id}&limit=4`,
    { tags: [CACHE_TAGS.vendors] },
  );
  return <FunctionHallsSection halls={hallsRes?.data ?? []} deptId={fhDept.id} />;
}

async function TestimonialsSection() {
  const testimonials =
    (await serverApi<Testimonial[]>('/cms/testimonials', { tags: [CACHE_TAGS.cms] })) ?? [];
  return <Testimonials items={testimonials} />;
}

async function FaqSection() {
  const faqs = (await serverApi<FaqItem[]>('/cms/faqs', { tags: [CACHE_TAGS.cms] })) ?? [];
  return <Faq items={faqs} />;
}
