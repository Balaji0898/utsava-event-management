import { Navbar } from '@/features/website/components/navbar';
import { Footer } from '@/features/website/components/footer';
import { WhatsappFab } from '@/features/website/components/whatsapp-fab';
import { SmoothScroll } from '@/shared/motion/smooth-scroll';
import { serverApi, CACHE_TAGS } from '@/shared/lib/api';
import { SiteContactProvider } from '@/shared/config/site-contact-context';
import type { SiteContact } from '@/shared/config/site';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Short budget so a cold backend can't keep the site shell blank on first
  // paint — falls back to default contact and warms from cache on later loads.
  const contact = await serverApi<Partial<SiteContact>>('/cms/contact', {
    tags: [CACHE_TAGS.cms],
    timeoutMs: 2500,
    retries: 0,
  });

  return (
    <SmoothScroll>
      <SiteContactProvider value={contact}>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsappFab />
        </div>
      </SiteContactProvider>
    </SmoothScroll>
  );
}
