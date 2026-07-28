'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

/**
 * Realistic 3D tilt card — the panel follows the cursor with perspective
 * rotation, lifts toward the viewer with a gold glow, and sweeps a soft glare.
 * Honors prefers-reduced-motion (renders a plain wrapper) and degrades on touch
 * (pointer events only). The `.card` class still provides the shadow/border
 * hover via CSS, so transforms here never fight the stylesheet.
 */
export function TiltCard({
  children,
  className,
  intensity = 10,
  testId,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  /** Forwarded to whichever element actually renders, tilt or reduced-motion. */
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(y, [0, 1], [intensity, -intensity]), {
    stiffness: 200,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(x, [0, 1], [-intensity, intensity]), {
    stiffness: 200,
    damping: 20,
  });
  const glareX = useTransform(x, [0, 1], ['0%', '100%']);

  // Reduced motion: no tilt/glare, just render the card (CSS still gives a
  // subtle shadow lift on hover).
  if (reduce) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  }
  function onLeave() {
    x.set(0.5);
    y.set(0.5);
  }

  return (
    // Outer wrapper owns perspective so the inner rotate/lift composes cleanly.
    // h-full so it stretches within grid cells (preserves equal-height cards).
    <div style={{ perspective: 1000 }} className="h-full [transform-style:preserve-3d]">
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        whileHover={{ scale: 1.02, y: -6, z: 30, boxShadow: 'var(--shadow-card-hover)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        data-testid={testId}
        className={`group relative ${className ?? ''}`}
      >
        {children}
        {/* moving gold-tinted glare */}
        <motion.span
          aria-hidden
          style={{ left: glareX }}
          className="pointer-events-none absolute top-0 h-full w-24 -translate-x-1/2 rounded-3xl bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      </motion.div>
    </div>
  );
}
