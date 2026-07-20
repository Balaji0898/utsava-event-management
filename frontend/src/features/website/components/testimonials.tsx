'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useI18n } from '@/shared/i18n';

type Testimonial = {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  rating: number;
  message: string;
};

export function Testimonials({ items }: { items: Testimonial[] }) {
  const { t } = useI18n();
  if (!items.length) return null;

  return (
    <section className="container-page py-16">
      <h2 className="text-3xl font-bold">{t('testimonials.title')}</h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((tItem, i) => (
          <motion.div
            key={tItem.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.08 }}
            className="card h-full p-6"
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: tItem.rating }).map((_, s) => (
                <Star key={s} size={14} className="fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="mt-3 text-sm text-[rgb(var(--foreground))]/80">
              “{tItem.message}”
            </p>
            <div className="mt-5 flex items-center gap-3">
              {tItem.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tItem.avatar}
                  alt={tItem.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div>
                <div className="text-sm font-semibold">{tItem.name}</div>
                <div className="text-xs text-[rgb(var(--foreground))]/50">{tItem.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
