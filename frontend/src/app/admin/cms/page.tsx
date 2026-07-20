'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Star } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { ImageUploader } from '@/features/admin/components/image-uploader';

type Testimonial = {
  id: string;
  name: string;
  role?: string;
  message: string;
  avatar?: string;
  rating: number;
};
type Faq = { id: string; question: string; answer: string };

const field =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

export default function AdminCms() {
  const [tab, setTab] = useState<'testimonials' | 'faqs'>('testimonials');

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Content Management</h2>

      <div className="mb-6 inline-flex rounded-xl border p-1">
        {(['testimonials', 'faqs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-brand-600 text-white' : 'hover:bg-[rgb(var(--muted))]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'testimonials' ? <TestimonialsPanel /> : <FaqsPanel />}
    </div>
  );
}

function TestimonialsPanel() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [avatar, setAvatar] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Testimonial[]>('/cms/testimonials?all=true'));
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

  async function remove(id: string) {
    if (!confirm('Delete testimonial?')) return;
    await api(`/cms/testimonials/${id}`, { method: 'DELETE', auth: true });
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={create} className="card space-y-3 p-5">
        <h3 className="font-semibold">Add testimonial</h3>
        <input
          className={field}
          placeholder="Customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={field}
          placeholder="Role (e.g. Bride)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <textarea
          className={field}
          rows={3}
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div>
          <label className="mb-1 block text-xs font-medium">Avatar</label>
          <ImageUploader folder="testimonials" value={avatar} onChange={setAvatar} />
        </div>
        <button className="btn-primary w-full">
          <Plus size={16} className="mr-1" /> Add
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>

      <div className="space-y-3 lg:col-span-2">
        {items.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card flex items-start gap-4 p-4"
          >
            {t.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.avatar} alt={t.name} className="h-12 w-12 rounded-full object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold">
                {t.name}
                <span className="text-xs text-[rgb(var(--foreground))]/50">{t.role}</span>
              </div>
              <div className="mt-0.5 flex">
                {Array.from({ length: t.rating }).map((_, s) => (
                  <Star key={s} size={12} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mt-1 text-sm text-[rgb(var(--foreground))]/70">{t.message}</p>
            </div>
            <button onClick={() => remove(t.id)} className="text-red-500">
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[rgb(var(--foreground))]/50">No testimonials yet.</p>
        )}
      </div>
    </div>
  );
}

function FaqsPanel() {
  const [items, setItems] = useState<Faq[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Faq[]>('/cms/faqs?all=true'));
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
      await api('/cms/faqs', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ question, answer }),
      });
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
      <form onSubmit={create} className="card space-y-3 p-5">
        <h3 className="font-semibold">Add FAQ</h3>
        <input
          className={field}
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <textarea
          className={field}
          rows={4}
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button className="btn-primary w-full">
          <Plus size={16} className="mr-1" /> Add
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>

      <div className="space-y-3 lg:col-span-2">
        {items.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card flex items-start gap-4 p-4"
          >
            <div className="flex-1">
              <div className="font-semibold">{f.question}</div>
              <p className="mt-1 text-sm text-[rgb(var(--foreground))]/70">{f.answer}</p>
            </div>
            <button onClick={() => remove(f.id)} className="text-red-500">
              <Trash2 size={16} />
            </button>
          </motion.div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[rgb(var(--foreground))]/50">No FAQs yet.</p>
        )}
      </div>
    </div>
  );
}
