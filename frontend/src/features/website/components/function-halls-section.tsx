'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { MapPin, Users, ArrowUpRight, Star } from 'lucide-react';
import { TiltCard } from '@/shared/motion/tilt-card';
import { formatCurrency } from '@/shared/lib/utils';
import { Tr } from '@/shared/i18n/tr';

const Hero3D = dynamic(() => import('@/features/website/components/hero-3d'), {
  ssr: false,
});

export type Hall = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  location?: string;
  rating: number;
  priceFrom: string | number;
  priceTo: string | number;
};

function capacityOf(description?: string): string | null {
  const m = description?.match(/Capacity:\s*(\d+)/i);
  return m ? `${m[1]} guests` : null;
}

export function FunctionHallsSection({
  halls,
  deptId,
}: {
  halls: Hall[];
  deptId?: string;
}) {
  if (!halls.length) return null;

  return (
    <section id="function-halls" className="container-page py-16">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gem panel */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative flex flex-col overflow-hidden rounded-[2.5rem] border bg-ink p-8 text-white"
        >
          {/* Hex pattern as an overlay child so it decorates the ink panel
             instead of clobbering its background-color (the unlayered
             .hex-pattern rule sets background:transparent and would otherwise
             win over the layered bg-ink utility, hiding the white text in
             light mode). */}
          <div className="hex-pattern pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative pointer-events-none mx-auto h-48 w-48">
            <Hero3D />
          </div>
          <div className="relative mt-auto">
            <span className="text-3xl">🏛️</span>
            <h2 className="mt-2 font-display text-3xl font-bold">Function Halls &amp; Venues</h2>
            <p className="mt-2 text-sm text-white/70">
              Banquet halls, convention centres and lawns for every celebration — with
              transparent per-day price ranges.
            </p>
            <Link
              href={deptId ? `/vendors?departmentId=${deptId}` : '/vendors'}
              className="btn-primary mt-6"
            >
              View all venues <ArrowUpRight size={16} className="ml-1.5" />
            </Link>
          </div>
        </motion.div>

        {/* Venue cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
          {halls.map((h) => {
            const cap = capacityOf(h.description);
            return (
              <TiltCard key={h.id} className="card h-full overflow-hidden">
                <Link href={`/vendors/${h.slug}`}>
                  <div className="relative h-40 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.coverImage ?? ''} alt={h.name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-3 left-4 flex items-center gap-1 text-xs font-medium text-white">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" /> {h.rating}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg font-semibold">{h.name}</h3>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[rgb(var(--foreground))]/60">
                      {h.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} /> <Tr>{h.location}</Tr>
                        </span>
                      )}
                      {cap && (
                        <span className="flex items-center gap-1">
                          <Users size={13} /> {cap}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 text-sm">
                      <span className="text-[rgb(var(--foreground))]/60">Per day: </span>
                      <span className="font-bold">
                        {formatCurrency(Number(h.priceFrom))} – {formatCurrency(Number(h.priceTo))}
                      </span>
                    </div>
                  </div>
                </Link>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
