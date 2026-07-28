'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Phone, MessageCircle, Mail, MapPin } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { Logo } from '@/shared/ui/logo';
import { site, telHref, whatsappHref, mailHref } from '@/shared/config/site';
import { useSiteContact } from '@/shared/config/site-contact-context';
import { Tr } from '@/shared/i18n/tr';

export function Footer() {
  const { t } = useI18n();
  const contact = useSiteContact();
  return (
    <footer data-testid="footer-root" className="mt-24 border-t hex-pattern">
      <div className="container-page grid gap-10 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo />
          <p className="mt-4 text-sm text-[rgb(var(--foreground))]/60">{t('footer.tagline')}</p>
        </div>

        <FooterCol
          title={t('footer.explore')}
          links={[
            [t('nav.vendors'), '/vendors'],
            [t('nav.packages'), '/packages'],
            [t('nav.book'), '/book'],
          ]}
        />
        <FooterCol
          title={t('footer.company')}
          links={[
            [t('nav.services'), '/#services'],
            [<Tr key="t">Testimonials</Tr>, '/testimonials'],
            [<Tr key="f">FAQ</Tr>, '/#faq'],
            [<Tr key="p">Privacy</Tr>, '/privacy'],
            [<Tr key="tm">Terms</Tr>, '/terms'],
          ]}
        />

        {/* Contact */}
        <div>
          <h4 className="mb-3 text-sm font-semibold">{t('footer.contact')}</h4>
          <div className="text-sm text-[rgb(var(--foreground))]/70">
            <div className="font-display text-base font-semibold text-[rgb(var(--foreground))]">
              {contact.manager}
            </div>
            <div className="text-xs text-accent">
              <Tr>{contact.role}</Tr>
            </div>
            <a
              href={telHref(contact.phone)}
              data-testid="footer-phone"
              className="mt-3 flex items-center gap-2 hover:text-[rgb(var(--accent))]"
            >
              <Phone size={15} aria-hidden /> {contact.phoneDisplay}
            </a>
            <a href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 hover:text-[rgb(var(--accent))]">
              <MessageCircle size={15} aria-hidden /> <Tr>WhatsApp</Tr>
            </a>
            <a
              href={mailHref(contact.email)}
              data-testid="footer-email"
              className="mt-2 flex items-center gap-2 hover:text-[rgb(var(--accent))]"
            >
              <Mail size={15} aria-hidden /> {contact.email}
            </a>
            <div className="mt-2 flex items-center gap-2">
              <MapPin size={15} aria-hidden /> <Tr>Bengaluru · Hyderabad · Chennai</Tr>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t py-6 text-center text-sm text-[rgb(var(--foreground))]/50">
        © {new Date().getFullYear()} {site.name}. {t('footer.rights')}
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [ReactNode, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2 text-sm text-[rgb(var(--foreground))]/60">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="hover:text-[rgb(var(--accent))]">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
