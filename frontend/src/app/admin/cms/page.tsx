'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Plus, Trash2, Star, Check, Save } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { ImageUploader } from '@/features/admin/components/image-uploader';

const RichTextEditor = dynamic(
  () => import('@/features/admin/components/rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[320px] animate-pulse rounded-xl border bg-[rgb(var(--muted))]" /> },
);

type Testimonial = {
  id: string;
  name: string;
  role?: string;
  message: string;
  avatar?: string;
  rating: number;
  approved?: boolean;
};
type Faq = { id: string; question: string; answer: string };

const field =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

const TABS = ['testimonials', 'faqs', 'stats', 'contact', 'legal'] as const;
type Tab = (typeof TABS)[number];

export default function AdminCms() {
  const [tab, setTab] = useState<Tab>('testimonials');

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Content Management</h2>

      {/* Real tab semantics: without role/aria-selected these are five anonymous
          buttons and assistive tech cannot tell which panel is showing. */}
      <div
        role="tablist"
        aria-label="Content sections"
        data-testid="cms-tabs"
        className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border p-1"
      >
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`cms-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`cms-panel-${t}`}
            data-testid={`cms-tab-${t}`}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-brand-700 text-white' : 'hover:bg-[rgb(var(--muted))]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {TABS.map((t) =>
        tab === t ? (
          <div key={t} role="tabpanel" id={`cms-panel-${t}`} aria-labelledby={`cms-tab-${t}`} data-testid={`cms-panel-${t}`}>
            {t === 'testimonials' && <TestimonialsPanel />}
            {t === 'faqs' && <FaqsPanel />}
            {t === 'stats' && <StatsPanel />}
            {t === 'contact' && <ContactPanel />}
            {t === 'legal' && <LegalPanel />}
          </div>
        ) : null,
      )}
    </div>
  );
}

/* ---------------------------- Testimonials ---------------------------- */
function TestimonialsPanel() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Testimonial[]>('/cms/testimonials?all=true', { auth: true }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !message) return;
    try {
      await api('/cms/testimonials', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ name, role, message, avatar, rating: 5 }),
      });
      setName('');
      setRole('');
      setMessage('');
      setAvatar('');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function approve(id: string) {
    await api(`/cms/testimonials/${id}`, {
      method: 'PATCH',
      auth: true,
      body: JSON.stringify({ approved: true }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete testimonial?')) return;
    await api(`/cms/testimonials/${id}`, { method: 'DELETE', auth: true });
    await load();
  }

  const pending = items.filter((t) => !t.approved);
  const approved = items.filter((t) => t.approved);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={create} data-testid="cms-testimonial-add-form" className="card space-y-3 p-5">
        <h3 className="font-semibold">Add testimonial</h3>
        <input aria-label="Customer name" data-testid="cms-testimonial-name" className={field} placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Role" data-testid="cms-testimonial-role" className={field} placeholder="Role (e.g. Bride)" value={role} onChange={(e) => setRole(e.target.value)} />
        <textarea aria-label="Message" data-testid="cms-testimonial-message" className={field} rows={3} placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <div>
          <label className="mb-1 block text-xs font-medium">Avatar</label>
          <ImageUploader folder="testimonials" value={avatar} onChange={setAvatar} />
        </div>
        <button className="btn-primary w-full" data-testid="cms-testimonial-add">
          <Plus size={16} aria-hidden className="mr-1" /> Add
        </button>
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>

      <div className="space-y-6 lg:col-span-2">
        {/* Pending approval queue */}
        {pending.length > 0 && (
          <div data-testid="cms-testimonial-pending">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              Pending approval
              <span
                data-testid="cms-testimonial-pending-count"
                className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600"
              >
                {pending.length}
              </span>
            </h3>
            <div className="space-y-3">
              {pending.map((t) => (
                <div
                  key={t.id}
                  data-testid={`cms-testimonial-row-${t.id}`}
                  className="card flex items-start gap-4 border-amber-400/40 p-4"
                >
                  <TestimonialBody t={t} />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => approve(t.id)}
                      aria-label={`Approve review by ${t.name}`}
                      data-testid={`cms-testimonial-approve-${t.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <Check size={14} aria-hidden /> Approve
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      aria-label={`Reject review by ${t.name}`}
                      data-testid={`cms-testimonial-reject-${t.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-[rgb(var(--muted))]"
                    >
                      <Trash2 size={14} aria-hidden /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Published */}
        <div data-testid="cms-testimonial-published">
          <h3 className="mb-2 text-sm font-semibold">Published</h3>
          <div className="space-y-3">
            {approved.map((t) => (
              <div key={t.id} data-testid={`cms-testimonial-row-${t.id}`} className="card flex items-start gap-4 p-4">
                <TestimonialBody t={t} />
                <button
                  onClick={() => remove(t.id)}
                  aria-label={`Delete review by ${t.name}`}
                  data-testid={`cms-testimonial-delete-${t.id}`}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            ))}
            {approved.length === 0 && (
              <p data-testid="cms-testimonial-empty" className="text-sm text-[rgb(var(--foreground))]/70">
                No published testimonials yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TestimonialBody({ t }: { t: Testimonial }) {
  return (
    <div className="flex flex-1 items-start gap-3">
      {t.avatar && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 font-semibold">
          {t.name}
          <span className="text-xs text-[rgb(var(--foreground))]/70">{t.role}</span>
        </div>
        <div className="mt-0.5 flex">
          {Array.from({ length: t.rating }).map((_, s) => (
            <Star key={s} size={12} className="fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="mt-1 text-sm text-[rgb(var(--foreground))]/70">{t.message}</p>
      </div>
    </div>
  );
}

/* ------------------------------- FAQs -------------------------------- */
function FaqsPanel() {
  const [items, setItems] = useState<Faq[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Faq[]>('/cms/faqs?all=true', { auth: true }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!question || !answer) return;
    try {
      await api('/cms/faqs', { method: 'POST', auth: true, body: JSON.stringify({ question, answer }) });
      setQuestion('');
      setAnswer('');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete FAQ?')) return;
    await api(`/cms/faqs/${id}`, { method: 'DELETE', auth: true });
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={create} data-testid="cms-faq-add-form" className="card space-y-3 p-5">
        <h3 className="font-semibold">Add FAQ</h3>
        <input aria-label="Question" data-testid="cms-faq-question" className={field} placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <textarea aria-label="Answer" data-testid="cms-faq-answer" className={field} rows={4} placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <button className="btn-primary w-full" data-testid="cms-faq-add">
          <Plus size={16} aria-hidden className="mr-1" /> Add
        </button>
        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>

      <div className="space-y-3 lg:col-span-2" data-testid="cms-faq-list">
        {items.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} data-testid={`cms-faq-row-${f.id}`} className="card flex items-start gap-4 p-4">
            <div className="flex-1">
              <div className="font-semibold">{f.question}</div>
              <p className="mt-1 text-sm text-[rgb(var(--foreground))]/70">{f.answer}</p>
            </div>
            <button
              onClick={() => remove(f.id)}
              aria-label={`Delete FAQ: ${f.question}`}
              data-testid={`cms-faq-delete-${f.id}`}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </motion.div>
        ))}
        {items.length === 0 && <p className="text-sm text-[rgb(var(--foreground))]/70">No FAQs yet.</p>}
      </div>
    </div>
  );
}

/* ------------------------------- Stats ------------------------------- */
type StatItem = { label: string; value: number; suffix?: string };

function StatsPanel() {
  const [items, setItems] = useState<StatItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api<{ items?: StatItem[] } | null>('/cms/stats');
      setItems(data?.items ?? []);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const update = (i: number, patch: Partial<StatItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  async function save() {
    setError('');
    try {
      await api('/cms/stats', { method: 'PUT', auth: true, body: JSON.stringify({ items }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[rgb(var(--foreground))]/60">
        The headline counters shown on the home page (e.g. events delivered, happy customers).
      </p>
      {items.map((s, i) => (
        <div key={i} data-testid={`cms-stats-row-${i}`} className="card grid grid-cols-12 items-center gap-3 p-4">
          <input aria-label={`Stat ${i + 1} label`} data-testid={`cms-stats-label-${i}`} className={`${field} col-span-6`} placeholder="Label" value={s.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input aria-label={`Stat ${i + 1} value`} data-testid={`cms-stats-value-${i}`} className={`${field} col-span-3`} type="number" placeholder="Value" value={s.value} onChange={(e) => update(i, { value: Number(e.target.value) })} />
          <input aria-label={`Stat ${i + 1} suffix`} data-testid={`cms-stats-suffix-${i}`} className={`${field} col-span-2`} placeholder="Suffix" value={s.suffix ?? ''} onChange={(e) => update(i, { suffix: e.target.value })} />
          <button
            onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
            className="col-span-1 text-red-600 dark:text-red-400"
            aria-label={`Remove stat ${i + 1}`}
            data-testid={`cms-stats-remove-${i}`}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={() => setItems((p) => [...p, { label: '', value: 0, suffix: '+' }])} data-testid="cms-stats-add" className="btn-ghost text-sm">
          <Plus size={16} aria-hidden className="mr-1" /> Add stat
        </button>
        <button onClick={save} data-testid="cms-stats-save" className="btn-primary text-sm">
          <Save size={16} aria-hidden className="mr-1" /> Save
        </button>
        {saved && (
          <span role="status" data-testid="cms-saved" className="text-sm text-emerald-700 dark:text-emerald-400">
            Saved ✓
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/* ------------------------------ Contact ------------------------------ */
type Contact = {
  manager?: string;
  role?: string;
  phone?: string;
  phoneDisplay?: string;
  whatsapp?: string;
  email?: string;
};

function ContactPanel() {
  const [c, setC] = useState<Contact>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setC((await api<Contact | null>('/cms/contact')) ?? {});
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setC((prev) => ({ ...prev, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/cms/contact', { method: 'PUT', auth: true, body: JSON.stringify(c) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const rows: [keyof Contact, string, string, string][] = [
    ['manager', 'Manager name', 'Balaji Guggilam', 'cms-contact-manager'],
    ['role', 'Role / title', 'Event Manager & Owner', 'cms-contact-role'],
    ['phone', 'Phone (digits, for tel: link)', '8790233572', 'cms-contact-phone'],
    ['phoneDisplay', 'Phone (display)', '+91 87902 33572', 'cms-contact-phone-display'],
    ['whatsapp', 'WhatsApp number (with country code)', '918790233572', 'cms-contact-whatsapp'],
    ['email', 'Email', 'hello@utsava.events', 'cms-contact-email'],
  ];

  return (
    <form onSubmit={save} data-testid="cms-contact-form" className="card max-w-xl space-y-4 p-6">
      <h3 className="font-semibold">Contact details</h3>
      {rows.map(([k, label, ph, testId]) => (
        <div key={k}>
          <label htmlFor={testId} className="mb-1 block text-xs font-medium text-[rgb(var(--foreground))]/60">
            {label}
          </label>
          <input id={testId} data-testid={testId} className={field} placeholder={ph} value={c[k] ?? ''} onChange={set(k)} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn-primary text-sm" data-testid="cms-contact-save">
          <Save size={16} aria-hidden className="mr-1" /> Save
        </button>
        {saved && (
          <span role="status" data-testid="cms-saved" className="text-sm text-emerald-700 dark:text-emerald-400">
            Saved ✓
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

/* ------------------------------- Legal ------------------------------- */
function LegalPanel() {
  const [slug, setSlug] = useState<'terms' | 'privacy'>('terms');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function load(s: 'terms' | 'privacy') {
    setLoading(true);
    try {
      const data = await api<{ slug: string; content: string }>(`/cms/legal/${s}`);
      setContent(data?.content ?? '');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function save() {
    setError('');
    try {
      await api(`/cms/legal/${slug}`, { method: 'PUT', auth: true, body: JSON.stringify({ content }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div role="tablist" aria-label="Legal page" data-testid="cms-legal-toggle" className="inline-flex rounded-xl border p-1">
        {(['terms', 'privacy'] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={slug === s}
            data-testid={`cms-legal-toggle-${s}`}
            onClick={() => setSlug(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              slug === s ? 'bg-brand-700 text-white' : 'hover:bg-[rgb(var(--muted))]'
            }`}
          >
            {s === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="min-h-[320px] animate-pulse rounded-xl border bg-[rgb(var(--muted))]" />
      ) : (
        <RichTextEditor value={content} onChange={setContent} />
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} data-testid="cms-legal-save" className="btn-primary text-sm">
          <Save size={16} aria-hidden className="mr-1" /> Save
        </button>
        {saved && (
          <span role="status" data-testid="cms-saved" className="text-sm text-emerald-700 dark:text-emerald-400">
            Saved ✓
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
