import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { I18nProvider } from '@/shared/i18n';
import { LaunchScreen } from '@/shared/ui/launch-screen';

// Runs before paint: if the launch splash was already shown this session, mark
// <html> so CSS hides #launch-overlay immediately (no flash on repeat loads).
const launchGuard = `try{if(sessionStorage.getItem('utsava_launched'))document.documentElement.setAttribute('data-launched','')}catch(e){}`;

export const metadata: Metadata = {
  title: {
    default: 'Utsava — Where Every Moment Becomes a Festival',
    template: '%s · Utsava',
  },
  description:
    'Utsava is a premium event management studio — photography, catering, decoration, lighting, entertainment and function halls. Explore our work and book your celebration.',
  keywords: [
    'Utsava',
    'event management',
    'wedding planner',
    'photography',
    'catering',
    'decoration',
    'function halls',
    'vendors',
  ],
  openGraph: {
    title: 'Utsava — Where Every Moment Becomes a Festival',
    description: 'Premium event management studio. Explore our work and book your celebration.',
    type: 'website',
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500&family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`:root{--font-sans:'Inter',system-ui,sans-serif;--font-display:'Playfair Display',Georgia,serif}`}</style>
        <script dangerouslySetInnerHTML={{ __html: launchGuard }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <LaunchScreen />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
