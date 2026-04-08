'use client';

export default function Error({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Bir hata oluştu</h2>
        <p className="text-gray-600 mb-6 text-sm">{error?.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-secondary transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
