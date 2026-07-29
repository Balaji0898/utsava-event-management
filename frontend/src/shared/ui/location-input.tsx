'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, LocateFixed, Loader2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import {
  geolocationSupported,
  getCurrentPosition,
  reverseGeocode,
  searchPlaces,
  type Place,
} from '@/shared/lib/geo';

/**
 * Controlled location text input with free (OSM Photon) city autocomplete and a
 * "use my location" button (browser geolocation → reverse geocode). Permission
 * denial / unavailability are surfaced inline; manual typing always works.
 */
export function LocationInput({
  value,
  onChange,
  onResolveCity,
  onGeoCoords,
  placeholder,
  name,
  id,
  testId,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called with the resolved city when picked from the list or via geolocation. */
  onResolveCity?: (city: string, source: 'pick' | 'geo') => void;
  /** Called with raw coordinates from "use my location" (before reverse geocode)
   *  so hosts can run a true proximity search. Fires even if reverse geocode fails. */
  onGeoCoords?: (lat: number, lng: number) => void;
  placeholder?: string;
  name?: string;
  /** Pairs with a <label htmlFor> on the host form. */
  id?: string;
  testId?: string;
  className?: string;
  inputClassName?: string;
}) {
  const { t } = useI18n();
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  /**
   * The geolocate button is gated on `geolocationSupported()`, which reads `navigator` — false
   * during SSR, true in the browser. Rendering directly on that check produced a hydration
   * mismatch ("Expected server HTML to contain a matching <button> in <div>"), which made React
   * throw away the server HTML and re-render, so this component's whole subtree — including the
   * booking form it sits in — appeared only after a client re-render.
   *
   * Deferring to after mount makes the server and the client's FIRST render agree; the button then
   * appears in the commit that follows, which is the standard fix for a browser-only capability.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Derived from the field id so two inputs on one page get distinct listbox ids.
  const listboxId = `${id ?? name ?? 'location'}-listbox`;

  // Debounced autocomplete.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSuggestions(await searchPlaces(q));
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [value]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(city: string, source: 'pick' | 'geo') {
    onChange(city);
    onResolveCity?.(city, source);
    setOpen(false);
    setStatus('');
  }

  async function useMyLocation() {
    setLocating(true);
    setStatus(t('location.locating'));
    const pos = await getCurrentPosition();
    if (!pos.ok) {
      setLocating(false);
      setStatus(pos.reason === 'denied' ? t('location.denied') : t('location.unavailable'));
      return;
    }
    // Hand the raw coordinates to the host first — proximity search uses these
    // directly, independent of whether reverse geocoding yields a city label.
    onGeoCoords?.(pos.lat, pos.lng);
    const place = await reverseGeocode(pos.lat, pos.lng);
    setLocating(false);
    if (place?.city) {
      pick(place.city, 'geo');
    } else {
      setStatus('');
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          data-testid={testId}
          name={name}
          value={value}
          autoComplete="off"
          // Combobox semantics: the suggestion list is a real listbox of options, so
          // screen readers announce it and role-based locators can address it.
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setStatus('');
          }}
          onFocus={() => value.trim().length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className={inputClassName}
        />
        {mounted && geolocationSupported() && (
          <button
            type="button"
            onClick={useMyLocation}
            title={t('location.useMy')}
            aria-label={t('location.useMy')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-accent transition hover:bg-[rgb(var(--muted))]"
          >
            {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
          </button>
        )}
      </div>

      {status && (
        <p role="status" className="mt-1 text-xs text-[rgb(var(--foreground))]/70">
          {status}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-[rgb(var(--card))] py-1 shadow-luxe"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pick(s.city, 'pick')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--muted))]"
              >
                <MapPin size={14} aria-hidden className="shrink-0 text-accent" /> {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
