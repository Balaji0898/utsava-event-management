'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { api } from '@/shared/lib/api';
import { useI18n } from '@/shared/i18n';
import { BackButton } from '@/shared/ui/back-button';
import { CheckCircle2 } from 'lucide-react';

const schema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Valid email required'),
  customerPhone: z.string().optional(),
  eventDate: z.string().optional(),
  location: z.string().optional(),
  guestCount: z.coerce.number().int().positive().optional(),
  budget: z.coerce.number().positive().optional(),
  specialRequirements: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function BookForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const vendorId = searchParams.get('vendorId') ?? undefined;
  const packageId = searchParams.get('packageId') ?? undefined;
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError('');
    try {
      await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({ ...values, vendorId, packageId }),
      });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card mx-auto max-w-lg p-10 text-center"
      >
        <CheckCircle2 className="mx-auto text-brand-500" size={56} />
        <h2 className="mt-4 text-2xl font-bold">{t('book.successTitle')}</h2>
        <p className="mt-2 text-[rgb(var(--foreground))]/60">{t('book.successBody')}</p>
      </motion.div>
    );
  }

  const field =
    'mt-1 w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit(onSubmit)}
      className="card mx-auto max-w-2xl space-y-5 p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">{t('book.name')} *</label>
          <input className={field} {...register('customerName')} />
          {errors.customerName && (
            <p className="mt-1 text-xs text-red-500">{errors.customerName.message}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">{t('book.email')} *</label>
          <input className={field} type="email" {...register('customerEmail')} />
          {errors.customerEmail && (
            <p className="mt-1 text-xs text-red-500">{errors.customerEmail.message}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">{t('book.phone')}</label>
          <input className={field} {...register('customerPhone')} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('book.date')}</label>
          <input className={field} type="date" {...register('eventDate')} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('book.location')}</label>
          <input className={field} {...register('location')} />
        </div>
        <div>
          <label className="text-sm font-medium">{t('book.guests')}</label>
          <input className={field} type="number" {...register('guestCount')} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">{t('book.budget')} (₹)</label>
          <input className={field} type="number" {...register('budget')} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">{t('book.requirements')}</label>
          <textarea rows={4} className={field} {...register('specialRequirements')} />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? t('book.submitting') : t('book.submit')}
      </button>
    </motion.form>
  );
}

function BookHeading() {
  const { t } = useI18n();
  return <h1 className="mb-8 text-center text-4xl font-bold">{t('book.title')}</h1>;
}

export default function BookPage() {
  return (
    <div className="container-page py-14">
      <div className="mb-6">
        <BackButton fallback="/" label="Back" />
      </div>
      <BookHeading />
      <Suspense fallback={<p className="text-center">Loading…</p>}>
        <BookForm />
      </Suspense>
    </div>
  );
}
