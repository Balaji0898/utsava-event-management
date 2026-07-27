'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/shared/i18n';
import { translateText } from '@/shared/i18n/translate';

/**
 * Live-translate a dynamic (backend-sourced) string to the current locale.
 * Renders the original text first (so SSR === first client render → no
 * hydration mismatch), then swaps to the translation once resolved. English
 * (or empty) is returned as-is with no network call.
 */
export function useTranslated(text: string | undefined | null): string {
  const { locale } = useI18n();
  const original = text ?? '';
  const [value, setValue] = useState(original);

  useEffect(() => {
    let alive = true;
    if (!original || locale === 'en') {
      setValue(original);
      return;
    }
    translateText(original, locale).then((t) => {
      if (alive) setValue(t);
    });
    return () => {
      alive = false;
    };
  }, [original, locale]);

  return value;
}

/** Component form: <Tr>{dynamicString}</Tr> — droppable into server or client trees. */
export function Tr({ children }: { children: string | undefined | null }) {
  return <>{useTranslated(children)}</>;
}
