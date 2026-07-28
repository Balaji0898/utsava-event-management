'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { api } from '@/shared/lib/api';
import { formatCurrency } from '@/shared/lib/utils';

type Pkg = {
  id: string;
  name: string;
  price: string | number;
  features: string[];
  popular: boolean;
};

const inputCls =
  'w-full rounded-xl border bg-[rgb(var(--card))] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500';

export function PackagesManager({ vendorId }: { vendorId: string }) {
  const [items, setItems] = useState<Pkg[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [features, setFeatures] = useState('');
  const [popular, setPopular] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setItems(await api<Pkg[]>(`/packages?vendorId=${vendorId}`));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [vendorId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) return;
    try {
      await api('/packages', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          vendorId,
          name,
          price: Number(price),
          popular,
          features: features.split('\n').map((f) => f.trim()).filter(Boolean),
        }),
      });
      setName('');
      setPrice('');
      setFeatures('');
      setPopular(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete package?')) return;
    await api(`/packages/${id}`, { method: 'DELETE', auth: true });
    await load();
  }

  return (
    <div className="card p-6" data-testid="pkg-manager">
      <h3 className="mb-4 font-display text-lg font-semibold">Packages (pricing tiers)</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} data-testid="pkg-create-form" className="space-y-3 rounded-2xl border p-4">
          <input aria-label="Package name" data-testid="pkg-name" className={inputCls} placeholder="Package name (e.g. Premium)" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Package price in rupees" data-testid="pkg-price" className={inputCls} type="number" placeholder="Price (₹)" value={price} onChange={(e) => setPrice(e.target.value)} />
          <textarea
            aria-label="Features, one per line"
            data-testid="pkg-features"
            className={inputCls}
            rows={4}
            placeholder={'Features (one per line)\n2 Photographers\nDrone\nAlbum'}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" data-testid="pkg-popular" checked={popular} onChange={(e) => setPopular(e.target.checked)} className="h-4 w-4 accent-brand-500" />
            Mark as most popular
          </label>
          <button className="btn-primary w-full" data-testid="pkg-submit">
            <Plus size={16} aria-hidden className="mr-1" /> Add package
          </button>
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        </form>

        <div className="space-y-3" data-testid="pkg-list">
          {items.map((p) => (
            <div key={p.id} data-testid={`pkg-row-${p.id}`} className={`rounded-2xl border p-4 ${p.popular ? 'ring-2 ring-brand-500' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {p.name}
                    {p.popular && (
                      <span data-testid={`pkg-row-popular-${p.id}`} className="ml-2 chip">
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold">{formatCurrency(Number(p.price))}</div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  aria-label={`Delete package ${p.name}`}
                  data-testid={`pkg-row-delete-${p.id}`}
                  className="text-red-500"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-[rgb(var(--foreground))]/70">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check size={14} aria-hidden className="text-brand-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {items.length === 0 && (
            <p data-testid="pkg-empty" className="text-sm text-[rgb(var(--foreground))]/50">
              No packages yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
