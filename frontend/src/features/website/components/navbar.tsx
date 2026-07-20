'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/shared/theme/theme-toggle';
import { LanguageToggle } from '@/shared/ui/language-toggle';
import { Logo } from '@/shared/ui/logo';
import { Magnetic } from '@/shared/motion/magnetic';
import { useI18n } from '@/shared/i18n';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useI18n();
  const pathname = usePathname();
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 20));

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/vendors', label: t('nav.vendors') },
    { href: '/packages', label: t('nav.packages') },
    { href: '/#services', label: t('nav.services') },
    { href: '/#contact', label: t('nav.contact') },
  ];

  const isActive = (href: string) => {
    if (href.includes('#')) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b glass shadow-sm' : 'bg-transparent'
      }`}
    >
      <nav className="container-page flex h-20 items-center justify-between">
        <Link href="/" aria-label="Utsava home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-[rgb(var(--foreground))]'
                    : 'link-underline text-[rgb(var(--foreground))]/75 hover:text-[rgb(var(--foreground))]'
                }`}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gold-gradient"
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Magnetic className="hidden md:block">
            <Link href="/book" className="btn-dark">
              {t('nav.bookNow')}
            </Link>
          </Magnetic>
          <button
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="border-t glass md:hidden"
        >
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-[rgb(var(--muted))]"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/book" onClick={() => setOpen(false)} className="btn-primary mt-2">
              {t('nav.bookNow')}
            </Link>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
