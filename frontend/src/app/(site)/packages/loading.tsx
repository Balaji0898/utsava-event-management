import { Skeleton, PackagesGridSkeleton } from '@/shared/ui/skeletons';

export default function PackagesLoading() {
  return (
    <div className="container-page py-14">
      <Skeleton className="mb-6 h-9 w-28 rounded-full" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-10">
        <PackagesGridSkeleton count={6} />
      </div>
    </div>
  );
}
