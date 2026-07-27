'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight, Search, MapPin, CalendarDays, PartyPopper, Sparkles } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Magnetic } from '@/shared/motion/magnetic';

// WebGL scene — client only, never server-rendered.
const Hero3D = dynamic(() => import('@/features/website/components/hero-3d'), {
  ssr: false,
});

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80';

export function Hero() {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <section ref={ref} className="relative overflow-hidden hex-pattern">
      <div className="container-page relative py-4 sm:py-6">
        {/* Rounded hero card */}
        <div className="relative overflow-hidden rounded-[1.75rem] shadow-luxe sm:rounded-[2.5rem]">
          {/* parallax background image */}
          <motion.div style={{ y: imgY, scale: imgScale }} className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </motion.div>

          {/* real WebGL 3D gem (decorative, right side, desktop only) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 lg:block">
            <Hero3D />
          </div>

          {/* Content (natural flow — never overlaps) */}
          <div className="relative flex flex-col p-6 sm:p-10 lg:min-h-[560px] lg:justify-center lg:p-16">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur"
            >
              <Sparkles size={14} className="text-brand-300" /> {t('hero.badge')}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-5 max-w-3xl font-display text-3xl font-bold uppercase leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              {t('hero.titleA')}{' '}
              <span className="gold-text">{t('hero.titleHighlight')}</span>{' '}
              {t('hero.titleB')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-5 max-w-xl text-sm text-white/85 sm:text-base"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-6 flex flex-wrap gap-3"
            >
              <Magnetic>
                <Link href="/book" className="btn-primary">
                  {t('hero.ctaPrimary')}
                  <ArrowUpRight size={16} className="ml-1.5" />
                </Link>
              </Magnetic>
              <Link
                href="/vendors"
                className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t('hero.ctaSecondary')}
              </Link>
            </motion.div>

            {/* Detail / search bar — in normal flow, fully responsive */}
            <motion.form
              action="/vendors"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-8 flex flex-col gap-2 rounded-3xl bg-white/95 p-3 shadow-luxe backdrop-blur dark:bg-[#181410] sm:mt-10 lg:mt-12 lg:max-w-4xl lg:flex-row lg:items-center lg:gap-1"
            >
              <Field icon={<MapPin size={18} />} label={t('hero.place')}>
                <input
                  name="city"
                  placeholder={t('hero.searchPlaceholderPlace')}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[rgb(var(--foreground))]/40"
                />
              </Field>
              <Divider />
              <Field icon={<CalendarDays size={18} />} label={t('hero.dateFrom')}>
                {/* Starts as text so the placeholder shows (native date inputs
                    can't); becomes a date picker on focus. */}
                <input
                  name="date"
                  type="text"
                  placeholder={t('hero.datePlaceholder')}
                  onFocus={(e) => (e.currentTarget.type = 'date')}
                  onBlur={(e) => {
                    if (!e.currentTarget.value) e.currentTarget.type = 'text';
                  }}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[rgb(var(--foreground))]/40"
                />
              </Field>
              <Divider />
              <Field icon={<PartyPopper size={18} />} label={t('hero.event')}>
                <input
                  name="search"
                  placeholder={t('hero.searchPlaceholderEvent')}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[rgb(var(--foreground))]/40"
                />
              </Field>
              <button
                type="submit"
                aria-label="Search"
                className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink text-white transition hover:scale-[1.02] dark:bg-brand-500 dark:text-ink lg:h-14 lg:w-14"
              >
                <Search size={20} />
                <span className="lg:hidden">Search</span>
              </button>
            </motion.form>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 px-3 py-1.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--foreground))]/50">
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="hidden h-10 w-px bg-[rgb(var(--border))] lg:block" />;
}
