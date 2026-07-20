'use client';

import { Languages } from 'lucide-react';
import { useI18n, type Locale } from '@/shared/i18n';

const LABELS: Record<Locale, string> = { en: 'EN', te: 'తె' };

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      aria-label="Switch language"
      onClick={() => setLocale(locale === 'en' ? 'te' : 'en')}
      className="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors hover:bg-[rgb(var(--muted))]"
    >
      <Languages size={16} />
      {LABELS[locale]}
    </button>
  );
}
