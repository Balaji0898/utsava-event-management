'use client';

import { BrandLoader } from '@/shared/ui/brand-loader';

/**
 * Route-transition loading fallback (Next.js `loading.tsx`). Renders the shared
 * branded loader within the page area (below the navbar).
 */
export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex min-h-[78vh] w-full items-center justify-center overflow-hidden px-6"
    >
      <div className="bg-hero-gradient pointer-events-none absolute inset-0 opacity-70" />
      <div className="hex-pattern pointer-events-none absolute inset-0 opacity-[0.12]" />
      <BrandLoader />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
