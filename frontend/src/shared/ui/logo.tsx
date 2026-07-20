import { cn } from '@/shared/lib/utils';

/**
 * Utsava wordmark + gold diya/monogram mark.
 */
export function Logo({
  className,
  showWordmark = true,
  size = 36,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        className="relative flex items-center justify-center rounded-2xl bg-gold-gradient shadow-gold"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          className="text-ink"
        >
          {/* Stylised 'U' / diya flame monogram */}
          <path
            d="M6 4v8a6 6 0 0 0 12 0V4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M12 15.5c.9 0 1.7.9 1.7 1.9S12.9 20 12 20s-1.7-.6-1.7-1.6.8-2.9 1.7-2.9z"
            fill="currentColor"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-display text-xl font-bold tracking-tight">
          Utsava
        </span>
      )}
    </span>
  );
}
