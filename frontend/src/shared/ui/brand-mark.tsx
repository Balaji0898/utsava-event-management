'use client';

import { useId } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Utsava brand mark — a stylised "U" diya vessel with a rising flame, encircled
 * by a thin ring and three diamond sparks (S/E/W), in metallic gold.
 * `animated` turns on CSS animations (flame flicker, ring pulse, spark pulse)
 * defined in globals.css (.brand-mark--animated). Pure SVG + CSS, no JS runtime.
 */
export function BrandMark({
  size = 40,
  animated = false,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const gid = useId().replace(/:/g, ''); // unique, valid gradient id per instance

  return (
    <svg
      viewBox="0 0 110 110"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('brand-mark', animated && 'brand-mark--animated', className)}
    >
      <defs>
        <linearGradient id={`bm-${gid}`} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#F5CC50" />
          <stop offset="55%" stopColor="#E09A18" />
          <stop offset="100%" stopColor="#B07010" />
        </linearGradient>
      </defs>

      {/* Decorative ring */}
      <circle
        className="bm-ring"
        cx="55"
        cy="55"
        r="43"
        stroke={`url(#bm-${gid})`}
        strokeWidth="1.4"
        opacity="0.72"
      />

      {/* Diamond sparks — south / east / west */}
      <path className="bm-spark bm-spark-s" d="M55 105 L58.5 94 L55 91 L51.5 94 Z" fill={`url(#bm-${gid})`} />
      <path className="bm-spark bm-spark-e" d="M105 55 L94 58.5 L91 55 L94 51.5 Z" fill={`url(#bm-${gid})`} />
      <path className="bm-spark bm-spark-w" d="M5 55 L16 58.5 L19 55 L16 51.5 Z" fill={`url(#bm-${gid})`} />

      {/* U letterform (diya vessel) */}
      <path
        d="M37 35 L37 62 Q37 77 55 77 Q73 77 73 62 L73 35"
        fill="none"
        stroke={`url(#bm-${gid})`}
        strokeWidth="11.5"
        strokeLinecap="round"
      />

      {/* Soft flame glow (animated) */}
      <ellipse className="bm-glow" cx="55" cy="18" rx="9" ry="13" fill="#FFA020" opacity="0.35" />

      {/* Diya flame */}
      <path className="bm-flame" d="M55 33 C63 23 65 11 55 5 C45 11 47 23 55 33 Z" fill={`url(#bm-${gid})`} />
    </svg>
  );
}
