'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/shared/lib/api';
import { formatCurrency } from '@/shared/lib/utils';
import { TableSkeleton } from '@/shared/ui/skeletons';

type Booking = {
  id: string;
  customerName: string;
  customerEmail: string;
  eventDate?: string;
  location?: string;
  guestCount?: number;
  budget?: string | number;
  status: string;
  vendor?: { name: string };
};

const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

export default function AdminBookings() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Booking[]>('/bookings', { auth: true }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      await api(`/bookings/${id}/status`, {
        method: 'PATCH',
        auth: true,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const badge = (s: string) =>
    ({
      PENDING: 'bg-amber-500/10 text-amber-500',
      CONFIRMED: 'bg-emerald-500/10 text-emerald-500',
      CANCELLED: 'bg-red-500/10 text-red-500',
      COMPLETED: 'bg-brand-500/10 text-brand-500',
    })[s] ?? 'bg-gray-500/10';

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Bookings</h2>
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : (
      // tabIndex makes the horizontal scroll container reachable by keyboard (axe
      // `scrollable-region-focusable`); without it the table cannot be scrolled
      // without a pointer at narrow widths.
      <div className="card overflow-x-auto" tabIndex={0} role="group" aria-label="Bookings table">
        <table data-testid="booking-table" className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[rgb(var(--muted))] text-left">
            <tr>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Vendor</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Budget</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b, i) => (
              <motion.tr
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                data-testid={`booking-row-${b.id}`}
                className="border-b last:border-0"
              >
                <td className="px-5 py-3">
                  <div className="font-medium">{b.customerName}</div>
                  <div className="text-xs text-[rgb(var(--foreground))]/50">
                    {b.customerEmail}
                  </div>
                </td>
                <td className="px-5 py-3">{b.vendor?.name ?? '—'}</td>
                <td className="px-5 py-3">
                  {b.eventDate ? new Date(b.eventDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-5 py-3">
                  {b.budget ? formatCurrency(Number(b.budget)) : '—'}
                </td>
                <td className="px-5 py-3">
                  {/* data-status carries the meaning that is otherwise encoded only in
                      colour (WCAG 1.4.1), and gives tests a stable handle. */}
                  <span
                    data-testid={`booking-row-badge-${b.id}`}
                    data-status={b.status}
                    className={`rounded-full px-2 py-1 text-xs ${badge(b.status)}`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={b.status}
                    onChange={(e) => updateStatus(b.id, e.target.value)}
                    data-testid={`booking-row-status-${b.id}`}
                    aria-label={`Booking status for ${b.customerName}`}
                    className="rounded-lg border bg-[rgb(var(--card))] px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </motion.tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  data-testid="booking-empty"
                  className="px-5 py-8 text-center text-[rgb(var(--foreground))]/50"
                >
                  No bookings yet.
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
