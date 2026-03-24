import '@/styles/globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata = {
  title: 'CarbonTrack - Karbon Ayak İzi Hesaplayıcı',
  description: 'Karbon emisyonunuzu hesaplayın ve azaltın. Daha yeşil bir gelecek için.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
