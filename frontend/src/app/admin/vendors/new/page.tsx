'use client';

import { VendorForm } from '@/features/admin/components/vendor-form';

export default function NewVendorPage() {
  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-bold">Add Vendor</h2>
      <p className="mb-6 text-sm text-[rgb(var(--foreground))]/60">
        Save the vendor first — you&apos;ll then be taken to its page to add packages and gallery images.
      </p>
      <VendorForm />
    </div>
  );
}
