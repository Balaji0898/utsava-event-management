'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import en from '@/shared/i18n/locales/en.json';
import te from '@/shared/i18n/locales/te.json';

export type Locale = 'en' | 'te';
const dictionaries: Record<Locale, any> = { en, te };

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function resolve(dict: any, key: string): string {
  return key.split('.').reduce((acc, part) => acc?.[part], dict) ?? key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = (typeof window !== 'undefined' &&
      (localStorage.getItem('locale') as Locale)) as Locale | null;
    if (saved && dictionaries[saved]) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') localStorage.setItem('locale', l);
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string) => resolve(dictionaries[locale], key), [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

/** Convenience component: <T k="nav.home" /> — usable inside Server Components. */
export function T({ k }: { k: string }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}
