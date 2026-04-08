import NextLink from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sayfa Bulunamadı</h2>
        <p className="text-gray-600 mb-6">Aradığınız sayfa mevcut değil veya taşınmış olabilir.</p>
        <NextLink href="/" className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-secondary transition-colors inline-block">
          Ana Sayfaya Dön
        </NextLink>
      </div>
    </div>
  );
}
