'use client';
import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, LayoutGrid, ArrowRight, RefreshCw } from 'lucide-react';
import Image from 'next/image';

export default function ModeSelectionModal({ language, onComplete }) {
  const tr = language === 'tr';
  const [show,     setShow]     = useState(true);
  const [selected, setSelected] = useState('expert');

  const finish = useCallback(() => {
    setShow(false);
    onComplete?.(selected);
  }, [selected, onComplete]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-white px-4"
    >
      {/* Logo */}
      <div className="absolute top-5 left-6 flex items-center gap-2">
        <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-8 w-auto" />
        <span className="text-[15px] font-bold text-[#072C0E]">Carbonless</span>
      </div>

      {/* Step indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-[#072C0E]/15" />
        <div className="h-2 w-2 rounded-full bg-[#072C0E]/15" />
        <div className="h-2 w-5 rounded-full bg-[#2ABD41]" />
        <div className="h-2 w-2 rounded-full bg-[#072C0E]/15" />
      </div>

      {/* Content */}
      <div className="w-full max-w-xl">
        {/* Heading */}
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#072C0E]/35">
          {tr ? 'Adım 1 / 2' : 'Step 1 / 2'}
        </p>
        <h1 className="text-[28px] font-bold leading-snug text-[#072C0E]">
          {tr ? 'Nasıl çalışmak istersiniz?' : 'How would you like to work?'}
        </h1>
        <p className="mt-1.5 text-[14px] text-[#072C0E]/45">
          {tr
            ? 'İstediğiniz zaman değiştirebilirsiniz. Veri kaybolmaz, her an geçiş mümkün.'
            : 'You can switch anytime — no data is lost, everything carries over.'}
        </p>

        {/* Mode cards */}
        <div className="mt-6 grid grid-cols-2 gap-4">

          {/* Rehberli Mod */}
          <button
            onClick={() => setSelected('guided')}
            className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === 'guided'
                ? 'border-[#2ABD41] bg-[#DEFAE1] shadow-[0_0_0_4px_rgba(42, 189, 65,0.14)]'
                : 'border-[#072C0E]/10 bg-white hover:border-[#072C0E]/20'
            }`}
          >
            {selected === 'guided' && (
              <span className="absolute right-3.5 top-3.5 flex h-2 w-2 rounded-full bg-[#2ABD41]" />
            )}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              selected === 'guided' ? 'bg-[#2ABD41]/20' : 'bg-[#072C0E]/6'
            }`}>
              <MessageCircle className={`h-5 w-5 ${selected === 'guided' ? 'text-[#175022]' : 'text-[#072C0E]/40'}`} />
            </div>
            <div>
              <p className={`text-[15px] font-bold ${selected === 'guided' ? 'text-[#072C0E]' : 'text-[#072C0E]/70'}`}>
                {tr ? 'Rehberli Mod' : 'Guided Mode'}
              </p>
              <p className={`mt-1 text-[12.5px] leading-snug ${selected === 'guided' ? 'text-[#072C0E]/60' : 'text-[#072C0E]/40'}`}>
                {tr
                  ? 'AI chatbot sorularla adım adım yönlendirir.'
                  : 'AI chatbot guides you with questions step by step.'}
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#F5C842]/20 px-2.5 py-0.5 text-[10.5px] font-bold text-[#1A7B2A]">
              {tr ? 'Pro özelliği' : 'Pro feature'}
            </span>
          </button>

          {/* Uzman Modu */}
          <button
            onClick={() => setSelected('expert')}
            className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === 'expert'
                ? 'border-[#2ABD41] bg-[#DEFAE1] shadow-[0_0_0_4px_rgba(42, 189, 65,0.14)]'
                : 'border-[#072C0E]/10 bg-white hover:border-[#072C0E]/20'
            }`}
          >
            {selected === 'expert' && (
              <span className="absolute right-3.5 top-3.5 flex h-2 w-2 rounded-full bg-[#2ABD41]" />
            )}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              selected === 'expert' ? 'bg-[#2ABD41]/20' : 'bg-[#072C0E]/6'
            }`}>
              <LayoutGrid className={`h-5 w-5 ${selected === 'expert' ? 'text-[#175022]' : 'text-[#072C0E]/40'}`} />
            </div>
            <div>
              <p className={`text-[15px] font-bold ${selected === 'expert' ? 'text-[#072C0E]' : 'text-[#072C0E]/70'}`}>
                {tr ? 'Uzman Modu' : 'Expert Mode'}
              </p>
              <p className={`mt-1 text-[12.5px] leading-snug ${selected === 'expert' ? 'text-[#072C0E]/60' : 'text-[#072C0E]/40'}`}>
                {tr
                  ? 'Tüm kategoriler görünür. İstediğiniz yerden başlayın.'
                  : 'All categories visible. Start wherever you like.'}
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#2ABD41]/15 px-2.5 py-0.5 text-[10.5px] font-bold text-[#175022]">
              {tr ? 'Ücretsiz' : 'Free'}
            </span>
          </button>
        </div>

        {/* Data sync note */}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-[#F1FCF2] px-4 py-3">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#175022]" />
          <p className="text-[12px] text-[#072C0E]/50">
            {tr
              ? 'İkisi aynı veriye yazıyor. Her an geçiş yapabilirsiniz, veri taşınır.'
              : 'Both modes share your data. Switch anytime — nothing is lost.'}
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={finish}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#072C0E] py-3.5 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#175022] active:scale-[0.97]"
        >
          {tr ? 'Devam' : 'Continue'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
