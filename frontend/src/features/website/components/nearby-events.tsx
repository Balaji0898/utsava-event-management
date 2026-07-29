'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Star, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { getCurrentPosition, reverseGeocode } from '@/shared/lib/geo';
import { formatCurrency } from '@/shared/lib/utils';
import { useI18n } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';
import { NEARBY_RADIUS_KM } from '@/shared/config/site';

const LIMIT = 8;

type Vendor = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  rating: number;
  priceFrom: string | number;
  verified: boolean;
  department?: { name: string };
};

type Mode = 'locating' | 'nearby' | 'all';

/**
 * On mount, asks the browser for the user's location. If granted, shows events
 * within NEARBY_RADIUS_KM of the user (falling back to all events if none are
 * close); if denied/unavailable, shows all available events. The permission
 * prompt therefore appears automatically when the site opens.
 */
export function NearbyEvents() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('locating');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [city, setCity] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function fetchList(query: string): Promise<Vendor[]> {
      const res = await api<{ data: Vendor[]; total: number }>(query).catch(() => null);
      return res?.data ?? [];
    }

    async function run() {
      const pos = await getCurrentPosition(); // triggers the browser permission prompt

      if (pos.ok) {
        const near = await fetchList(
          `/vendors?lat=${pos.lat}&lng=${pos.lng}&radius=${NEARBY_RADIUS_KM}&limit=${LIMIT}`,
        );
        if (cancelled) return;
        if (near.length > 0) {
          setVendors(near);
          setMode('nearby');
          // Best-effort city label for the heading (never blocks the list).
          reverseGeocode(pos.lat, pos.lng).then((p) => {
            if (!cancelled && p?.city) setCity(p.city);
          });
          return;
        }
        // Allowed, but nothing within the radius → show everything.
        const all = await fetchList(`/vendors?limit=${LIMIT}`);
        if (cancelled) return;
        setVendors(all);
        setMode('all');
        return;
      }

      // Denied / unsupported / unavailable → show all available events.
      const all = await fetchList(`/vendors?limit=${LIMIT}`);
      if (cancelled) return;
      setVendors(all);
      setMode('all');
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const heading =
    mode === 'nearby'
      ? city
        ? `${t('nearby.titleNear')} ${city}`
        : t('nearby.title')
      : t('nearby.titleAll');

  const subtitle =
    mode === 'locating'
      ? t('nearby.locating')
      : mode === 'nearby'
        ? t('nearby.subtitleNear', { radius: NEARBY_RADIUS_KM })
        : t('nearby.subtitleAll');

  return (
    <section className="container-page pt-6 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold">
            <MapPin className="text-accent" size={26} />
            {mode === 'locating' ? t('nearby.title') : heading}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-[rgb(var(--foreground))]/60">
            {mode === 'locating' && <Loader2 size={15} className="animate-spin" />}
            {subtitle}
          </p>
        </div>
        <Link href="/vendors" className="shrink-0 whitespace-nowrap text-sm font-medium text-accent">
          {t('featured.viewAll')} →
        </Link>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {mode === 'locating'
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-64 w-full rounded-2xl" />
            ))
          : vendors.map((v) => (
              <Link key={v.id} href={`/vendors/${v.slug}`} className="card h-full overflow-hidden">
                <div className="relative h-36 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.coverImage ?? ''} alt={v.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-accent">
                      <Tr>{v.department?.name}</Tr>
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      {v.rating}
                    </span>
                  </div>
                  <h3 className="mt-1 flex items-center gap-1 text-base font-semibold">
                    {v.name}
                    {v.verified && <ShieldCheck size={14} className="text-accent" />}
                  </h3>
                  <div className="mt-auto pt-3 text-sm">
                    {t('featured.from')}{' '}
                    <span className="font-bold">{formatCurrency(Number(v.priceFrom))}</span>
                  </div>
                </div>
              </Link>
            ))}
      </div>

      {mode !== 'locating' && vendors.length === 0 && (
        <p className="mt-4 text-[rgb(var(--foreground))]/70">
          <Tr>No events available yet.</Tr>
        </p>
      )}
    </section>
  );
}
