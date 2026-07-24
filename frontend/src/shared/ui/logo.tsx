import { cn } from '@/shared/lib/utils';
import { BrandMark } from '@/shared/ui/brand-mark';

/**
 * Utsava lockup — the gold diya-U mark on a dark tile (legible on any
 * background, light or dark) + the Cinzel wordmark.
 */
export function Logo({
  className,
  showWordmark = true,
  size = 38,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className="relative flex items-center justify-center rounded-2xl shadow-gold"
        style={{ width: size, height: size, background: '#0b0a0e' }}
      >
        <BrandMark size={size * 0.74} />
      </span>
      {showWordmark && (
        <span
          className="text-xl font-semibold uppercase tracking-[0.18em] text-[rgb(var(--foreground))]"
          style={{ fontFamily: "var(--font-brand, 'Cinzel', Georgia, serif)" }}
        >
          Utsava
        </span>
      )}
    </span>
  );
}
