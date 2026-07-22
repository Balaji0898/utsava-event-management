'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Pencil, X, Save } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { TableSkeleton } from '@/shared/ui/skeletons';
import { ImageUploader } from '@/features/admin/components/image-uploader';

type Department = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  banner?: string;
  description?: string;
  status: string;
  _count?: { vendors: number; categories: number };
};

type DraftFields = { name: string; icon: string; description: string; banner: string };
const emptyDraft: DraftFields = { name: '', icon: '', description: '', banner: '' };

const field =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

export default function AdminDepartments() {
  const [items, setItems] = useState<Department[]>([]);
  const [draft, setDraft] = useState<DraftFields>(emptyDraft);
  const [editing, setEditing] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Department[]>('/departments?all=true'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInitialLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name) return;
    setLoading(true);
    setError('');
    try {
      await api('/departments', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          name: draft.name,
          icon: draft.icon,
          description: draft.description,
          banner: draft.banner,
        }),
      });
      setDraft(emptyDraft);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    setError('');
    try {
      await api(`/departments/${editing.id}`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({
          name: editing.name,
          icon: editing.icon ?? '',
          description: editing.description ?? '',
          banner: editing.banner ?? '',
        }),
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this department?')) return;
    try {
      await api(`/departments/${id}`, { method: 'DELETE', auth: true });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-2xl font-bold">Categories</h2>
      <p className="mb-6 text-sm text-[rgb(var(--foreground))]/60">
        Categories (services) shown across the site — each with an image and description.
      </p>

      {/* Create */}
      <form onSubmit={create} className="card mb-6 grid gap-4 p-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input className={field} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Mehendi" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Icon (emoji)</label>
          <input className={field} value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="🎨" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium">Description</label>
          <textarea className={field} rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Short description shown on the category card" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium">Banner image</label>
          <ImageUploader folder="departments" value={draft.banner} onChange={(u) => setDraft({ ...draft, banner: u })} />
        </div>
        <div>
          <button disabled={loading} className="btn-primary">
            <Plus size={16} className="mr-1" /> Add category
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {initialLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-[rgb(var(--muted))] text-left">
              <tr>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Image</th>
                <th className="px-5 py-3">Vendors</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => (
                <motion.tr
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b last:border-0"
                >
                  <td className="px-5 py-3 font-medium">
                    {d.icon} {d.name}
                  </td>
                  <td className="px-5 py-3">
                    {d.banner ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.banner} alt={d.name} className="h-10 w-16 rounded-md object-cover" />
                    ) : (
                      <span className="text-xs text-amber-500">No image</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{d._count?.vendors ?? 0}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setEditing(d)} className="text-[rgb(var(--foreground))]/60 hover:text-brand-500" aria-label="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => remove(d.id)} className="text-red-500 hover:text-red-600" aria-label="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[rgb(var(--foreground))]/50">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-lg space-y-4 p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit category</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Name</label>
                <input className={field} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Icon (emoji)</label>
                <input className={field} value={editing.icon ?? ''} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <textarea className={field} rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Banner image</label>
              <ImageUploader folder="departments" value={editing.banner ?? ''} onChange={(u) => setEditing({ ...editing, banner: u })} />
            </div>
            <div className="flex justify-end">
              <button disabled={loading} className="btn-primary">
                <Save size={16} className="mr-1" /> Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
