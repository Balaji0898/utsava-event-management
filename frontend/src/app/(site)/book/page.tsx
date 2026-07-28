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
import { LocationInput } from '@/shared/ui/location-input';
import { CheckCircle2 } from 'lucide-react';

/**
 * Normalise an empty field to `undefined` BEFORE validation.
 *
 * React Hook Form hands zod the raw DOM value, and an untouched input yields `''`. Because `''` is
 * not `undefined`, `.optional()` never short-circuits: `z.coerce.number()` then runs `Number('')`,
 * gets `0`, and `.positive()` fails. The user saw no error (these fields had no error markup) and
 * the submit button simply did nothing.
 *
 * The same blank tripped up `eventDate` one layer down — `''` satisfies `z.string().optional()`,
 * then fails the backend's `@IsOptional() @IsDateString()`, because class-validator's `IsOptional`
 * skips only `null` and `undefined`. That surfaced as a raw HTTP 400.
 *
 * Mapping blanks to `undefined` here fixes both: an omitted optional field is now genuinely absent
 * from the payload rather than present-and-empty.
 */
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const schema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  customerEmail: z.string().email('Valid email required'),
  customerPhone: z.string().optional(),
  eventDate: z.preprocess(blankToUndefined, z.string().optional()),
  location: z.string().optional(),
  guestCount: z.preprocess(
    blankToUndefined,
    z.coerce.number().int('Guest count must be a whole number').positive('Guest count must be at least 1').optional(),
  ),
  budget: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive('Budget must be greater than zero').optional(),
  ),
  specialRequirements: z.string().optional(),
  // Explicit consent to process the submitted personal data (DPDP notice/consent).
  consent: z.boolean().refine((v) => v === true, {
    message: 'Please agree to the privacy policy to continue',
  }),
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
    watch,
    setValue,
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
        role="status"
        data-testid="book-success"
      >
        <CheckCircle2 className="mx-auto text-brand-500" size={56} aria-hidden />
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
      data-testid="book-form"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="book-name" className="text-sm font-medium">
            {t('book.name')} *
          </label>
          <input
            id="book-name"
            data-testid="book-name"
            className={field}
            autoComplete="name"
            aria-invalid={errors.customerName ? true : undefined}
            aria-describedby={errors.customerName ? 'book-name-error' : undefined}
            {...register('customerName')}
          />
          {errors.customerName && (
            <p id="book-name-error" className="mt-1 text-xs text-red-500">
              {errors.customerName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="book-email" className="text-sm font-medium">
            {t('book.email')} *
          </label>
          <input
            id="book-email"
            data-testid="book-email"
            className={field}
            type="email"
            autoComplete="email"
            aria-invalid={errors.customerEmail ? true : undefined}
            aria-describedby={errors.customerEmail ? 'book-email-error' : undefined}
            {...register('customerEmail')}
          />
          {errors.customerEmail && (
            <p id="book-email-error" className="mt-1 text-xs text-red-500">
              {errors.customerEmail.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="book-phone" className="text-sm font-medium">
            {t('book.phone')}
          </label>
          <input
            id="book-phone"
            data-testid="book-phone"
            className={field}
            autoComplete="tel"
            {...register('customerPhone')}
          />
        </div>
        <div>
          <label htmlFor="book-date" className="text-sm font-medium">
            {t('book.date')}
          </label>
          <input
            id="book-date"
            data-testid="book-date"
            className={field}
            type="date"
            aria-invalid={errors.eventDate ? true : undefined}
            aria-describedby={errors.eventDate ? 'book-date-error' : undefined}
            {...register('eventDate')}
          />
          {errors.eventDate && (
            <p id="book-date-error" className="mt-1 text-xs text-red-500">
              {errors.eventDate.message as string}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="book-location" className="text-sm font-medium">
            {t('book.location')}
          </label>
          <LocationInput
            id="book-location"
            testId="book-location"
            value={watch('location') ?? ''}
            onChange={(v) => setValue('location', v)}
            inputClassName={field}
          />
        </div>
        <div>
          <label htmlFor="book-guests" className="text-sm font-medium">
            {t('book.guests')}
          </label>
          <input
            id="book-guests"
            data-testid="book-guests"
            className={field}
            type="number"
            aria-invalid={errors.guestCount ? true : undefined}
            aria-describedby={errors.guestCount ? 'book-guests-error' : undefined}
            {...register('guestCount')}
          />
          {errors.guestCount && (
            <p id="book-guests-error" className="mt-1 text-xs text-red-500">
              {errors.guestCount.message as string}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="book-budget" className="text-sm font-medium">
            {t('book.budget')} (₹)
          </label>
          <input
            id="book-budget"
            data-testid="book-budget"
            className={field}
            type="number"
            aria-invalid={errors.budget ? true : undefined}
            aria-describedby={errors.budget ? 'book-budget-error' : undefined}
            {...register('budget')}
          />
          {errors.budget && (
            <p id="book-budget-error" className="mt-1 text-xs text-red-500">
              {errors.budget.message as string}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="book-requirements" className="text-sm font-medium">
            {t('book.requirements')}
          </label>
          <textarea
            id="book-requirements"
            data-testid="book-requirements"
            rows={4}
            className={field}
            {...register('specialRequirements')}
          />
        </div>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-[rgb(var(--foreground))]/80">
          <input
            type="checkbox"
            data-testid="book-consent"
            className="mt-1 h-4 w-4 accent-brand-500"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'book-consent-error' : undefined}
            {...register('consent')}
          />
          <span>
            {t('book.consent')}{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="book-privacy-link"
              className="underline hover:text-brand-500"
            >
              {t('book.privacyPolicy')}
            </a>
            .
          </span>
        </label>
        {errors.consent && (
          <p id="book-consent-error" className="mt-1 text-xs text-red-500">
            {errors.consent.message as string}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" data-testid="book-error" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <button disabled={isSubmitting} data-testid="book-submit" className="btn-primary w-full">
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
