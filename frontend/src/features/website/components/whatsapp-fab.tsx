'use client';

import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { whatsappHref } from '@/shared/config/site';
import { useSiteContact } from '@/shared/config/site-contact-context';

export function WhatsappFab() {
  const contact = useSiteContact();
  return (
    <motion.a
      href={whatsappHref(contact.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      data-testid="whatsapp-fab"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-luxe"
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-30" />
      <MessageCircle size={26} />
    </motion.a>
  );
}
