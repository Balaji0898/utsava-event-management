import { Skeleton, PackagesGridSkeleton } from '@/shared/ui/skeletons';

export default function VendorDetailLoading() {
  return (
    <div className="container-page py-14">
      <Skeleton className="mb-6 h-9 w-36 rounded-full" />
      <div className="card overflow-hidden">
        <Skeleton className="h-64 w-full rounded-none" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="mt-14 h-7 w-40" />
      <div className="mt-6">
        <PackagesGridSkeleton count={3} />
      </div>
    </div>
  );
}
