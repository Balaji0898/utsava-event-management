'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { defaultContact, type SiteContact } from '@/shared/config/site';

const SiteContactContext = createContext<SiteContact>(defaultContact);

/**
 * Provides the (admin-editable) contact details to the site. The server layout
 * fetches them from the CMS and passes them here; any missing field falls back
 * to the static defaults.
 */
export function SiteContactProvider({
  value,
  children,
}: {
  value?: Partial<SiteContact> | null;
  children: ReactNode;
}) {
  const merged: SiteContact = { ...defaultContact, ...(value ?? {}) };
  return <SiteContactContext.Provider value={merged}>{children}</SiteContactContext.Provider>;
}

export function useSiteContact() {
  return useContext(SiteContactContext);
}
