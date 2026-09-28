'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// A legal page in the UI language. `content` is { tr, en }, each
// { title, updated, sections: [{ h, p, email? }] }.
export default function LegalPage({ content }) {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const c = tr ? content.tr : content.en;
  return (
    <div className="min-h-screen bg-[#F1FCF2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[#072C0E]/50 transition hover:text-[#072C0E]">
          <ArrowLeft className="h-4 w-4" /> {tr ? 'Ana Sayfaya Dön' : 'Back to Home'}
        </Link>

        <div className="rounded-[1.5rem] border border-[#072C0E]/10 bg-white/80 p-6 shadow-[0_8px_30px_rgba(7, 44, 14,0.06)] backdrop-blur-xl sm:p-10">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#072C0E] sm:text-3xl">{c.title}</h1>
          <p className="mt-2 text-sm text-[#072C0E]/50">{c.updated}</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-[#072C0E]/70">
            {c.sections.map((s, i) => (
              <section key={i}>
                <h2 className="mb-2 text-base font-bold text-[#072C0E]">{i + 1}. {s.h}</h2>
                <p>
                  {s.p}
                  {s.email && <> <span className="font-bold text-[#2ABD41]">{s.email}</span></>}
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
