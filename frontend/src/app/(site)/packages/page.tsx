import Link from 'next/link';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { BackButton } from '@/shared/ui/back-button';
import { T } from '@/shared/i18n';
import { formatCurrency } from '@/shared/lib/utils';
import { Check } from 'lucide-react';

export const metadata = { title: 'Packages' };

// Render at request time (see homepage note) so packages always load live data
// rather than a page prerendered empty at build. Data is cached via `serverApi`.
export const dynamic = 'force-dynamic';

type Pkg = {
  id: string;
  name: string;
  price: string | number;
  features: string[];
  popular: boolean;
  vendorId: string;
};

export default async function PackagesPage() {
  const packages =
    (await serverApi<Pkg[]>('/packages', { tags: [CACHE_TAGS.packages] })) ?? [];

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back to home" />
      </div>
      <Reveal>
        <h1 className="text-4xl font-bold">
          <T k="packagesPage.title" />
        </h1>
        <p className="mt-2 text-[rgb(var(--foreground))]/60">
          <T k="packagesPage.subtitle" />
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => (
          <TiltCard
            key={p.id}
            className={`card h-full p-6 ${p.popular ? 'ring-2 ring-brand-500' : ''}`}
          >
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <div className="mt-2 text-3xl font-extrabold">
              {formatCurrency(Number(p.price))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={16} className="text-accent" /> {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/book?vendorId=${p.vendorId}&packageId=${p.id}`}
              className="btn-primary mt-6 w-full"
            >
              <T k="packagesPage.bookNow" />
            </Link>
          </TiltCard>
        ))}
        {packages.length === 0 && (
          <p className="text-[rgb(var(--foreground))]/50">No packages yet.</p>
        )}
      </div>
    </div>
  );
}
