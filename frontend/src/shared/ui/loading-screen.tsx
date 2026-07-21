'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/shared/i18n';

/**
 * Branded, full-area loading splash shown while a page fetches its data.
 * Design is kept in sync with the site: gold diya monogram, champagne glow,
 * an orbiting gold ring and rotating "what we're doing" messages so the wait
 * feels intentional instead of blank.
 */
export function LoadingScreen() {
  const { t } = useI18n();
  const messages = [t('loading.m1'), t('loading.m2'), t('loading.m3'), t('loading.m4')];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % messages.length), 1600);
    return () => clearInterval(id);
    // messages length is stable; re-running on locale change is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      {/* soft champagne glow + hex texture, matching the site's palette */}
      <div className="bg-hero-gradient pointer-events-none absolute inset-0 opacity-70" />
      <div className="hex-pattern pointer-events-none absolute inset-0 opacity-30" />

      <div className="relative flex flex-col items-center">
        {/* Orbiting gold ring around the diya monogram */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-400 border-r-brand-300"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            aria-hidden
            className="absolute inset-2 rounded-full border border-brand-500/20"
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.span
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-gradient shadow-gold"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg viewBox="0 0 24 24" width={34} height={34} fill="none" className="text-ink">
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

        <div className="mt-7 font-display text-2xl font-bold tracking-tight">
          {t('loading.brand')}
        </div>
        <div className="mt-1 text-xs uppercase tracking-[0.25em] text-brand-500">
          {t('loading.tagline')}
        </div>

        {/* Rotating, meaningful status line */}
        <div className="mt-6 h-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm text-[rgb(var(--foreground))]/60"
            >
              {messages[i]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Indeterminate gold progress bar */}
        <div className="mt-5 h-1 w-52 overflow-hidden rounded-full bg-[rgb(var(--muted))]">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gold-gradient"
            animate={{ x: ['-120%', '320%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
