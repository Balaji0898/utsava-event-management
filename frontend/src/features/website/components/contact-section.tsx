'use client';

import { motion } from 'framer-motion';
import { Phone, MessageCircle, Mail, Sparkles } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { site, telHref, whatsappHref, mailHref } from '@/shared/config/site';

export function ContactSection() {
  const { t } = useI18n();
  return (
    <section id="contact" className="container-page py-20">
      <div className="relative overflow-hidden rounded-[2.5rem] border bg-ink text-white shadow-luxe">
        <div className="absolute inset-0 hex-pattern opacity-40" />
        <div className="relative grid gap-10 p-10 md:grid-cols-2 md:p-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium">
              <Sparkles size={14} className="text-brand-300" /> {site.tagline}
            </span>
            <h2 className="mt-5 font-display text-4xl font-bold">{t('contact.title')}</h2>
            <p className="mt-3 max-w-md text-white/70">{t('contact.subtitle')}</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-white/[0.06] p-8 backdrop-blur"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient text-2xl font-bold text-ink">
                {site.contact.manager.charAt(0)}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-brand-300">
                  {t('contact.manager')}
                </div>
                <div className="font-display text-2xl font-bold">{site.contact.manager}</div>
                <div className="text-sm text-white/60">{site.contact.role}</div>
              </div>
            </div>

            <div className="mt-8 grid gap-3">
              <a
                href={telHref}
                className="btn-primary w-full flex-wrap justify-center gap-x-2 gap-y-0.5 px-4 text-center"
              >
                <span className="inline-flex items-center gap-2">
                  <Phone size={16} className="shrink-0" /> {t('contact.call')}
                </span>
                <span aria-hidden className="hidden opacity-60 sm:inline">
                  ·
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {site.contact.phoneDisplay}
                </span>
              </a>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={whatsappHref}
                  target="_blank"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  <MessageCircle size={16} className="mr-2" /> {t('contact.whatsapp')}
                </a>
                <a
                  href={mailHref}
                  className="inline-flex items-center justify-center rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Mail size={16} className="mr-2" /> {t('contact.email')}
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
