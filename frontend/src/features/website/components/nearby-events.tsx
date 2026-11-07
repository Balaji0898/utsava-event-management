'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Star, ShieldCheck, Loader2 } from 'lucide-react';
import { apiRead, isPage } from '@/shared/lib/api';
import {
  geolocationPermission,
  getCurrentPosition,
  reverseGeocode,
  type GeoResult,
} from '@/shared/lib/geo';
import { formatCurrency } from '@/shared/lib/utils';
import { useI18n } from '@/shared/i18n';
import { Tr } from '@/shared/i18n/tr';
import { NEARBY_RADIUS_KM } from '@/shared/config/site';
import { SafeImg } from '@/shared/ui/safe-img';
import { SectionEmpty, SectionError } from '@/features/website/components/section-retry';

const LIMIT = 8;

/**
 * How long the section waits on an unanswered permission prompt before it gives
 * up on the skeleton and renders all events. The location request keeps running
 * in the background — allowing late still upgrades the list to nearby events.
 */
const GEO_WAIT_MS = 6000;

/** Resolves with the promise's value, or null once `ms` elapses. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setMode('locating');
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Separate from `nearbyRequest` so a nearby result can drop just this one.
    const allRequest = new AbortController();
    const nearbyRequest = new AbortController();

    async function fetchList(
      query: string,
      signal: AbortSignal,
    ): Promise<{ items: Vendor[]; ok: boolean }> {
      try {
        const res = await apiRead<{ data: Vendor[]; total: number }>(query, {
          section: 'explore-events',
          validate: isPage,
          signal,
        });
        return { items: res.data, ok: true };
      } catch {
        return { items: [], ok: false }; // aborted / offline / backend error
      }
    }

    // Started right away, in parallel with the location request: whatever the
    // user does with the permission prompt, there is always something to render.
    const allEvents = fetchList(`/vendors?limit=${LIMIT}`, allRequest.signal);

    async function showAll() {
      const all = await allEvents;
      if (cancelled) return;
      setVendors(all.items);
      setFailed(!all.ok);
      setMode('all');
    }

    /** Renders nearby events for a granted position. False → caller falls back. */
    async function showNearby(pos: GeoResult): Promise<boolean> {
      if (!pos.ok) return false;
      const near = await fetchList(
        `/vendors?lat=${pos.lat}&lng=${pos.lng}&radius=${NEARBY_RADIUS_KM}&limit=${LIMIT}`,
        nearbyRequest.signal,
      );
      if (cancelled || near.items.length === 0) return false;
      allRequest.abort(); // Superseded; stop any retries still running.
      setVendors(near.items);
      setFailed(false);
      setMode('nearby');
      // Best-effort city label for the heading (never blocks the list).
      reverseGeocode(pos.lat, pos.lng).then((p) => {
        if (!cancelled && p?.city) setCity(p.city);
      });
      return true;
    }

    async function run() {
      const permission = await geolocationPermission();
      if (cancelled) return;

      // Already blocked → don't even ask, go straight to all events.
      if (permission === 'denied') {
        await showAll();
        return;
      }

      // Triggers the browser permission prompt. Always settles (see geo.ts).
      const position = getCurrentPosition();

      // With permission already granted there's no prompt to sit on, so wait for
      // the fix itself; otherwise cap the wait so an ignored prompt can't hold
      // the section on its skeleton.
      const early =
        permission === 'granted' ? await position : await withDeadline(position, GEO_WAIT_MS);
      if (cancelled) return;

      if (early) {
        if (await showNearby(early)) return;
        await showAll(); // denied, unavailable, or nothing within the radius
        return;
      }

      // Prompt still open: show all events now, and upgrade to nearby events if
      // the user allows afterwards.
      await showAll();
      const late = await position;
      if (cancelled) return;
      await showNearby(late);
    }

    run();
    return () => {
      cancelled = true;
      allRequest.abort();
      nearbyRequest.abort();
    };
  }, [attempt]);

  // Coming back online is a better retry signal than anything we could time.
  useEffect(() => {
    if (!failed) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [failed, retry]);

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
                  <SafeImg src={v.coverImage} alt={v.name} width={320} className="h-full w-full object-cover" />
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

      {mode !== 'locating' &&
        vendors.length === 0 &&
        (failed ? (
          <SectionError message="Couldn't load events just now." onRetry={retry} />
        ) : (
          <SectionEmpty message="No events available yet." />
        ))}
    </section>
  );
}
