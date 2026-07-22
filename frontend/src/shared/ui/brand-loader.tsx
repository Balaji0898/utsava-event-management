'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/shared/i18n';

/**
 * The shared branded loading visual — gold diya monogram in a glowing tile with
 * an orbiting arc, a shimmering wordmark, and rotating status messages.
 * Reused by the route-transition loader (LoadingScreen) and the first-load
 * launch splash (LaunchScreen).
 */
export function BrandLoader() {
  const { t } = useI18n();
  const messages = [t('loading.m1'), t('loading.m2'), t('loading.m3'), t('loading.m4')];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % messages.length), 1800);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return (
    <div className="relative flex flex-col items-center text-center">
      {/* Monogram: glowing halo + slim orbiting arc around a gold tile */}
      <div className="relative flex h-[104px] w-[104px] items-center justify-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-brand-400/25 blur-2xl"
          animate={{ opacity: [0.3, 0.65, 0.3], scale: [0.85, 1.05, 0.85] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span aria-hidden className="absolute inset-1 rounded-full border border-brand-400/15" />
        <motion.span
          aria-hidden
          className="absolute inset-1 rounded-full border-2 border-transparent border-t-brand-400 border-r-brand-300/70"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.15, repeat: Infinity, ease: 'linear' }}
        />
        <motion.span
          className="relative flex h-[68px] w-[68px] items-center justify-center rounded-[1.35rem] bg-gold-gradient shadow-gold"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 24 24" width={36} height={36} fill="none" className="text-ink">
            <path
              d="M6 4v8a6 6 0 0 0 12 0V4"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M12 15.5c.9 0 1.7.9 1.7 1.9S12.9 20 12 20s-1.7-.6-1.7-1.6.8-2.9 1.7-2.9z"
              fill="currentColor"
            />
          </svg>
        </motion.span>
      </div>

      {/* Shimmering wordmark */}
      <div
        className="mt-8 bg-clip-text font-display text-[2rem] font-bold leading-none tracking-tight text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(100deg, #A9861F 0%, #D4AF37 35%, #F3E3AE 50%, #D4AF37 65%, #A9861F 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.6s linear infinite',
        }}
      >
        {t('loading.brand')}
      </div>
      <div className="mt-2 text-[0.7rem] font-medium uppercase tracking-[0.32em] text-[rgb(var(--foreground))]/45">
        {t('loading.tagline')}
      </div>

      {/* Rotating, meaningful status line */}
      <div className="mt-7 flex h-6 items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-sm text-[rgb(var(--foreground))]/55"
          >
            {messages[i]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Slim indeterminate track */}
      <div className="mt-5 h-[3px] w-56 overflow-hidden rounded-full bg-[rgb(var(--foreground))]/10">
        <motion.div
          className="h-full w-1/3 rounded-full bg-gold-gradient"
          animate={{ x: ['-110%', '330%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}
