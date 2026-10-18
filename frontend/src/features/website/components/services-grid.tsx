import Link from 'next/link';
import { Stagger, StaggerItem } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { SafeImg } from '@/shared/ui/safe-img';
import { T } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';

export type Department = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  banner?: string;
  description?: string;
  _count?: { vendors: number };
};

/** URL of the vendor list filtered to one service (department). */
export function serviceHref(departmentId: string) {
  return `/vendors?departmentId=${departmentId}`;
}

/** One card per service; shared by the home "What We Create" section and /services. */
export function ServicesGrid({ departments }: { departments: Department[] }) {
  return (
    <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((d) => (
        <StaggerItem key={d.id}>
          <TiltCard className="card h-full overflow-hidden">
            <Link
              href={serviceHref(d.id)}
              data-testid={`service-card-${d.slug}`}
              className="flex h-full flex-col"
            >
              <div className="relative h-40 overflow-hidden">
                <SafeImg
                  src={d.banner}
                  alt={d.name}
                  width={400}
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
