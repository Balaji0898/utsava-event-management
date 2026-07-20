'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  LayoutTemplate,
  LogOut,
} from 'lucide-react';
import { auth } from '@/shared/lib/api';
import { cn } from '@/shared/lib/utils';
import { Logo } from '@/shared/ui/logo';

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/departments', label: 'Departments', icon: Building2 },
  { href: '/admin/vendors', label: 'Vendors', icon: Users },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/admin/cms', label: 'CMS', icon: LayoutTemplate },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r p-4 md:flex hex-pattern">
      <Link href="/admin" className="mb-8 px-2 pt-2">
        <Logo />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((n) => {
          const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} className="relative">
              {active && (
                <motion.span
                  layoutId="active-nav"
                  className="absolute inset-0 rounded-xl bg-gold-gradient shadow-gold"
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'text-ink'
                    : 'text-[rgb(var(--foreground))]/70 hover:bg-[rgb(var(--muted))]',
                )}
              >
                <n.icon size={18} /> {n.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => {
          auth.logout();
          router.push('/login');
        }}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
      >
        <LogOut size={18} /> Logout
      </button>
    </aside>
  );
}
