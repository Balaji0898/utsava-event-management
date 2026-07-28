import Link from 'next/link';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { BackButton } from '@/shared/ui/back-button';
import { formatCurrency } from '@/shared/lib/utils';
import { Tr } from '@/shared/i18n/tr';
import { Star, ShieldCheck, MapPin } from 'lucide-react';

export const metadata = { title: 'Vendors' };

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
  department?: { name: string };
};

const PAGE_SIZE = 12;

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: {
    departmentId?: string;
    search?: string;
    city?: string;
    page?: string;
    lat?: string;
    lng?: string;
  };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined;
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined;
  const nearMe = lat != null && !Number.isNaN(lat) && lng != null && !Number.isNaN(lng);

  const qs = new URLSearchParams();
  if (searchParams.departmentId) qs.set('departmentId', searchParams.departmentId);
  if (searchParams.search) qs.set('search', searchParams.search);
  if (searchParams.city) qs.set('city', searchParams.city);
  if (nearMe) {
    qs.set('lat', String(lat));
    qs.set('lng', String(lng));
  }
  qs.set('limit', String(PAGE_SIZE));
  qs.set('page', String(page));

  let res = await serverApi<{ data: Vendor[]; total: number; pages: number }>(
    `/vendors?${qs.toString()}`,
    { tags: [CACHE_TAGS.vendors] },
  );

  // "Near me" with no nearby events → fall back to showing all events, and tell
  // the user why. When events *are* nearby, note that too.
  const noneNearby = nearMe && (res?.total ?? 0) === 0;
  if (noneNearby) {
    const fq = new URLSearchParams();
    fq.set('limit', String(PAGE_SIZE));
    fq.set('page', String(page));
    res = await serverApi<{ data: Vendor[]; total: number; pages: number }>(
      `/vendors?${fq.toString()}`,
      { tags: [CACHE_TAGS.vendors] },
    );
  }
  const vendors = res?.data ?? [];
  const pages = res?.pages ?? 1;
  const locationNotice = nearMe
    ? noneNearby
      ? 'No events found near your location — showing all events instead.'
      : 'Showing events near your current location.'
    : null;

  // build href for a given page, preserving filters. Only keep lat/lng while
  // there are nearby results — once we've fallen back to all events, paging
  // shouldn't re-trigger the (empty) proximity query.
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (searchParams.departmentId) q.set('departmentId', searchParams.departmentId);
    if (searchParams.search) q.set('search', searchParams.search);
    if (searchParams.city) q.set('city', searchParams.city);
    if (nearMe && !noneNearby) {
      q.set('lat', String(lat));
      q.set('lng', String(lng));
    }
    q.set('page', String(p));
    return `/vendors?${q.toString()}`;
  };

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <Reveal>
        <h1 className="text-4xl font-bold">
          <Tr>Vendors</Tr>
        </h1>
        <p data-testid="vendors-count" className="mt-2 text-[rgb(var(--foreground))]/60">
          <Tr>{`${res?.total ?? 0} vendors available. Filter by department from the home page.`}</Tr>
        </p>
        {locationNotice && (
          <p
            data-testid="vendors-proximity-notice"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent"
          >
            <MapPin size={14} aria-hidden />
            <Tr>{locationNotice}</Tr>
          </p>
        )}
      </Reveal>

      <div data-testid="vendors-list" className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <TiltCard key={v.id} className="card h-full overflow-hidden">
            <Link
              href={`/vendors/${v.slug}`}
              data-testid={`vendors-card-${v.slug}`}
              className="flex h-full flex-col"
            >
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.coverImage ?? ''}
                  alt={v.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-accent">
                    <Tr>{v.department?.name}</Tr>
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    {v.rating}
                  </span>
                </div>
                <h3 className="mt-2 flex items-center gap-1 text-lg font-semibold">
                  {v.name}
                  {v.verified && <ShieldCheck size={16} className="text-accent" />}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--foreground))]/60">
                  <Tr>{v.description}</Tr>
                </p>
                <div className="mt-auto pt-4 text-sm">
                  From <span className="font-bold">{formatCurrency(Number(v.priceFrom))}</span>
                </div>
              </div>
            </Link>
          </TiltCard>
        ))}
        {vendors.length === 0 && (
          <p data-testid="vendors-empty" className="text-[rgb(var(--foreground))]/50">
            <Tr>No vendors found.</Tr>
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav
          aria-label="Pagination"
          data-testid="vendors-pagination"
          className="mt-10 flex items-center justify-center gap-2"
        >
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="btn-ghost px-4 py-2 text-sm">
              ← Prev
            </Link>
          )}
          {Array.from({ length: pages }).map((_, i) => {
            const p = i + 1;
            return (
              <Link
                key={p}
                href={pageHref(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-sm font-medium ${
                  p === page ? 'border-transparent bg-brand-500 text-ink' : 'hover:bg-[rgb(var(--muted))]'
                }`}
              >
                {p}
              </Link>
            );
          })}
          {page < pages && (
            <Link href={pageHref(page + 1)} className="btn-ghost px-4 py-2 text-sm">
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
