import '@/styles/globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata = {
  title: 'Carbonless - ISO 14064-1 Karbon Envanteri Platformu',
  description: 'ISO 14064-1 ve GHG Protocol uyumlu karbon ayak izi hesaplama, raporlama ve azaltma platformu. Defra 2024, IPCC, ATOM KABLO emisyon faktörleri.',
  keywords: 'karbon ayak izi, ISO 14064-1, GHG Protocol, emisyon hesaplama, carbon footprint, Carbonless',
  openGraph: {
    title: 'Carbonless - Carbon Footprint Calculator',
    description: 'ISO 14064-1 compliant carbon inventory platform with 131+ emission factors.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link rel="icon" href="/carbonless.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-inter antialiased min-h-screen overflow-x-hidden">
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
