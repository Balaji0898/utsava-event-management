'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { Award, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/utils';

export type BestEventSlide = {
  category: string;
  icon?: string;
  image?: string;
  title: string;
  description?: string;
  priceFrom?: number;
  href: string;
  isBest: boolean;
};

const AUTOPLAY_MS = 5000;

/**
 * Home "Best Events" showcase — a full-bleed, single-slide, auto-advancing
 * cinematic slider placed directly under the hero. Features a scroll-driven 3D
 * "antigravity" entrance (the panel levitates + rotates flat into view), a
 * subtle cursor-follow 3D tilt, idle float, dots/arrows and an autoplay
 * progress bar. All motion is disabled under prefers-reduced-motion.
 */
export function BestEventsSlider({ slides }: { slides: BestEventSlide[] }) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [[index, dir], setIndex] = useState<[number, number]>([0, 0]);
  const [paused, setPaused] = useState(false);

  const count = slides.length;

  const go = useCallback(
    (next: number, direction: number) => {
      setIndex([(next + count) % count, direction]);
    },
    [count],
  );

  // Autoplay (paused on hover/focus or reduced motion)
  useEffect(() => {
    if (reduce || paused || count <= 1) return;
    const id = setInterval(() => setIndex(([i]) => [(i + 1) % count, 1]), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduce, paused, count]);

  // Scroll-driven 3D "antigravity" entrance
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start end', 'center center'],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [90, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.5, 1]);

  // Cursor-follow tilt (desktop)
  const tiltX = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 120, damping: 18 });
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tiltY.set(px * 8);
    tiltX.set(-py * 6);
  };
  const onMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  if (!count) return null;
  const s = slides[index];

  return (
    <div ref={wrapRef} className="[perspective:1200px]">
      <motion.div
        style={
          reduce
            ? undefined
            : { rotateX, y, scale, opacity, transformPerspective: 1200, transformOrigin: 'center top' }
        }
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => {
          setPaused(false);
          onMouseLeave();
        }}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onMouseMove={onMouseMove}
        className="relative"
      >
        <motion.div
          style={reduce ? undefined : { rotateX: tiltX, rotateY: tiltY, transformPerspective: 1200 }}
          className="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-[1.75rem] border shadow-luxe sm:rounded-[2.5rem]"
        >
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={index}
              custom={dir}
              initial={{ opacity: 0, x: reduce ? 0 : dir * 60, scale: 1.04 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: reduce ? 0 : dir * -60, scale: 1.02 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image ?? ''} alt={s.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            </motion.div>
          </AnimatePresence>

          {/* Slide content */}
          <div className="absolute inset-0 flex items-end p-6 sm:p-10 lg:p-14">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -16 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="max-w-2xl text-white"
              >
                {s.isBest && (
                  <motion.span
                    animate={reduce ? undefined : { y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="inline-flex items-center gap-1 rounded-full bg-gold-gradient px-3 py-1 text-xs font-semibold text-ink shadow-gold"
                  >
                    <Award size={12} /> Best Event
                  </motion.span>
                )}
                <div className="mt-3 text-sm font-medium text-brand-200">
                  {s.icon} {s.category}
                </div>
                <h3 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                  {s.title}
                </h3>
                {s.description && (
                  <p className="mt-3 line-clamp-2 max-w-xl text-sm text-white/80 sm:text-base">
                    {s.description}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <Link href={s.href} className="btn-primary">
                    Explore <ArrowUpRight size={16} className="ml-1.5" />
                  </Link>
                  {typeof s.priceFrom === 'number' && s.priceFrom > 0 && (
                    <span className="text-sm text-white/80">
                      From <span className="font-bold">{formatCurrency(s.priceFrom)}</span>
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Arrows */}
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => go(index - 1, -1)}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => go(index + 1, 1)}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Dots */}
          {count > 1 && (
            <div className="absolute bottom-5 right-6 flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => go(i, i > index ? 1 : -1)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? 'w-6 bg-brand-400' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Autoplay progress bar */}
          {count > 1 && !reduce && !paused && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
              <motion.div
                key={index}
                className="h-full bg-gold-gradient"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
              />
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
