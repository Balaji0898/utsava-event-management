'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/shared/lib/api';
import { VendorForm, type VendorData } from '@/features/admin/components/vendor-form';
import { PackagesManager } from '@/features/admin/components/packages-manager';

export default function EditVendorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [vendor, setVendor] = useState<Partial<VendorData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<any>(`/vendors/${id}`)
      .then((v) => {
        setVendor({
          id: v.id,
          name: v.name ?? '',
          departmentId: v.departmentId ?? '',
          description: v.description ?? '',
          logo: v.logo ?? '',
          coverImage: v.coverImage ?? '',
          gallery: v.gallery ?? [],
          experience: v.experience ?? 0,
          location: v.location ?? '',
          availableCities: v.availableCities ?? [],
          contactNumber: v.contactNumber ?? '',
          whatsapp: v.whatsapp ?? '',
          email: v.email ?? '',
          website: v.website ?? '',
          instagram: v.instagram ?? '',
          facebook: v.facebook ?? '',
          priceFrom: Number(v.priceFrom) || 0,
          priceTo: Number(v.priceTo) || 0,
          discountPercent: Number(v.discountPercent) || 0,
          available: v.available ?? true,
          featured: v.featured ?? false,
          trending: v.trending ?? false,
          verified: v.verified ?? false,
          status: v.status ?? 'ACTIVE',
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-sm text-[rgb(var(--foreground))]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Edit: {vendor?.name}</h2>
      <VendorForm initial={vendor} />
      {id && <PackagesManager vendorId={id} />}
    </div>
  );
}
