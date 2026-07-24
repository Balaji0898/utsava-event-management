'use client';

import { useEffect, useState } from 'react';
import { BrandMark } from '@/shared/ui/brand-mark';

const SESSION_KEY = 'utsava_launched';
// A little after the CSS fade completes (1.8s delay + 0.6s fade) — then unmount.
const REMOVE_MS = 2600;

/**
 * First-load launch splash. The overlay is server-rendered on a cinematic dark
 * stage and animated purely with CSS (the glowing gold diya-U mark + a
 * shimmering Cinzel wordmark), so it paints on the first byte and keeps
 * animating even while the JS main thread is busy hydrating — and it fades
 * itself out via CSS, so it can never hang waiting for JS or `window.load`.
 *
 * The session flag is set on mount, so a hard refresh mid-intro won't re-show
 * (or re-trap) the splash. A blocking inline script in the root layout sets
 * `data-launched` on <html> (CSS then hides the overlay with no flash).
 */
export function LaunchScreen() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let already = false;
    try {
      already = Boolean(sessionStorage.getItem(SESSION_KEY));
      sessionStorage.setItem(SESSION_KEY, '1'); // mark immediately (survives a mid-intro refresh)
    } catch {
      /* ignore */
    }
    if (already) {
      document.documentElement.setAttribute('data-launched', '');
      setGone(true);
      return;
    }
    const t = window.setTimeout(() => {
      document.documentElement.setAttribute('data-launched', '');
      setGone(true);
    }, REMOVE_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div id="launch-overlay" className="launch-overlay" role="status" aria-live="polite">
      <div className="launch-overlay__bg" aria-hidden />
      <div className="launch-overlay__inner">
        <BrandMark size={128} animated />
        <div className="launch-wordmark">Utsava</div>
        <div className="launch-tagline">Every moment, a celebration</div>
        <div className="launch-bar">
          <span className="launch-bar__fill" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
