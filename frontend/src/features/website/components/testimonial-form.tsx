'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { useI18n } from '@/shared/i18n';

const field =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Public "share your experience" form. Submissions are created unapproved and
 * only appear on the site once an admin approves them.
 */
export function TestimonialForm() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setStatus('sending');
    setError('');
    try {
      await api('/cms/testimonials/submit', {
        method: 'POST',
        body: JSON.stringify({ name, role, rating, message }),
      });
      setStatus('done');
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  if (status === 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 p-8 text-center"
      >
        <CheckCircle2 className="text-emerald-500" size={40} />
        <h3 className="font-display text-2xl font-bold">{t('reviewForm.thanksTitle')}</h3>
        <p className="text-sm text-[rgb(var(--foreground))]/60">{t('reviewForm.thanksBody')}</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-xl space-y-4 p-6 sm:p-8">
      <div className="text-center">
        <h3 className="font-display text-2xl font-bold">{t('reviewForm.title')}</h3>
        <p className="mt-1 text-sm text-[rgb(var(--foreground))]/60">{t('reviewForm.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          className={field}
          placeholder={t('reviewForm.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className={field}
          placeholder={t('reviewForm.role')}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[rgb(var(--foreground))]/60">{t('reviewForm.rating')}</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`${s} star${s > 1 ? 's' : ''}`}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5"
            >
              <Star
                size={22}
                className={
                  (hover || rating) >= s
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-[rgb(var(--foreground))]/25'
                }
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        className={field}
        rows={4}
        placeholder={t('reviewForm.message')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button className="btn-primary w-full justify-center" disabled={status === 'sending'}>
        <Send size={16} className="mr-2" />
        {status === 'sending' ? t('reviewForm.sending') : t('reviewForm.submit')}
      </button>
    </form>
  );
}
