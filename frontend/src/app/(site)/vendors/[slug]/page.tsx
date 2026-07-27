import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { Reveal } from '@/shared/motion/primitives';
import { TiltCard } from '@/shared/motion/tilt-card';
import { BackButton } from '@/shared/ui/back-button';
import { Gallery } from '@/features/website/components/gallery';
import { formatCurrency } from '@/shared/lib/utils';
import { Tr } from '@/shared/i18n/tr';
import { Star, ShieldCheck, MapPin, Phone, Check } from 'lucide-react';

type Pkg = {
  id: string;
  name: string;
  price: string | number;
  features: string[];
  popular: boolean;
};
type Vendor = {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  gallery?: string[];
  rating: number;
  reviewCount: number;
  location?: string;
  contactNumber?: string;
  verified: boolean;
  department?: { name: string };
  packages: Pkg[];
  reviews: { id: string; rating: number; comment?: string; authorName?: string }[];
};

export default async function VendorDetail({ params }: { params: { slug: string } }) {
  const vendor = await serverApi<Vendor>(`/vendors/${params.slug}`, {
    tags: [CACHE_TAGS.vendors],
  });
  if (!vendor) notFound();

  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/vendors" label="Back to work" />
      </div>
      <Reveal>
        <div className="card overflow-hidden">
          <div className="relative h-64 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={vendor.coverImage ?? ''}
              alt={vendor.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="p-8">
            <span className="text-sm font-medium text-accent">
              <Tr>{vendor.department?.name}</Tr>
            </span>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold">
              {vendor.name}
              {vendor.verified && <ShieldCheck className="text-accent" />}
            </h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[rgb(var(--foreground))]/70">
              <span className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {vendor.rating} ({vendor.reviewCount} reviews)
              </span>
              {vendor.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} /> <Tr>{vendor.location}</Tr>
                </span>
              )}
              {vendor.contactNumber && (
                <span className="flex items-center gap-1">
                  <Phone size={14} /> {vendor.contactNumber}
                </span>
              )}
            </div>
            <p className="mt-4 max-w-2xl text-[rgb(var(--foreground))]/70">
              <Tr>{vendor.description}</Tr>
            </p>
          </div>
        </div>
      </Reveal>

      {vendor.gallery && vendor.gallery.length > 0 && (
        <>
          <h2 className="mt-14 text-2xl font-bold">
            <Tr>Gallery</Tr>
          </h2>
          <Gallery images={vendor.gallery} name={vendor.name} />
        </>
      )}

      <h2 className="mt-14 text-2xl font-bold">
        <Tr>Packages</Tr>
      </h2>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {vendor.packages.map((p) => (
          <TiltCard
            key={p.id}
            className={`card relative flex h-full flex-col p-6 ${
              p.popular ? 'ring-2 ring-brand-500' : ''
            }`}
          >
            {p.popular && (
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                <Tr>Most popular</Tr>
              </span>
            )}
            <h3 className="text-lg font-semibold">
              <Tr>{p.name}</Tr>
            </h3>
            <div className="mt-2 text-3xl font-extrabold">
              {formatCurrency(Number(p.price))}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check size={16} className="shrink-0 text-accent" /> <Tr>{f}</Tr>
                </li>
              ))}
            </ul>
            <Link
              href={`/book?vendorId=${vendor.id}&packageId=${p.id}`}
              className="btn-primary mt-auto w-full"
            >
              <Tr>Book this package</Tr>
            </Link>
          </TiltCard>
        ))}
      </div>

      {vendor.reviews.length > 0 && (
        <>
          <h2 className="mt-14 text-2xl font-bold">
            <Tr>Reviews</Tr>
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {vendor.reviews.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex items-center gap-1">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mt-2 text-sm">
                  <Tr>{r.comment}</Tr>
                </p>
                <p className="mt-2 text-xs text-[rgb(var(--foreground))]/50">
                  — {r.authorName ?? <Tr>Customer</Tr>}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
