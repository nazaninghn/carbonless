import '@/styles/globals.css';
// Inter is served from the repository's own dependency (@fontsource-variable/inter), not downloaded from
// Google Fonts at build time: a build must not fail because a font server answered oddly. The stylesheet
// carries every subset with its unicode-range (latin-ext is what Turkish needs: ğ Ğ ş Ş ı İ), one variable
// file for weights 100-900, font-display: swap. The family is named in globals.css (--font-inter).
import '@fontsource-variable/inter';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import PageTitle from '@/components/PageTitle';
import SessionIdleGuard from '@/components/SessionIdleGuard';


export const metadata = {
  title: 'Carbonless — AI-Powered Carbon Calculator Platform',
  description: 'Measure your carbon footprint with AI guidance. ISO 14064-1 compliant reports, DEFRA, IPCC and Turkish national emission factors, Scope 1-2-3 calculations. Free during beta.',
  keywords: 'carbon footprint calculator, ISO 14064-1, GHG Protocol, carbon accounting, AI carbon calculator, emission factors, Scope 1 2 3, ESG reporting, Carbonless',
  authors: [{ name: 'Carbonless' }],
  creator: 'Carbonless',
  metadataBase: new URL('https://carbonless.info'),
  openGraph: {
    title: 'Carbonless — AI-Powered Carbon Calculator',
    description: 'Measure, report, and reduce your company\'s carbon footprint with AI. ISO 14064-1 compliant. DEFRA, IPCC and Turkish national emission factors.',
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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/carbonless.png" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" />
        {/* Trying General Sans for the hero headline — Fontshare CDN */}
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-inter antialiased min-h-screen overflow-x-clip">
        <LanguageProvider>
          <PageTitle />
          <SessionIdleGuard />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
