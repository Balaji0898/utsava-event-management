'use client';

import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

type SafeImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width'> & {
  src?: string | null;
  /**
   * Rendered width in CSS px. For Unsplash URLs the `w` param is rewritten to
   * twice this (for high-DPI screens) so a small card doesn't download the
   * 900–1200px original stored in the database.
   */
  width?: number;
};

function sizedSrc(src: string, width?: number): string {
  if (!width) return src;
  try {
    const url = new URL(src);
    if (url.hostname !== 'images.unsplash.com') return src;
    url.searchParams.set('w', String(width * 2));
    return url.toString();
  } catch {
    return src;
  }
}

/**
 * Plain <img> for admin-entered image URLs that may be missing or dead (an
 * upload wiped from an ephemeral disk, a removed Unsplash photo, a backend
 * that is still cold-starting). A failed or empty source renders a muted block
 * instead of the browser's broken-image icon. Lazy + async decoding by default
 * so off-screen cards don't compete with the first paint; pass
 * `loading="eager"` for above-the-fold images.
 */
export function SafeImg({
  src,
  width,
  className,
  alt = '',
  loading = 'lazy',
  ...rest
}: SafeImgProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <div aria-hidden className={cn('bg-[rgb(var(--muted))]', className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={sizedSrc(src, width)}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
