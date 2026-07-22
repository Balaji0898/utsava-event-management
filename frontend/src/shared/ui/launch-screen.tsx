'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLoader } from '@/shared/ui/brand-loader';

const SESSION_KEY = 'utsava_launched';
const MIN_DURATION_MS = 1200; // let the animation be seen
const SAFETY_MS = 6000; // never hang the splash forever

/**
 * First-load launch splash: a full-viewport branded animation shown once per
 * browser session while the page finishes loading, then fades to the content.
 *
 * Rendered on every full document load (SSR + hydration) so it covers before
 * paint. A blocking inline script in the root layout sets `data-launched` on
 * <html> when the session flag exists, and CSS hides `#launch-overlay` in that
 * case — so repeat loads within a session show no splash and no flash.
 */
export function LaunchScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Already shown this session → remove immediately (CSS already hid it).
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      setVisible(false);
      return;
    }

    const start = Date.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const remaining = Math.max(0, MIN_DURATION_MS - (Date.now() - start));
      window.setTimeout(() => setVisible(false), remaining);
    };

    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    const safety = window.setTimeout(finish, SAFETY_MS);

    return () => {
      window.removeEventListener('load', finish);
      window.clearTimeout(safety);
    };
  }, []);

  const handleExitComplete = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-launched', '');
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && (
        <motion.div
          id="launch-overlay"
          role="status"
          aria-live="polite"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[rgb(var(--background))] px-6"
        >
          <div className="bg-hero-gradient pointer-events-none absolute inset-0 opacity-70" />
          <div className="hex-pattern pointer-events-none absolute inset-0 opacity-[0.12]" />
          <BrandLoader />
          <span className="sr-only">Loading…</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
