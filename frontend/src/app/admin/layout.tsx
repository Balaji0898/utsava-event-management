'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Sidebar } from '@/features/admin/components/sidebar';
import { ThemeToggle } from '@/shared/theme/theme-toggle';
import { BackButton } from '@/shared/ui/back-button';
import { auth } from '@/shared/lib/api';

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
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hero-gradient hex-pattern">
        <div className="relative h-16 w-16">
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
          <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold gold-text">
            U
          </span>
        </div>
        <p className="font-display text-sm tracking-wide text-[rgb(var(--foreground))]/60">
          Loading Utsava dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b px-6 glass">
          <div className="flex items-center gap-3">
            {isSubPage && <BackButton fallback="/admin" label="Back" className="hidden sm:inline-flex" />}
            <div className="pointer-events-none h-11 w-11 shrink-0">
              <Hero3D />
            </div>
            <h1 className="font-display font-semibold">Admin Dashboard</h1>
          </div>
          <ThemeToggle />
        </header>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
