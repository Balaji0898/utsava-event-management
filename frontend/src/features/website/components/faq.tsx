'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '@/shared/i18n';

type FaqItem = { id: string; question: string; answer: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length) return null;

  return (
    <section id="faq" className="container-page py-16">
      <h2 className="text-3xl font-bold">{t('faq.title')}</h2>
      <div className="mx-auto mt-8 max-w-3xl space-y-3">
        {items.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="flex w-full items-center justify-between px-6 py-4 text-left font-medium"
              >
                {f.question}
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                  <ChevronDown size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm text-[rgb(var(--foreground))]/70">
                      {f.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
