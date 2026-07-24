'use client';

import { useRouter } from 'next/navigation';

/** Admin route error boundary — recover instead of a blank dashboard. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hero-gradient px-6 text-center hex-pattern">
      <h1 className="font-display text-2xl font-bold">Dashboard error</h1>
      <p className="max-w-md text-sm text-[rgb(var(--foreground))]/60">
        Something went wrong loading the admin dashboard.
      </p>
      <div className="flex gap-3">
        <button onClick={() => reset()} className="btn-primary">
          Try again
        </button>
        <button onClick={() => router.push('/login')} className="btn-ghost">
          Back to login
        </button>
      </div>
    </div>
  );
}
