'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/shared/i18n';
import { BrandMark } from '@/shared/ui/brand-mark';

/**
 * Shared branded loading visual — the animated gold diya-U mark, the Utsava
 * wordmark, and rotating status messages. Used by the route-transition loader.
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
      <BrandMark size={104} animated />

      <div
        className="mt-6 text-2xl font-semibold uppercase tracking-[0.2em] text-[rgb(var(--foreground))]"
        style={{ fontFamily: "var(--font-brand, 'Cinzel', Georgia, serif)" }}
      >
        Utsava
      </div>

      <div className="mt-4 flex h-6 items-center">
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
