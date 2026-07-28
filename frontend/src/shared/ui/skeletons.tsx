import { cn } from '@/shared/lib/utils';

/**
 * `aria-hidden` because a shimmer block carries no information — the surrounding
 * `role="status"` region is what announces "Loading…". Without it every skeleton is
 * an empty, unlabelled node in the accessibility tree.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden data-testid="skeleton" className={cn('skeleton', className)} />;
}

/** Card that mirrors a vendor/work card while data loads. */
export function VendorCardSkeleton() {
  return (
    <div className="card h-full overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
    </div>
  );
}

export function VendorGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <VendorCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Card that mirrors a pricing package while data loads. */
export function PackageCardSkeleton() {
  return (
    <div className="card h-full space-y-4 p-6">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-9 w-2/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <Skeleton className="mt-4 h-11 w-full rounded-full" />
    </div>
  );
}

export function PackagesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <PackageCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Shimmer rows for admin data tables. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 border-b bg-[rgb(var(--muted))] px-5 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={c === 0 ? 'h-4 flex-1' : 'h-3 flex-1'} />
          ))}
        </div>
      ))}
    </div>
  );
}
