import type { Metadata, Viewport } from 'next';
import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { getSettings } from '@/lib/settings';
import { siteUrl } from '@/lib/site';
import '@/styles/shop.css';

// Self-hosted at build time: no requests to Google from visitors' browsers.
const display = Big_Shoulders({ subsets: ['latin'], axes: ['opsz'], variable: '--font-display', display: 'swap', adjustFontFallback: false });
const sans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${s.storeName} · Melanotan I and II, tested lot by lot`, template: `%s | ${s.storeName}` },
    description: 'Melanotan I and Melanotan II in 10 mg research vials, every lot tested by HPLC and mass spectrometry with the report online. UK supplier. Laboratory research use only.',
    robots: s.noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { siteName: s.storeName, type: 'website', locale: 'en_GB', images: [{ url: '/img/duo.webp', width: 1000, height: 900, alt: 'Melanotan I and Melanotan II research vials' }] },
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#16100C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
