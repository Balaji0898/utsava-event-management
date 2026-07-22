'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Dependency-free horizontal carousel: a CSS scroll-snap track with prev/next
 * arrows, drag/swipe, and keyboard support. Children are the slides; sizing per
 * slide is controlled by the parent via `slideClassName` (responsive widths).
 */
export function Carousel({
  children,
  slideClassName = 'w-[85%] sm:w-[45%] lg:w-[31%]',
  ariaLabel = 'carousel',
  className = '',
}: {
  children: ReactNode[];
  slideClassName?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, children.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // scroll by ~90% of the viewport so a partial next slide hints there's more
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };

  if (!children.length) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={trackRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') scrollByPage(1);
          if (e.key === 'ArrowLeft') scrollByPage(-1);
        }}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, i) => (
          <div key={i} className={`shrink-0 snap-start ${slideClassName}`}>
            {child}
          </div>
        ))}
      </div>

      {/* Arrows (hidden on touch when not scrollable) */}
      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByPage(-1)}
        className={`absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-[rgb(var(--card))] shadow-md transition hover:bg-[rgb(var(--muted))] md:flex ${
          canPrev ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByPage(1)}
        className={`absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border bg-[rgb(var(--card))] shadow-md transition hover:bg-[rgb(var(--muted))] md:flex ${
          canNext ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
