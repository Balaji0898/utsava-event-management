'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Save, ArrowLeft } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { ImageUploader } from '@/features/admin/components/image-uploader';
import { GalleryUploader } from '@/features/admin/components/gallery-uploader';
import { LocationInput } from '@/shared/ui/location-input';

type Department = { id: string; name: string };

export type VendorData = {
  id?: string;
  name: string;
  departmentId: string;
  description: string;
  logo: string;
  coverImage: string;
  gallery: string[];
  experience: number;
  location: string;
  availableCities: string[];
  contactNumber: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  priceFrom: number;
  priceTo: number;
  discountPercent: number;
  available: boolean;
  featured: boolean;
  trending: boolean;
  verified: boolean;
  status: 'ACTIVE' | 'INACTIVE';
};

const empty: VendorData = {
  name: '',
  departmentId: '',
  description: '',
  logo: '',
  coverImage: '',
  gallery: [],
  experience: 0,
  location: '',
  availableCities: [],
  contactNumber: '',
  whatsapp: '',
  email: '',
  website: '',
  instagram: '',
  facebook: '',
  priceFrom: 0,
  priceTo: 0,
  discountPercent: 0,
  available: true,
  featured: false,
  trending: false,
  verified: false,
  status: 'ACTIVE',
};

const inputCls =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

export function VendorForm({ initial }: { initial?: Partial<VendorData> | null }) {
  const router = useRouter();
  const [form, setForm] = useState<VendorData>({ ...empty, ...initial });
  // Raw text for the comma-separated cities field, so the user can type commas
  // and spaces freely (parsing to an array on every keystroke would strip the
  // comma they just typed). Kept in sync with form.availableCities.
  const [citiesText, setCitiesText] = useState<string>(
    () => (initial?.availableCities ?? []).join(', '),
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Department[]>('/departments?all=true', { auth: true }).then(setDepartments).catch(() => {});
  }, []);

  function set<K extends keyof VendorData>(key: K, val: VendorData[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // Add a detected/picked city to availableCities (deduped, case-insensitive).
  function addCity(cityName: string) {
    const c = cityName.trim();
    if (!c || form.availableCities.some((x) => x.toLowerCase() === c.toLowerCase())) return;
    const next = [...form.availableCities, c];
    set('availableCities', next);
    setCitiesText(next.join(', '));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      experience: Number(form.experience) || 0,
      priceFrom: Number(form.priceFrom) || 0,
      priceTo: Number(form.priceTo) || 0,
      discountPercent: Number(form.discountPercent) || 0,
    };
    delete (payload as any).id;
    try {
      if (initial?.id) {
        await api(`/vendors/${initial.id}`, {
          method: 'PATCH',
          auth: true,
          body: JSON.stringify(payload),
        });
        router.push('/admin/vendors');
        router.refresh();
      } else {
        // On create, go to the vendor's edit page so packages (only manageable
        // once the vendor exists) and remaining media can be added right away.
        const created = await api<{ id: string }>('/vendors', {
          method: 'POST',
          auth: true,
          body: JSON.stringify(payload),
        });
        router.push(created?.id ? `/admin/vendors/${created.id}` : '/admin/vendors');
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="vend-form">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/admin/vendors')}
          className="inline-flex items-center gap-2 text-sm text-[rgb(var(--foreground))]/60 hover:text-brand-500"
        >
          <ArrowLeft size={16} aria-hidden /> Back to vendors
        </button>
        <button disabled={saving} data-testid="vend-submit" className="btn-primary">
          <Save size={16} aria-hidden className="mr-2" /> {saving ? 'Saving…' : 'Save vendor'}
        </button>
      </div>

      {error && (
        <p role="alert" data-testid="vend-error" className="card border-red-500/40 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Details */}
      <Section title="Details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Vendor / work name *" htmlFor="vend-name">
            <input
              id="vend-name"
              data-testid="vend-name"
              className={inputCls}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </Field>
          <Field label="Department / service *" htmlFor="vend-department">
            <select
              id="vend-department"
              data-testid="vend-department"
              className={inputCls}
              value={form.departmentId}
              onChange={(e) => set('departmentId', e.target.value)}
              required
            >
              <option value="">Select…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Experience (years)" htmlFor="vend-experience">
            <input
              id="vend-experience"
              data-testid="vend-experience"
              type="number"
              min={0}
              className={inputCls}
              placeholder="0"
              value={form.experience || ''}
              onChange={(e) => set('experience', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Location" htmlFor="vend-location">
            {/* Autocomplete + "use my location" (free OSM). A picked city is
                also added to Available cities below. */}
            <LocationInput
              id="vend-location"
              testId="vend-location"
              value={form.location}
              onChange={(v) => set('location', v)}
              onResolveCity={(c) => addCity(c)}
              inputClassName={inputCls}
            />
          </Field>
          <Field label="Available cities (comma separated)" htmlFor="vend-cities" full>
            <input
              id="vend-cities"
              data-testid="vend-cities"
              className={inputCls}
              placeholder="Hyderabad, Bengaluru, Chennai"
              value={citiesText}
              onChange={(e) => {
                const raw = e.target.value;
                setCitiesText(raw);
                set(
                  'availableCities',
                  raw.split(',').map((c) => c.trim()).filter(Boolean),
                );
              }}
            />
          </Field>
          <Field label="Description" htmlFor="vend-description" full>
            <textarea
              id="vend-description"
              data-testid="vend-description"
              rows={4}
              className={inputCls}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Work / media */}
      <Section title="Their Work & Media">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Logo">
            <ImageUploader folder="vendors" value={form.logo} onChange={(u) => set('logo', u)} />
          </Field>
          <Field label="Cover image">
            <ImageUploader folder="vendors" value={form.coverImage} onChange={(u) => set('coverImage', u)} />
          </Field>
        </div>
        <Field label="Gallery (portfolio of work)">
          <GalleryUploader folder="vendors" value={form.gallery} onChange={(g) => set('gallery', g)} />
        </Field>
      </Section>

      {/* Contact */}
      <Section title="Contact Details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Contact number" htmlFor="vend-contact-number">
            <input
              id="vend-contact-number"
              data-testid="vend-contact-number"
              className={inputCls}
              value={form.contactNumber}
              onChange={(e) => set('contactNumber', e.target.value)}
            />
          </Field>
          <Field label="WhatsApp" htmlFor="vend-whatsapp">
            <input
              id="vend-whatsapp"
              data-testid="vend-whatsapp"
              className={inputCls}
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="vend-email">
            <input
              id="vend-email"
              data-testid="vend-email"
              className={inputCls}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="Website" htmlFor="vend-website">
            <input
              id="vend-website"
              data-testid="vend-website"
              className={inputCls}
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <Field label="Instagram" htmlFor="vend-instagram">
            <input
              id="vend-instagram"
              data-testid="vend-instagram"
              className={inputCls}
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Field>
          <Field label="Facebook" htmlFor="vend-facebook">
            <input
              id="vend-facebook"
              data-testid="vend-facebook"
              className={inputCls}
              value={form.facebook}
              onChange={(e) => set('facebook', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Pricing & flags */}
      <Section title="Pricing & Visibility">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Price from (₹)" htmlFor="vend-price-from">
            <input
              id="vend-price-from"
              data-testid="vend-price-from"
              type="number"
              min={0}
              className={inputCls}
              placeholder="0"
              value={form.priceFrom || ''}
              onChange={(e) => set('priceFrom', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Price to (₹)" htmlFor="vend-price-to">
            <input
              id="vend-price-to"
              data-testid="vend-price-to"
              type="number"
              min={0}
              className={inputCls}
              placeholder="0"
              value={form.priceTo || ''}
              onChange={(e) => set('priceTo', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
          <Field label="Discount (%)" htmlFor="vend-discount">
            <input
              id="vend-discount"
              data-testid="vend-discount"
              type="number"
              min={0}
              max={100}
              className={inputCls}
              placeholder="0"
              value={form.discountPercent || ''}
              onChange={(e) => set('discountPercent', e.target.value === '' ? 0 : Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          {([
            ['available', 'Available', 'vend-available'],
            ['featured', 'Best Event (home slider — one per category)', 'vend-featured'],
            ['trending', 'Trending', 'vend-trending'],
            ['verified', 'Verified', 'vend-verified'],
          ] as const).map(([flag, label, testId]) => (
            <label key={flag} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid={testId}
                checked={form[flag]}
                onChange={(e) => set(flag, e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              {label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm" htmlFor="vend-status">
            Status:
            <select
              id="vend-status"
              data-testid="vend-status"
              className={`${inputCls} w-auto py-1`}
              value={form.status}
              onChange={(e) => set('status', e.target.value as any)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
      </Section>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-6"
    >
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      {children}
    </motion.div>
  );
}

/**
 * A labelled form row. `htmlFor` must match the `id` of the control inside, so the
 * label is programmatically associated with it — that is what makes the field
 * reachable by assistive tech and by `getByLabel`. Several controls here also share
 * `placeholder="0"`, so the association is the only thing that tells them apart.
 */
function Field({
  label,
  htmlFor,
  children,
  full,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-[rgb(var(--foreground))]/70"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
