import { Suspense, cache } from 'react';
import Link from 'next/link';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Hero } from '@/features/website/components/hero';
import { Reveal, Stagger, StaggerItem } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { AnimatedCounter } from '@/shared/motion/counter';
import { Testimonials } from '@/features/website/components/testimonials';
import { TestimonialForm } from '@/features/website/components/testimonial-form';
import { Faq } from '@/features/website/components/faq';
import { ContactSection } from '@/features/website/components/contact-section';
import { FunctionHallsSection, type Hall } from '@/features/website/components/function-halls-section';
import { BestEventsSlider, type BestEventSlide } from '@/features/website/components/best-events-slider';
import { VendorGridSkeleton } from '@/shared/ui/skeletons';
import { T } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';

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

// Deduped per-request: ServicesGrid, BestEventsSection and HallsSection all
// need departments — React cache() coalesces them into a single fetch.
const getDepartments = cache(() =>
  serverApi<Department[]>('/departments', { tags: [CACHE_TAGS.departments] }),
);

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
  department?: { id: string; name: string };
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

type StatItem = { label: string; value: number; suffix?: string };

// Fallback if the admin hasn't configured stats yet (or the backend is cold).
const STATS_FALLBACK: StatItem[] = [
  { label: 'Events Delivered', value: 5200, suffix: '+' },
  { label: 'Verified Vendors', value: 480, suffix: '+' },
  { label: 'Cities', value: 32, suffix: '' },
  { label: 'Happy Customers', value: 12000, suffix: '+' },
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

      {/* Best Events — cinematic auto-play showcase, right under the hero */}
      <section className="container-page pt-6 pb-12">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">
                <T k="bestEvents.title" />
              </h2>
              <p className="mt-2 text-[rgb(var(--foreground))]/60">
                <T k="bestEvents.subtitle" />
              </p>
            </div>
            <Link
              href="/vendors"
              className="shrink-0 whitespace-nowrap text-sm font-medium text-accent"
            >
              <T k="featured.viewAll" /> →
            </Link>
          </div>
        </Reveal>
        <div className="mt-6">
          <Suspense
            fallback={
              <div className="skeleton h-[62vh] min-h-[420px] w-full rounded-[1.75rem] sm:rounded-[2.5rem]" />
            }
          >
            <BestEventsSection />
          </Suspense>
        </div>
      </section>

      {/* Stats — admin-editable "trusted users" counters, streamed */}
      <section className="container-page relative z-10 mt-6">
        <Suspense fallback={<StatsGrid items={STATS_FALLBACK} />}>
          <StatsSection />
        </Suspense>
      </section>

      {/* Services / departments — tonal band for section rhythm */}
      <div className="mt-6 border-y bg-[rgb(var(--muted))]/60">
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
      </div>

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

function StatsGrid({ items }: { items: StatItem[] }) {
  return (
    <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((s, i) => (
        <StaggerItem key={`${s.label}-${i}`} className="h-full">
          <div className="card flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="text-3xl font-extrabold text-accent">
              <AnimatedCounter to={s.value} suffix={s.suffix ?? ''} />
            </div>
            <div className="mt-1 text-sm text-[rgb(var(--foreground))]/60">
              <Tr>{s.label}</Tr>
            </div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

async function StatsSection() {
  const data = await serverApi<{ items?: StatItem[] }>('/cms/stats', { tags: [CACHE_TAGS.cms] });
  const items = data?.items?.length ? data.items : STATS_FALLBACK;
  return <StatsGrid items={items} />;
}

async function ServicesGrid() {
  const departments =
    (await getDepartments()) ?? [];

  return (
    <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((d) => (
        <StaggerItem key={d.id}>
          <TiltCard className="card h-full overflow-hidden">
            <Link href={`/vendors?departmentId=${d.id}`} className="flex h-full flex-col">
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
                  <span className="text-lg font-bold text-white">
                    <Tr>{d.name}</Tr>
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-sm text-[rgb(var(--foreground))]/60">
                  {d.description ? <Tr>{d.description}</Tr> : <T k="services.explore" />}
                </p>
                <div className="mt-auto pt-4 text-sm font-medium text-accent">
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

async function BestEventsSection() {
  const [departments, featuredRes] = await Promise.all([
    getDepartments(),
    serverApi<{ data: Vendor[] }>('/vendors?featured=true&limit=50', {
      tags: [CACHE_TAGS.vendors],
    }),
  ]);
  const depts = departments ?? [];
  const featured = featuredRes?.data ?? [];

  // One best (featured) vendor per category; first wins (dedupe legacy data).
  const bestByDept = new Map<string, Vendor>();
  for (const v of featured) {
    const dId = v.department?.id;
    if (dId && !bestByDept.has(dId)) bestByDept.set(dId, v);
  }

  // One slide per category — best vendor if any, otherwise the category banner.
  const slides: BestEventSlide[] = depts.map((d) => {
    const v = bestByDept.get(d.id);
    return {
      category: d.name,
      icon: d.icon,
      image: v?.coverImage ?? d.banner,
      title: v?.name ?? d.name,
      description: v?.description ?? d.description,
      priceFrom: v ? Number(v.priceFrom) : undefined,
      href: v ? `/vendors/${v.slug}` : `/vendors?departmentId=${d.id}`,
      isBest: Boolean(v),
    };
  });

  return <BestEventsSlider slides={slides} />;
}

async function HallsSection() {
  const departments =
    (await getDepartments()) ?? [];
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
  return (
    <>
      <Testimonials items={testimonials} />
      <section className="container-page pb-10">
        <TestimonialForm />
      </section>
    </>
  );
}

async function FaqSection() {
  const faqs = (await serverApi<FaqItem[]>('/cms/faqs', { tags: [CACHE_TAGS.cms] })) ?? [];
  return <Faq items={faqs} />;
}
