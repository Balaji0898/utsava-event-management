'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Reusable Prev / 1 2 3 / Next pager. */
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;

  // window of page numbers around current
  const nums: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i++) nums.push(i);

  const btn =
    'flex h-9 min-w-9 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-40';

  return (
    <div className="mt-8 flex items-center justify-center gap-2">
      <button
        className={btn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      {start > 1 && (
        <>
          <button className={btn} onClick={() => onChange(1)}>
            1
          </button>
          {start > 2 && <span className="px-1 text-[rgb(var(--foreground))]/40">…</span>}
        </>
      )}
      {nums.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          aria-current={n === page ? 'page' : undefined}
          className={`${btn} ${
            n === page ? 'border-transparent bg-brand-500 text-ink' : 'hover:bg-[rgb(var(--muted))]'
          }`}
        >
          {n}
        </button>
      ))}
      {end < pages && (
        <>
          {end < pages - 1 && <span className="px-1 text-[rgb(var(--foreground))]/40">…</span>}
          <button className={btn} onClick={() => onChange(pages)}>
            {pages}
          </button>
        </>
      )}
      <button
        className={btn}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
