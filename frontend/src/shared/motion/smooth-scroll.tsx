'use client';

import { useEffect, type ReactNode } from 'react';
import Lenis from 'lenis';

const NAV_OFFSET = -88; // clear the sticky navbar (h-20)

/** Buttery smooth momentum scrolling (Lenis) + reliable in-page anchor scrolling. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Track pending timers so they can be cancelled on unmount (no work against
    // a destroyed Lenis, no dangling retry loops).
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    // Scroll to an id via Lenis, retrying while streamed sections mount.
    const scrollToId = (id: string) => {
      let tries = 0;
      const tick = () => {
        if (cancelled) return;
        const el = document.getElementById(id);
        if (el) {
          lenis.scrollTo(el, { offset: NAV_OFFSET });
        } else if (tries++ < 25) {
          later(tick, 150);
        }
      };
      tick();
    };

    // Intercept anchor clicks with a hash (e.g. /#services, /#faq, /#contact).
    // If the target is already on the page → scroll now (Lenis-aware, no jump to
    // top). If not (cross-page or not-yet-streamed) → let navigation happen and
    // retry-scroll once it mounts.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if (hashIndex === -1) return;
      const id = href.slice(hashIndex + 1);
      if (!id) return;

      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el, { offset: NAV_OFFSET });
        if (typeof history !== 'undefined') history.replaceState(null, '', href);
      } else {
        // Different page or streamed section — allow the navigation, then scroll.
        later(() => scrollToId(id), 250);
      }
    };
    document.addEventListener('click', onClick);

    // Deep-link / reload with a hash already in the URL.
    if (window.location.hash.length > 1) {
      later(() => scrollToId(window.location.hash.slice(1)), 300);
    }
    const onHashChange = () => {
      if (window.location.hash.length > 1) scrollToId(window.location.hash.slice(1));
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHashChange);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
