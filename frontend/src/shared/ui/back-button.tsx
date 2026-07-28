'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useTranslated } from '@/shared/i18n/tr';

/**
 * In-app back navigation. Uses router history when available,
 * otherwise falls back to a provided href (default: home).
 */
export function BackButton({
  fallback = '/',
  label = 'Back',
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const translatedLabel = useTranslated(label);

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={goBack}
      data-testid="back-button"
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[rgb(var(--muted))] ${className ?? ''}`}
    >
      <ArrowLeft size={16} aria-hidden /> {translatedLabel}
    </button>
  );
}
