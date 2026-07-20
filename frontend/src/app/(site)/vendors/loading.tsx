import { Skeleton, VendorGridSkeleton } from '@/shared/ui/skeletons';

export default function VendorsLoading() {
  return (
    <div className="container-page py-14">
      <Skeleton className="mb-6 h-9 w-28 rounded-full" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-3 h-4 w-72" />
      <div className="mt-10">
        <VendorGridSkeleton count={9} />
      </div>
    </div>
  );
}
