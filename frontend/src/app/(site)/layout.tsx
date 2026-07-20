import { Navbar } from '@/features/website/components/navbar';
import { Footer } from '@/features/website/components/footer';
import { WhatsappFab } from '@/features/website/components/whatsapp-fab';
import { SmoothScroll } from '@/shared/motion/smooth-scroll';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <WhatsappFab />
      </div>
    </SmoothScroll>
  );
}
