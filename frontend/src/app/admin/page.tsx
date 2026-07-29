'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Building2,
  Layers,
  CalendarCheck,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '@/shared/lib/api';
import { formatCurrency } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeletons';

type Stats = {
  totalVendors: number;
  totalDepartments: number;
  totalCategories: number;
  totalItems: number;
  totalBookings: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  revenue: string | number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Stats>('/bookings/stats', { auth: true })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  const cards = stats
    ? [
        { label: 'Total Vendors', value: stats.totalVendors, icon: Users, color: 'from-brand-500 to-brand-700' },
        { label: 'Departments', value: stats.totalDepartments, icon: Building2, color: 'from-amber-500 to-rose-600' },
        { label: 'Categories', value: stats.totalCategories, icon: Layers, color: 'from-amber-500 to-orange-600' },
        { label: 'Bookings', value: stats.totalBookings, icon: CalendarCheck, color: 'from-emerald-500 to-teal-600' },
      ]
    : [];

  const statusCards = stats
    ? [
        { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-500' },
        { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-400' },
        { label: 'Cancelled', value: stats.cancelled, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
      ]
    : [];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-sm text-[rgb(var(--foreground))]/60">
          Live metrics from your platform.
        </p>
      </div>

      {error && (
        <div role="alert" data-testid="dashboard-error" className="card mb-6 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load stats: {error}. Make sure the API is running and you are logged in.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!stats && !error
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card space-y-4 p-6">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          : cards.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                data-testid={`dashboard-stat-${c.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                className="card overflow-hidden p-6"
              >
                <div
                  aria-hidden
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white`}
                >
                  <c.icon size={20} />
                </div>
                <div className="text-3xl font-extrabold">{c.value}</div>
                <div className="mt-1 text-sm text-[rgb(var(--foreground))]/60">{c.label}</div>
              </motion.div>
            ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          data-testid="dashboard-revenue"
          className="card p-6 lg:col-span-2"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <IndianRupee size={20} />
            </div>
            <div>
              <div className="text-sm text-[rgb(var(--foreground))]/60">Revenue (confirmed)</div>
              <div className="text-3xl font-extrabold">
                {stats ? formatCurrency(Number(stats.revenue)) : '—'}
              </div>
            </div>
          </div>
          {/* Decorative only: these heights are hard-coded and bear no relation to any
              data, so there is nothing for assistive tech to read here. */}
          <div aria-hidden className="mt-8 flex h-40 items-end gap-3">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 0.4 + i * 0.06, type: 'spring' }}
                className="flex-1 rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400"
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[rgb(var(--foreground))]/70">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          data-testid="dashboard-booking-status"
          className="card p-6"
        >
          <h3 className="font-semibold">Booking status</h3>
          <div className="mt-4 space-y-4">
            {statusCards.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <s.icon size={18} className={s.color} /> {s.label}
                </span>
                <span className="font-bold">{s.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
