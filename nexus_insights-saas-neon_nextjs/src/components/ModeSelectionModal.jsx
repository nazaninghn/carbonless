'use client';
import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, LayoutGrid, ArrowRight, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'carbonless_mode_selected';

export default function ModeSelectionModal({ language, onComplete }) {
  const tr = language === 'tr';
  const [show, setShow]       = useState(false);
  const [selected, setSelected] = useState('expert'); // 'guided' | 'expert'
  const [step, setStep]       = useState(0); // 0 = welcome, 1 = mode pick

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {}
  }, []);

  const finish = useCallback((mode) => {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
    setShow(false);
    onComplete?.(mode);
  }, [onComplete]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#302817]/30 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_80px_rgba(48,40,23,0.18)]">

        {/* Step dots */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex items-center gap-1.5">
            {[0, 1].map(i => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === step
                    ? 'w-5 h-2 bg-[#95A847]'
                    : i < step
                    ? 'w-2 h-2 bg-[#95A847]/60'
                    : 'w-2 h-2 bg-[#302817]/12'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-[#302817]/30 uppercase tracking-widest">
            {step + 1} / 2
          </span>
        </div>

        <div className="px-6 pt-4 pb-6">

          {/* ─── STEP 0: WELCOME ─────────────────────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#302817]">
                <Sparkles className="h-7 w-7 text-[#B4BE6A]" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#302817] leading-snug">
                  {tr ? 'Hoş Geldiniz 👋' : 'Welcome 👋'}
                </h2>
                <p className="mt-2 text-[13.5px] text-[#302817]/55 leading-relaxed max-w-sm mx-auto">
                  {tr
                    ? 'Karbon emisyonlarınızı yönetmeye başlamadan önce size en uygun çalışma şeklini belirleyelim.'
                    : 'Before we start tracking your carbon emissions, let\'s find the best way for you to work.'}
                </p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="mt-2 flex items-center gap-2 rounded-full bg-[#302817] px-7 py-3 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-black active:scale-[0.97]"
              >
                {tr ? 'Başlayalım' : "Let's start"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ─── STEP 1: MODE SELECTION ──────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-[20px] font-bold text-[#302817] leading-snug">
                  {tr ? 'Nasıl çalışmak istersiniz?' : 'How would you like to work?'}
                </h2>
                <p className="mt-1 text-[12.5px] text-[#302817]/45">
                  {tr
                    ? 'İstediğiniz zaman değiştirebilirsiniz.'
                    : 'You can switch anytime — no data is lost.'}
                </p>
              </div>

              {/* Mode cards */}
              <div className="grid grid-cols-2 gap-3">

                {/* Rehberli Mod */}
                <button
                  onClick={() => setSelected('guided')}
                  className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.97] ${
                    selected === 'guided'
                      ? 'border-[#95A847] bg-[#F2F6E4] shadow-[0_0_0_4px_rgba(149,168,71,0.12)]'
                      : 'border-[#302817]/10 bg-white hover:border-[#302817]/20 hover:bg-[#302817]/2'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected === 'guided' ? 'bg-[#95A847]/18' : 'bg-[#302817]/6'}`}>
                    <MessageCircle className={`h-[18px] w-[18px] ${selected === 'guided' ? 'text-[#75863B]' : 'text-[#302817]/45'}`} />
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${selected === 'guided' ? 'text-[#302817]' : 'text-[#302817]/75'}`}>
                      {tr ? 'Rehberli Mod' : 'Guided Mode'}
                    </p>
                    <p className={`mt-0.5 text-[11px] leading-snug ${selected === 'guided' ? 'text-[#302817]/60' : 'text-[#302817]/40'}`}>
                      {tr
                        ? 'AI chatbot sorularla yönlendirir, adım adım ilerlersiniz.'
                        : 'AI chatbot guides you with questions, step by step.'}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#F5C842]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#A07A00]">
                    {tr ? 'Pro özelliği' : 'Pro feature'}
                  </span>
                  {selected === 'guided' && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#95A847]" />
                  )}
                </button>

                {/* Uzman Modu */}
                <button
                  onClick={() => setSelected('expert')}
                  className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.97] ${
                    selected === 'expert'
                      ? 'border-[#95A847] bg-[#F2F6E4] shadow-[0_0_0_4px_rgba(149,168,71,0.12)]'
                      : 'border-[#302817]/10 bg-white hover:border-[#302817]/20 hover:bg-[#302817]/2'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${selected === 'expert' ? 'bg-[#95A847]/18' : 'bg-[#302817]/6'}`}>
                    <LayoutGrid className={`h-[18px] w-[18px] ${selected === 'expert' ? 'text-[#75863B]' : 'text-[#302817]/45'}`} />
                  </div>
                  <div>
                    <p className={`text-[13px] font-bold ${selected === 'expert' ? 'text-[#302817]' : 'text-[#302817]/75'}`}>
                      {tr ? 'Uzman Modu' : 'Expert Mode'}
                    </p>
                    <p className={`mt-0.5 text-[11px] leading-snug ${selected === 'expert' ? 'text-[#302817]/60' : 'text-[#302817]/40'}`}>
                      {tr
                        ? 'Tüm kategoriler görünür. İstediğiniz yerden başlayın.'
                        : 'All categories visible. Start wherever you like.'}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#95A847]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#75863B]">
                    {tr ? 'Ücretsiz' : 'Free'}
                  </span>
                  {selected === 'expert' && (
                    <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#95A847]" />
                  )}
                </button>
              </div>

              {/* Data sync note */}
              <div className="flex items-center gap-2 rounded-xl bg-[#302817]/4 px-3.5 py-2.5">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 text-[#75863B]" />
                <p className="text-[11px] text-[#302817]/50">
                  {tr
                    ? 'İkisi aynı veriye yazar. Her an geçiş yapabilirsiniz, veri kaybolmaz.'
                    : 'Both modes share the same data. Switch anytime without losing anything.'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => finish(selected)}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] py-3 text-[13.5px] font-bold text-white shadow-sm transition hover:bg-black active:scale-[0.97]"
                >
                  {tr ? 'Devam' : 'Continue'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setStep(0)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[12px] font-semibold text-[#302817]/40 transition hover:text-[#302817]/70"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {tr ? 'Geri' : 'Back'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
