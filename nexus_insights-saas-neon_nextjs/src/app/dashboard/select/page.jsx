'use client';
import { useState } from 'react';
import { MessageCircle, LayoutGrid, ArrowRight, RefreshCw } from 'lucide-react';
import Image from 'next/image';

export default function SelectModePage() {
  const [selected, setSelected] = useState('expert');

  function go() {
    // Session cookie — cleared when browser closes, so mode selection shows again next login
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    if (selected === 'guided') {
      try { localStorage.setItem('carbonless_tour_seen', 'true'); } catch {}
      window.location.href = '/dashboard/workspace';
    } else {
      window.location.href = '/dashboard';
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 relative">

      {/* Logo */}
      <div className="absolute top-5 left-6 flex items-center gap-2">
        <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-8 w-auto" />
        <span className="text-[15px] font-bold text-[#302817]">Carbonless</span>
      </div>

      {/* Step dots */}
      <div className="absolute top-6 right-6 flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-[#302817]/15" />
        <div className="h-2 w-2 rounded-full bg-[#302817]/15" />
        <div className="h-2 w-5 rounded-full bg-[#95A847]" />
        <div className="h-2 w-2 rounded-full bg-[#302817]/15" />
      </div>

      <div className="w-full max-w-xl">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#302817]/35">
          Nasıl çalışmak istersiniz?
        </p>
        <h1 className="text-[28px] font-bold leading-snug text-[#302817]">
          Bir mod seçin
        </h1>
        <p className="mt-1.5 text-[14px] text-[#302817]/45">
          İstediğiniz zaman değiştirebilirsiniz. Veri kaybolmaz, her an geçiş mümkün.
        </p>

        {/* Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4">

          {/* Rehberli */}
          <button
            type="button"
            onClick={() => setSelected('guided')}
            className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === 'guided'
                ? 'border-[#95A847] bg-[#F2F6E4]'
                : 'border-[#302817]/10 bg-white hover:border-[#302817]/20'
            }`}
          >
            {selected === 'guided' && (
              <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-[#95A847]" />
            )}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected === 'guided' ? 'bg-[#95A847]/20' : 'bg-[#302817]/6'}`}>
              <MessageCircle className={`h-5 w-5 ${selected === 'guided' ? 'text-[#75863B]' : 'text-[#302817]/40'}`} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#302817]">Rehberli Mod</p>
              <p className="mt-1 text-[12.5px] leading-snug text-[#302817]/50">
                AI chatbot sorularla adım adım yönlendirir.
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#F5C842]/20 px-2.5 py-0.5 text-[10.5px] font-bold text-[#A07A00]">
              Pro özelliği
            </span>
          </button>

          {/* Uzman */}
          <button
            type="button"
            onClick={() => setSelected('expert')}
            className={`relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-200 active:scale-[0.98] ${
              selected === 'expert'
                ? 'border-[#95A847] bg-[#F2F6E4]'
                : 'border-[#302817]/10 bg-white hover:border-[#302817]/20'
            }`}
          >
            {selected === 'expert' && (
              <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-[#95A847]" />
            )}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected === 'expert' ? 'bg-[#95A847]/20' : 'bg-[#302817]/6'}`}>
              <LayoutGrid className={`h-5 w-5 ${selected === 'expert' ? 'text-[#75863B]' : 'text-[#302817]/40'}`} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#302817]">Uzman Modu</p>
              <p className="mt-1 text-[12.5px] leading-snug text-[#302817]/50">
                Tüm kategoriler görünür. İstediğiniz yerden başlayın.
              </p>
            </div>
            <span className="w-fit rounded-full bg-[#95A847]/15 px-2.5 py-0.5 text-[10.5px] font-bold text-[#75863B]">
              Ücretsiz
            </span>
          </button>
        </div>

        {/* Note */}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-[#F8F6F0] px-4 py-3">
          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#75863B]" />
          <p className="text-[12px] text-[#302817]/50">
            İkisi aynı veriye yazıyor. Her an geçiş yapabilirsiniz, veri taşınır.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={go}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] py-3.5 text-[14px] font-bold text-white transition hover:bg-black active:scale-[0.97]"
        >
          Devam
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
