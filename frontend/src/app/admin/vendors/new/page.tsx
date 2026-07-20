'use client';

import { VendorForm } from '@/features/admin/components/vendor-form';

export default function NewVendorPage() {
  return (
    <div>
      <h2 className="mb-6 font-display text-2xl font-bold">Add Vendor</h2>
      <VendorForm />
    </div>
  );
}
