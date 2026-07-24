'use client';

import Link from 'next/link';

/**
 * Site route error boundary — recovers gracefully instead of a blank screen if
 * a page/section throws while initializing. `reset()` re-renders the segment.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-[rgb(var(--foreground))]/60">
        We couldn&apos;t load this page. Please try again — if it keeps happening, refresh the page.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={() => reset()} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-ghost">
          Go home
        </Link>
      </div>
    </div>
  );
}
