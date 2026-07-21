import Link from 'next/link';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal, LiftCard } from '@/shared/motion/primitives';
import { BackButton } from '@/shared/ui/back-button';
import { formatCurrency } from '@/shared/lib/utils';
import { Star, ShieldCheck } from 'lucide-react';

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
  searchParams: { departmentId?: string; search?: string; city?: string; page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const qs = new URLSearchParams();
  if (searchParams.departmentId) qs.set('departmentId', searchParams.departmentId);
  if (searchParams.search) qs.set('search', searchParams.search);
  if (searchParams.city) qs.set('city', searchParams.city);
  qs.set('limit', String(PAGE_SIZE));
  qs.set('page', String(page));

  const res = await serverApi<{ data: Vendor[]; total: number; pages: number }>(
    `/vendors?${qs.toString()}`,
    { tags: [CACHE_TAGS.vendors] },
  );
  const vendors = res?.data ?? [];
  const pages = res?.pages ?? 1;

  // build href for a given page, preserving filters
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (searchParams.departmentId) q.set('departmentId', searchParams.departmentId);
    if (searchParams.search) q.set('search', searchParams.search);
    if (searchParams.city) q.set('city', searchParams.city);
    q.set('page', String(p));
    return `/vendors?${q.toString()}`;
  };

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <Reveal>
        <h1 className="text-4xl font-bold">Vendors</h1>
        <p className="mt-2 text-[rgb(var(--foreground))]/60">
          {res?.total ?? 0} vendors available. Filter by department from the home page.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.map((v) => (
          <LiftCard key={v.id} className="card h-full overflow-hidden">
            <Link href={`/vendors/${v.slug}`}>
              <div className="h-40 overflow-hidden">
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
                    {v.rating}
                  </span>
                </div>
                <h3 className="mt-2 flex items-center gap-1 text-lg font-semibold">
                  {v.name}
                  {v.verified && <ShieldCheck size={16} className="text-brand-500" />}
                </h3>
                <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--foreground))]/60">
                  {v.description}
                </p>
                <div className="mt-4 text-sm">
                  From <span className="font-bold">{formatCurrency(Number(v.priceFrom))}</span>
                </div>
              </div>
            </Link>
          </LiftCard>
        ))}
        {vendors.length === 0 && (
          <p className="text-[rgb(var(--foreground))]/50">No vendors found.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
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
        </div>
      )}
    </div>
  );
}
