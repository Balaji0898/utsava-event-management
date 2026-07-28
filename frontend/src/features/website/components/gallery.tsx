'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Vendor gallery — a thumbnail grid that opens a full-screen lightbox on click,
 * with prev/next arrows, close (X / backdrop / Esc) and left/right keyboard
 * navigation. Body scroll is locked while open.
 */
export function Gallery({ images, name }: { images: string[]; name: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + images.length) % images.length),
    [images.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % images.length),
    [images.length],
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close, prev, next]);

  if (!images.length) return null;

  return (
    <>
      <div data-testid="vdetail-gallery" className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {images.map((g, i) => (
          <button
            key={i}
            type="button"
            onClick={() => show(i)}
            aria-label={`View image ${i + 1}`}
            className="card relative h-48 overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g}
              alt={`${name} ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`${name} gallery`}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
            >
              <X size={22} />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 sm:left-6"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 sm:right-6"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            <motion.img
              key={index}
              initial={reduce ? undefined : { opacity: 0, scale: 0.97 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              src={images[index]}
              alt={`${name} ${index + 1}`}
              className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-luxe"
            />

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
              <span data-testid="vdetail-lightbox-counter">
                {index + 1} / {images.length}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
