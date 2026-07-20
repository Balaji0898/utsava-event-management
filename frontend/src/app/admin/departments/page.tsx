'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { TableSkeleton } from '@/shared/ui/skeletons';

type Department = {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  status: string;
  _count?: { vendors: number; categories: number };
};

export default function AdminDepartments() {
  const [items, setItems] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
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
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      await api('/departments', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ name, icon }),
      });
      setName('');
      setIcon('');
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

  const field =
    'rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Departments</h2>

      <form onSubmit={create} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium">Name</label>
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mehendi"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium">Icon (emoji)</label>
          <input
            className={`${field} w-28`}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🎨"
          />
        </div>
        <button disabled={loading} className="btn-primary">
          <Plus size={16} className="mr-1" /> Add
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {initialLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : (
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-[rgb(var(--muted))] text-left">
            <tr>
              <th className="px-5 py-3">Department</th>
              <th className="px-5 py-3">Slug</th>
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
                <td className="px-5 py-3 text-[rgb(var(--foreground))]/60">{d.slug}</td>
                <td className="px-5 py-3">{d._count?.vendors ?? 0}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">
                    {d.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => remove(d.id)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </motion.tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[rgb(var(--foreground))]/50">
                  No departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
