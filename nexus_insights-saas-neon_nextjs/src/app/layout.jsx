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
    <html lang="tr">
      <head>
        <link rel="icon" href="/carbonless.png" />
      </head>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
