import { Suspense, cache, type ReactNode } from 'react';
import Link from 'next/link';
import { serverRead, isList, isPage, CACHE_TAGS } from '@/shared/lib/api';
import { Hero } from '@/features/website/components/hero';
import { Reveal, Stagger, StaggerItem } from '@/shared/motion/primitives';
import { AnimatedCounter } from '@/shared/motion/counter';
import { Testimonials } from '@/features/website/components/testimonials';
import { TestimonialForm } from '@/features/website/components/testimonial-form';
import { Faq } from '@/features/website/components/faq';
import { ContactSection } from '@/features/website/components/contact-section';
import { FunctionHallsSection, type Hall } from '@/features/website/components/function-halls-section';
import { BestEventsSlider, type BestEventSlide } from '@/features/website/components/best-events-slider';
import { NearbyEvents } from '@/features/website/components/nearby-events';
import {
  SectionBoundary,
  SectionEmpty,
  SectionRetry,
} from '@/features/website/components/section-retry';
import {
  ServicesGrid,
  serviceHref,
  type Department,
} from '@/features/website/components/services-grid';
import { VendorGridSkeleton } from '@/shared/ui/skeletons';
import { T } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';

// Render at request time (not prerendered at build) so the homepage always
// shows live data and never a stale/empty page baked while the backend was
// cold. Data itself is still cached across requests via `serverApi`.
export const dynamic = 'force-dynamic';

// Must stay above the worst-case render: the layout's 2.5s contact read, then
// HallsSection's two sequential reads at SECTION_READ's ~20s each. Otherwise the
// platform can kill the function mid-stream, leaving sections blank for good.
export const maxDuration = 60;

// Sections recover in the browser (SectionRetry), so one retry is enough here;
// the backoff that outlasts a cold start lives there, not in an open request.
const SECTION_READ = { timeoutMs: 10000, retries: 1 };

// Deduped per-request: ServicesGrid, BestEventsSection and HallsSection all
// need departments — React cache() coalesces them into a single fetch.
const getDepartments = cache(() =>
  serverRead<Department[]>('/departments', {
    ...SECTION_READ,
    section: 'departments',
    tags: [CACHE_TAGS.departments],
    validate: isList,
  }),
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
  department?: Department;
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

const BEST_EVENTS_SKELETON = (
  <div className="skeleton h-[62vh] min-h-[420px] w-full rounded-[1.75rem] sm:rounded-[2.5rem]" />
);
const SERVICES_SKELETON = (
  <div className="mt-10">
    <VendorGridSkeleton count={6} />
  </div>
);
const EVENTS_ERROR = "Couldn't load events just now.";
const SERVICES_ERROR = "Couldn't load services just now.";

/**
 * One independently failing part of the page: it streams on its own, and a
 * render error stays inside it. `errorMessage` is shown for such an error;
 * sections without a heading of their own leave it out and disappear instead.
 */
function Section({
  name,
  fallback = null,
  errorMessage,
  children,
}: {
  name: string;
  fallback?: ReactNode;
  errorMessage?: string;
  children: ReactNode;
}) {
  return (
    <SectionBoundary section={name} message={errorMessage}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SectionBoundary>
  );
}

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

      {/* Events near you — asks for location on open; shows events within 200km
          when allowed, otherwise all events. Client-rendered (needs geolocation). */}
      <SectionBoundary section="explore-events" message={EVENTS_ERROR}>
        <NearbyEvents />
      </SectionBoundary>

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
          <Section name="best-events" fallback={BEST_EVENTS_SKELETON} errorMessage={EVENTS_ERROR}>
            <BestEventsSection />
          </Section>
        </div>
      </section>

      {/* Stats — admin-editable "trusted users" counters, streamed */}
      <section className="container-page relative z-10 mt-6">
        <Section name="stats" fallback={<StatsGrid items={STATS_FALLBACK} />}>
          <StatsSection />
        </Section>
      </section>

      {/* Services / departments — tonal band for section rhythm */}
      <div className="mt-6 border-y bg-[rgb(var(--muted))]/60">
        <section id="services" className="container-page py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">
                  <T k="services.title" />
                </h2>
                <p className="mt-2 text-[rgb(var(--foreground))]/60">
                  <T k="services.subtitle" />
                </p>
              </div>
              <Link
                href="/services"
                className="shrink-0 whitespace-nowrap text-sm font-medium text-accent"
              >
                <T k="featured.viewAll" /> →
              </Link>
            </div>
          </Reveal>
          <Section name="services" fallback={SERVICES_SKELETON} errorMessage={SERVICES_ERROR}>
            <ServicesSection />
          </Section>
        </section>
      </div>

      {/* Function Halls & Venues */}
      <Section name="function-halls">
        <HallsSection />
      </Section>

      {/* Testimonials */}
      <Section name="testimonials">
        <TestimonialsSection />
      </Section>

      {/* FAQ */}
      <Section name="faq">
        <FaqSection />
      </Section>

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
  const { data, failed } = await serverRead<{ items?: StatItem[] }>('/cms/stats', {
    ...SECTION_READ,
    section: 'stats',
    tags: [CACHE_TAGS.cms],
    // null is valid: the admin hasn't configured stats yet.
    validate: (d) => d === null || isList((d as { items?: unknown }).items),
  });
  const items = data?.items?.length ? data.items : STATS_FALLBACK;
  return (
    <>
      <StatsGrid items={items} />
      {failed && <SectionRetry section="stats" />}
    </>
  );
}

async function ServicesSection() {
  const { data, failed } = await getDepartments();
  if (failed) {
    return (
      <SectionRetry section="services" message={SERVICES_ERROR} loading={SERVICES_SKELETON} />
    );
  }
  if (!data?.length) return <SectionEmpty message="No services available yet." />;
  return <ServicesGrid departments={data} />;
}

/** The department's best vendor if it has one, otherwise the department banner. */
function bestEventSlide(d: Department, v?: Vendor): BestEventSlide {
  return {
    category: d.name,
    icon: d.icon,
    image: v?.coverImage ?? d.banner,
    title: v?.name ?? d.name,
    description: v?.description ?? d.description,
    priceFrom: v ? Number(v.priceFrom) : undefined,
    href: v ? `/vendors/${v.slug}` : serviceHref(d.id),
    isBest: Boolean(v),
  };
}

async function BestEventsSection() {
  const [departments, featuredRes] = await Promise.all([
    getDepartments(),
    serverRead<{ data: Vendor[] }>('/vendors?featured=true&limit=50', {
      ...SECTION_READ,
      section: 'best-events',
      tags: [CACHE_TAGS.vendors],
      validate: isPage,
    }),
  ]);
  const depts = departments.data ?? [];
  const failed = departments.failed || featuredRes.failed;

  // One best (featured) vendor per category; first wins (dedupe legacy data).
  const bestByDept = new Map<string, Vendor>();
  for (const v of featuredRes.data?.data ?? []) {
    const dId = v.department?.id;
    if (dId && !bestByDept.has(dId)) bestByDept.set(dId, v);
  }

  // One slide per category. Either list alone can fill the slider, so a failure
  // of one of them still leaves something to show.
  const slides = depts.length
    ? depts.map((d) => bestEventSlide(d, bestByDept.get(d.id)))
    : Array.from(bestByDept.values()).map((v) => bestEventSlide(v.department!, v));

  if (!slides.length) {
    return failed ? (
      <SectionRetry section="best-events" message={EVENTS_ERROR} loading={BEST_EVENTS_SKELETON} />
    ) : (
      <SectionEmpty message="No events available yet." />
    );
  }
  return (
    <>
      <BestEventsSlider slides={slides} />
      {failed && <SectionRetry section="best-events" />}
    </>
  );
}

async function HallsSection() {
  const departments = await getDepartments();
  if (departments.failed) return <SectionRetry section="function-halls" />;
  const fhDept = departments.data?.find((d) => d.slug === 'function-halls');
  if (!fhDept) return null;
  const halls = await serverRead<{ data: Hall[] }>(`/vendors?departmentId=${fhDept.id}&limit=4`, {
    ...SECTION_READ,
    section: 'function-halls',
    tags: [CACHE_TAGS.vendors],
    validate: isPage,
  });
  if (halls.failed) return <SectionRetry section="function-halls" />;
  return <FunctionHallsSection halls={halls.data?.data ?? []} deptId={fhDept.id} />;
}

async function TestimonialsSection() {
  const { data, failed } = await serverRead<Testimonial[]>('/cms/testimonials', {
    ...SECTION_READ,
    section: 'testimonials',
    tags: [CACHE_TAGS.cms],
    validate: isList,
  });
  return (
    <>
      <Testimonials items={data ?? []} />
      <section className="container-page pb-10">
        <TestimonialForm />
      </section>
      {failed && <SectionRetry section="testimonials" />}
    </>
  );
}

async function FaqSection() {
  const { data, failed } = await serverRead<FaqItem[]>('/cms/faqs', {
    ...SECTION_READ,
    section: 'faq',
    tags: [CACHE_TAGS.cms],
    validate: isList,
  });
  if (failed) return <SectionRetry section="faq" />;
  return <Faq items={data ?? []} />;
}
