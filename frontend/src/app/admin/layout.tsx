'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/features/admin/components/sidebar';
import { ThemeToggle } from '@/shared/theme/theme-toggle';
import { BackButton } from '@/shared/ui/back-button';
import { api, auth } from '@/shared/lib/api';

// Small WebGL gold gem — client only.
const Hero3D = dynamic(() => import('@/features/website/components/hero-3d'), {
  ssr: false,
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isSubPage = pathname !== '/admin';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = auth.currentUser();
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      router.replace('/login');
      return;
    }
    // Validate the session with the API. If the access token expired during
    // inactivity, api() transparently refreshes it; only a dead refresh token
    // (or a non-admin) sends us back to login.
    let active = true;
    api('/auth/me', { auth: true })
      .then((me: any) => {
        if (!active) return;
        if (me && ['ADMIN', 'SUPER_ADMIN'].includes(me.role)) {
          setReady(true);
        } else {
          router.replace('/login');
        }
      })
      .catch(() => {
        if (active) router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-hero-gradient">
        {/* Hex pattern as an overlay so it layers over the gradient instead of
           replacing it (the unlayered .hex-pattern rule would otherwise win
           over the bg-hero-gradient utility). */}
        <div className="hex-pattern pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative h-16 w-16">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
          <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold gold-text">
            U
          </span>
        </div>
        <p
          role="status"
          data-testid="admin-loading"
          className="relative font-display text-sm tracking-wide text-[rgb(var(--foreground))]/60"
        >
          Loading Utsava dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" data-testid="admin-shell">
      <Sidebar />
      <div className="flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b px-6 glass">
          <div className="flex items-center gap-3">
            {isSubPage && <BackButton fallback="/admin" label="Back" className="hidden sm:inline-flex" />}
            {/* Decorative WebGL gem — no text alternative to give, so hide it from AT. */}
            <div aria-hidden className="pointer-events-none h-11 w-11 shrink-0">
              <Hero3D />
            </div>
            <h1 className="font-display font-semibold">Admin Dashboard</h1>
          </div>
          <ThemeToggle />
        </header>
        {/* A real landmark, so the dashboard content is reachable by region navigation
            (axe `region`) rather than being an unlabelled div. */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
