import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

const inter = Inter({
  // latin-ext is required for Turkish: ğ Ğ ş Ş ı İ live in Latin Extended-A
  // (U+0100-017F). With only 'latin', those glyphs fell back to Arial/Segoe
  // mid-word while ç/ö/ü (Latin-1, included in 'latin') stayed Inter —
  // producing the unstable mixed-font look on every Turkish page.
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Carbonless — AI-Powered Carbon Calculator Platform',
  description: 'Measure your carbon footprint with AI guidance. ISO 14064-1 compliant reports, 188+ emission factors, Scope 1-2-3 calculations. Free to start.',
  keywords: 'carbon footprint calculator, ISO 14064-1, GHG Protocol, carbon accounting, AI carbon calculator, emission factors, Scope 1 2 3, ESG reporting, Carbonless',
  authors: [{ name: 'Carbonless' }],
  creator: 'Carbonless',
  metadataBase: new URL('https://carbonless.info'),
  openGraph: {
    title: 'Carbonless — AI-Powered Carbon Calculator',
    description: 'Measure, report, and reduce your company\'s carbon footprint with AI. ISO 14064-1 compliant. 188+ emission factors.',
    type: 'website',
    siteName: 'Carbonless',
    locale: 'en_US',
    images: [{ url: '/carbon-hero.png', width: 800, height: 600, alt: 'Carbonless AI Carbon Calculator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carbonless — AI Carbon Calculator',
    description: 'ISO 14064-1 compliant carbon accounting platform powered by AI.',
    images: ['/carbon-hero.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/carbonless.png" />
      </head>
      <body className="font-inter antialiased min-h-screen overflow-x-hidden">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
