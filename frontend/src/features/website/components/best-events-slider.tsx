'use client';

import Link from 'next/link';
import { Award, ArrowUpRight } from 'lucide-react';
import { Carousel } from '@/shared/ui/carousel';
import { formatCurrency } from '@/shared/lib/utils';

export type BestEventSlide = {
  category: string;
  icon?: string;
  image?: string;
  title: string;
  description?: string;
  priceFrom?: number;
  href: string;
  isBest: boolean;
};

/**
 * Home "Best Events" slider — one slide per category, showcasing that
 * category's best (featured) vendor, with a banner fallback so every category
 * still appears with an image + content.
 */
export function BestEventsSlider({ slides }: { slides: BestEventSlide[] }) {
  if (!slides.length) return null;

  return (
    <Carousel ariaLabel="Best events by category" slideClassName="w-[85%] sm:w-[55%] lg:w-[38%]">
      {slides.map((s, i) => (
        <Link key={i} href={s.href} className="group block h-full">
          <div className="card h-full overflow-hidden">
            <div className="relative h-56 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image ?? ''}
                alt={s.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              {s.isBest && (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-gold-gradient px-3 py-1 text-xs font-semibold text-ink shadow-gold">
                  <Award size={12} /> Best Event
                </span>
              )}
              <div className="absolute inset-x-4 bottom-4 text-white">
                <span className="text-xs font-medium text-brand-200">
                  {s.icon} {s.category}
                </span>
                <h3 className="mt-1 font-display text-xl font-bold leading-tight">{s.title}</h3>
              </div>
            </div>
            <div className="p-5">
              {s.description && (
                <p className="line-clamp-2 text-sm text-[rgb(var(--foreground))]/60">
                  {s.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between text-sm">
                {typeof s.priceFrom === 'number' && s.priceFrom > 0 ? (
                  <span className="text-[rgb(var(--foreground))]/70">
                    From <span className="font-bold">{formatCurrency(s.priceFrom)}</span>
                  </span>
                ) : (
                  <span />
                )}
                <span className="inline-flex items-center gap-1 font-medium text-brand-500">
                  Explore <ArrowUpRight size={15} />
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </Carousel>
  );
}
