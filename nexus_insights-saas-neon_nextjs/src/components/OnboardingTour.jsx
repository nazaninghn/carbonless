'use client';
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Leaf, BarChart3, FileText, Users, Settings, Bot, Target, Sparkles } from 'lucide-react';

const STEPS = {
  tr: [
    {
      icon: Sparkles,
      title: 'Carbonless\'a Hoş Geldiniz',
      description: 'ISO 14064-1 standardına uygun karbon envanteri platformunuza hoş geldiniz. Bu kısa tur ile platformu tanıyalım.',
      tip: 'Başlayalım!',
    },
    {
      icon: BarChart3,
      title: 'Gösterge Paneli',
      description: 'Ana sayfanız burasıdır. Toplam emisyonlarınızı, Scope dağılımını, aylık trendleri ve tesis verilerini burada görebilirsiniz.',
      tip: 'Sol menüden "Gösterge Paneli" sekmesine tıklayın.',
    },
    {
      icon: Leaf,
      title: 'Emisyon Yönetimi',
      description: 'Emisyon verilerinizi buradan girersiniz. Scope seçin, kategori belirleyin, kaynağı seçin ve miktarı girin. Sistem otomatik CO₂e hesaplar.',
      tip: '"Emisyonlar" sekmesinden "Yeni Kayıt" butonuna tıklayın.',
    },
    {
      icon: Target,
      title: 'Azaltma Hedefleri',
      description: 'Karbon azaltma hedeflerinizi belirleyin. Baz yıl, hedef yıl ve azaltma yüzdesini girerek ilerlemenizi takip edin.',
      tip: '"Hedefler" sekmesinden hedef ekleyin.',
    },
    {
      icon: FileText,
      title: 'Raporlama',
      description: 'ISO 14064-1 uyumlu profesyonel PDF raporları oluşturun. Türkçe/İngilizce rapor, CSV ve Excel dışa aktarma seçenekleri mevcuttur.',
      tip: '"Raporlama" sekmesinden PDF indirin.',
    },
    {
      icon: Bot,
      title: 'AI Carbon Asistanı',
      description: 'CarbonIQ ile karbon envanteri anketini adım adım tamamlayın. AI destekli iş akışları raporlama yapılandırmanızı belirler.',
      tip: '"AI Carbon" sekmesine tıklayın.',
    },
    {
      icon: Users,
      title: 'Takım Yönetimi',
      description: 'Ekip üyelerinizi davet edin ve rollerini yönetin. Owner, Admin, Manager, Data Entry ve Auditor rolleri mevcuttur.',
      tip: '"Ayarlar" → "Takım" bölümünden yönetin.',
    },
    {
      icon: Settings,
      title: 'Ayarlar',
      description: 'Profil, şifre, bildirimler, şirket ve tesis ayarları, veri dışa aktarma — hepsi tek yerden.',
      tip: '"Ayarlar" sekmesinden tüm ayarlara erişin.',
    },
  ],
  en: [
    {
      icon: Sparkles,
      title: 'Welcome to Carbonless',
      description: 'Welcome to your ISO 14064-1 compliant carbon inventory platform. Let\'s take a quick tour to get you started.',
      tip: 'Let\'s begin!',
    },
    {
      icon: BarChart3,
      title: 'Dashboard',
      description: 'This is your home page. View total emissions, Scope breakdown, monthly trends, and facility data at a glance.',
      tip: 'Click "Dashboard" in the left sidebar.',
    },
    {
      icon: Leaf,
      title: 'Emission Management',
      description: 'Enter your emission data here. Select scope, category, source, and quantity. The system auto-calculates CO₂e.',
      tip: 'Go to "Emissions" tab and click "New Entry".',
    },
    {
      icon: Target,
      title: 'Reduction Targets',
      description: 'Set carbon reduction targets. Enter base year, target year, and reduction percentage to track progress.',
      tip: 'Go to "Targets" tab to add a target.',
    },
    {
      icon: FileText,
      title: 'Reporting',
      description: 'Generate professional ISO 14064-1 PDF reports. Turkish/English reports, CSV and Excel export available.',
      tip: 'Go to "Reporting" tab to download PDF.',
    },
    {
      icon: Bot,
      title: 'AI Carbon Assistant',
      description: 'Complete the carbon inventory questionnaire step by step with CarbonIQ. AI-powered workflows configure your reporting setup.',
      tip: 'Click "AI Carbon" tab.',
    },
    {
      icon: Users,
      title: 'Team Management',
      description: 'Invite team members and manage roles. Available: Owner, Admin, Manager, Data Entry, and Auditor.',
      tip: 'Go to "Settings" → "Team".',
    },
    {
      icon: Settings,
      title: 'Settings',
      description: 'Profile, password, notifications, company & facility settings, data export — all in one place.',
      tip: 'Go to "Settings" tab for all options.',
    },
  ],
};

export default function OnboardingTour({ language, onComplete }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('carbonless_tour_seen');
      if (!seen) setShow(true);
    } catch {}
  }, []);

  const steps = STEPS[language] || STEPS.en;
  const tr = language === 'tr';

  const handleClose = useCallback(() => {
    setShow(false);
    try { localStorage.setItem('carbonless_tour_seen', 'true'); } catch {}
    if (onComplete) onComplete();
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else handleClose();
  }, [step, steps.length, handleClose]);

  const handlePrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // Escape closes the tour — consistent with all other overlays in the app
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, handleClose]);

  if (!show) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-white/95 shadow-[0_20px_60px_rgba(48,40,23,0.18)] backdrop-blur-2xl">
        {/* Progress bar */}
        <div className="h-1 bg-[#302817]/6">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#95A847] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <span className="rounded-full bg-[#95A847]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#75863B]">
              {step + 1} / {steps.length}
            </span>
            <button onClick={handleClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/35 transition hover:bg-[#302817]/5 hover:text-[#302817]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Icon */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#95A847]/15 to-[#B4BE6A]/10 text-[#95A847] ring-1 ring-[#95A847]/20">
            <Icon className="h-6 w-6" />
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold tracking-[-0.02em] text-[#302817]">{current.title}</h2>

          {/* Description */}
          <p className="mt-2 text-sm leading-6 text-[#302817]/60">{current.description}</p>

          {/* Tip */}
          <div className="mt-4 rounded-xl border border-[#95A847]/20 bg-[#95A847]/6 px-4 py-3">
            <p className="text-xs font-semibold text-[#75863B]">💡 {current.tip}</p>
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-xs font-semibold text-[#302817]/40 transition hover:text-[#302817]"
            >
              {tr ? 'Turu Atla' : 'Skip Tour'}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="flex items-center gap-1 rounded-full border border-[#302817]/10 px-4 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {tr ? 'Geri' : 'Back'}
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition-colors hover:bg-black"
              >
                {isLast ? (tr ? 'Başla!' : 'Get Started!') : (tr ? 'İleri' : 'Next')}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
