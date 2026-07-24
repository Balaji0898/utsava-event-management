'use client';

import { useEffect, useState } from 'react';

const SESSION_KEY = 'utsava_launched';
// A little after the CSS fade completes (1.8s delay + 0.6s fade) — then unmount.
const REMOVE_MS = 2600;

/**
 * First-load launch splash. The overlay is server-rendered and animated purely
 * with CSS (see .launch-* in globals.css), so it paints on the first byte and
 * keeps animating even while the JS main thread is busy hydrating — and it
 * fades itself out via CSS, so it never hangs waiting for JS or `window.load`.
 *
 * The tiny bit of JS here only: (1) skips instantly if already shown this
 * session, and (2) marks the session shown + unmounts after the fade. A
 * blocking inline script in the root layout sets `data-launched` on <html>
 * (which CSS uses to hide the overlay with no flash) on repeat loads.
 */
export function LaunchScreen() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Already shown this session → remove immediately (CSS already hid it).
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      setGone(true);
      return;
    }
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      document.documentElement.setAttribute('data-launched', '');
      setGone(true);
    }, REMOVE_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (gone) return null;

  return (
    <div id="launch-overlay" className="launch-overlay" role="status" aria-live="polite">
      <div className="launch-overlay__bg" aria-hidden />
      <div className="hex-pattern pointer-events-none absolute inset-0 opacity-[0.12]" aria-hidden />
      <div className="launch-overlay__inner">
        <div className="launch-monogram">
          <span className="launch-halo" aria-hidden />
          <span className="launch-ring-track" aria-hidden />
          <span className="launch-ring" aria-hidden />
          <span className="launch-tile">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" style={{ color: '#141210' }}>
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
          </span>
        </div>
        <div className="launch-wordmark">Utsava</div>
        <div className="launch-tagline">Where Every Moment Becomes a Festival</div>
        <div className="launch-bar">
          <span className="launch-bar__fill" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
