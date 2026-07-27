'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';
import { Carousel } from '@/shared/ui/carousel';

export type Testimonial = {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  rating: number;
  message: string;
};

/** Presentational testimonial card, reused by the slider and the See-all page. */
export function TestimonialCard({ t: item }: { t: Testimonial }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      className="card flex h-full flex-col p-6"
    >
      <div className="flex items-center gap-1">
        {Array.from({ length: item.rating }).map((_, s) => (
          <Star key={s} size={14} className="fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="mt-3 flex-1 text-sm text-[rgb(var(--foreground))]/80">
        “<Tr>{item.message}</Tr>”
      </p>
      <div className="mt-5 flex items-center gap-3">
        {item.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.avatar} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
        )}
        <div>
          <div className="text-sm font-semibold">{item.name}</div>
          <div className="text-xs text-[rgb(var(--foreground))]/50">
            <Tr>{item.role}</Tr>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Home testimonials slider — shows up to 8 on desktop / 4 on mobile in a
 * carousel, with a "See all" link to the full /testimonials page.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const { t } = useI18n();
  const [limit, setLimit] = useState(8); // SSR/default: desktop

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setLimit(mq.matches ? 4 : 8);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!items.length) return null;
  const shown = items.slice(0, limit);

  return (
    <section className="container-page py-16">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-3xl font-bold">{t('testimonials.title')}</h2>
        <Link
          href="/testimonials"
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-accent"
        >
          {t('testimonials.seeAll')} <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="mt-10">
        <Carousel ariaLabel="Client testimonials" slideClassName="w-[80%] sm:w-[46%] lg:w-[31%]">
          {shown.map((item) => (
            <TestimonialCard key={item.id} t={item} />
          ))}
        </Carousel>
      </div>
    </section>
  );
}
