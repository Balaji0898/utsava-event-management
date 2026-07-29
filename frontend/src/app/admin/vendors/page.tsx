'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, ShieldCheck, Star } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { formatCurrency } from '@/shared/lib/utils';
import { TableSkeleton } from '@/shared/ui/skeletons';
import { Pagination } from '@/shared/ui/pagination';

type Vendor = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  priceFrom: string | number;
  verified: boolean;
  featured: boolean;
  status: string;
  contactNumber?: string;
  department?: { name: string };
};

const PAGE_SIZE = 10;

export default function AdminVendors() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api<{ data: Vendor[]; pages: number }>(
        `/vendors?page=${page}&limit=${PAGE_SIZE}`,
      );
      setItems(r.data);
      setPages(r.pages || 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function remove(id: string) {
    if (!confirm('Delete this vendor and all its packages?')) return;
    try {
      await api(`/vendors/${id}`, { method: 'DELETE', auth: true });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendors & Work</h2>
          <p className="text-sm text-[rgb(var(--foreground))]/60">
            Edit every detail — work, gallery, contact and pricing.
          </p>
        </div>
        <Link href="/admin/vendors/new" className="btn-primary" data-testid="vend-add">
          <Plus size={16} aria-hidden className="mr-1" /> Add vendor
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : (
      // tabIndex: see the bookings table — keyboard-scrollable region.
      <div className="card overflow-x-auto" tabIndex={0} role="group" aria-label="Vendors table">
        <table data-testid="vend-table" className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[rgb(var(--muted))] text-left">
            <tr>
              <th className="px-5 py-3">Vendor</th>
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Rating</th>
              <th className="px-5 py-3">From</th>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v, i) => (
              <motion.tr
                key={v.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                data-testid={`vend-row-${v.id}`}
                className="border-b last:border-0"
              >
                <td className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-1">
                    {v.name}
                    {v.verified && <ShieldCheck size={14} className="text-brand-500" />}
                  </span>
                </td>
                <td className="px-5 py-3 text-[rgb(var(--foreground))]/60">{v.department?.name}</td>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-1">
                    <Star size={12} className="fill-yellow-400 text-yellow-400" />
                    {v.rating}
                  </span>
                </td>
                <td className="px-5 py-3">{formatCurrency(Number(v.priceFrom))}</td>
                <td className="px-5 py-3 text-[rgb(var(--foreground))]/60">{v.contactNumber ?? '—'}</td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">
                    {v.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/vendors/${v.id}`}
                      className="rounded-lg border p-2 hover:bg-[rgb(var(--muted))]"
                      aria-label={`Edit ${v.name}`}
                      data-testid={`vend-row-edit-${v.id}`}
                    >
                      <Pencil size={15} aria-hidden />
                    </Link>
                    <button
                      onClick={() => remove(v.id)}
                      className="rounded-lg border border-red-500/30 p-2 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                      aria-label={`Delete ${v.name}`}
                      data-testid={`vend-row-delete-${v.id}`}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  data-testid="vend-empty"
                  className="px-5 py-8 text-center text-[rgb(var(--foreground))]/70"
                >
                  No vendors yet. Click “Add vendor”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!loading && (
        <div data-testid="vend-pagination">
          <Pagination page={page} pages={pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
