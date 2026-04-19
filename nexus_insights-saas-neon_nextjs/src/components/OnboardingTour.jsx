'use client';
import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Leaf, BarChart3, FileText, Users, Settings, MessageCircle, Target } from 'lucide-react';

const STEPS = {
  tr: [
    {
      icon: Leaf,
      title: 'Carbonless\'a Hoş Geldiniz! 🌿',
      description: 'ISO 14064-1 standardına uygun karbon envanteri platformunuza hoş geldiniz. Bu kısa tur ile platformu tanıyalım.',
      highlight: 'Başlayalım!',
    },
    {
      icon: BarChart3,
      title: '📊 Gösterge Paneli',
      description: 'Ana sayfanız burasıdır. Toplam emisyonlarınızı, Scope 1/2/3 dağılımını, aylık trendleri ve kategori bazlı verileri burada görebilirsiniz.',
      highlight: 'Sol menüden "Gösterge Paneli" sekmesine tıklayın.',
    },
    {
      icon: Leaf,
      title: '🏭 Emisyon Yönetimi',
      description: 'Emisyon verilerinizi buradan girersiniz. Scope seçin, kategori belirleyin, emisyon kaynağını seçin ve miktarı girin. Sistem otomatik olarak CO2e hesaplar.',
      highlight: '"Emisyonlar" sekmesinden "Yeni Kayıt" butonuna tıklayın.',
    },
    {
      icon: Target,
      title: '🎯 Azaltma Hedefleri',
      description: 'Karbon azaltma hedeflerinizi belirleyin. Baz yıl, hedef yıl ve azaltma yüzdesini girerek ilerlemenizi takip edin.',
      highlight: '"Hedefler" sekmesinden hedef ekleyin.',
    },
    {
      icon: FileText,
      title: '📄 Raporlama',
      description: 'ISO 14064-1 uyumlu profesyonel PDF raporları oluşturun. Türkçe ve İngilizce rapor, CSV ve Excel dışa aktarma seçenekleri mevcuttur.',
      highlight: '"Raporlama" sekmesinden PDF indirin.',
    },
    {
      icon: Users,
      title: '👥 Takım Yönetimi',
      description: 'Ekip üyelerinizi davet edin ve rollerini yönetin. Owner, Admin, Manager, Data Entry ve Auditor rolleri mevcuttur. Her rolün farklı yetkileri vardır.',
      highlight: '"Ayarlar" → "Takım Yönetimi" bölümünden yönetin.',
    },
    {
      icon: MessageCircle,
      title: '🤖 Chatbot Asistanı',
      description: 'Sağ alt köşedeki chatbot ile karbon envanteri anketini tamamlayın. Bu anket raporlama yapılandırmanızı belirler.',
      highlight: 'Sağ alttaki yeşil butona tıklayın.',
    },
    {
      icon: Settings,
      title: '⚙️ Ayarlar',
      description: 'Profil düzenleme, şifre değiştirme, bildirim tercihleri, şirket ve tesis ayarları, veri dışa aktarma ve hesap silme işlemlerini buradan yapabilirsiniz.',
      highlight: '"Ayarlar" sekmesinden tüm ayarlara erişin.',
    },
  ],
  en: [
    {
      icon: Leaf,
      title: 'Welcome to Carbonless! 🌿',
      description: 'Welcome to your ISO 14064-1 compliant carbon inventory platform. Let\'s take a quick tour to get you started.',
      highlight: 'Let\'s begin!',
    },
    {
      icon: BarChart3,
      title: '📊 Dashboard',
      description: 'This is your home page. View total emissions, Scope 1/2/3 breakdown, monthly trends, and category-level data at a glance.',
      highlight: 'Click "Dashboard" in the left sidebar.',
    },
    {
      icon: Leaf,
      title: '🏭 Emission Management',
      description: 'Enter your emission data here. Select a scope, choose a category and source, enter the quantity. The system auto-calculates CO2e.',
      highlight: 'Go to "Emissions" tab and click "New Entry".',
    },
    {
      icon: Target,
      title: '🎯 Reduction Targets',
      description: 'Set your carbon reduction targets. Enter base year, target year, and reduction percentage to track your progress.',
      highlight: 'Go to "Targets" tab to add a target.',
    },
    {
      icon: FileText,
      title: '📄 Reporting',
      description: 'Generate professional ISO 14064-1 PDF reports. Turkish and English reports, CSV and Excel export options are available.',
      highlight: 'Go to "Reporting" tab to download PDF.',
    },
    {
      icon: Users,
      title: '👥 Team Management',
      description: 'Invite team members and manage their roles. Available roles: Owner, Admin, Manager, Data Entry, and Auditor — each with different permissions.',
      highlight: 'Go to "Settings" → "Team Management".',
    },
    {
      icon: MessageCircle,
      title: '🤖 Chatbot Assistant',
      description: 'Complete the carbon inventory questionnaire using the chatbot in the bottom-right corner. This configures your reporting setup.',
      highlight: 'Click the green button in the bottom-right.',
    },
    {
      icon: Settings,
      title: '⚙️ Settings',
      description: 'Edit profile, change password, notification preferences, company & facility settings, data export, and account deletion — all in one place.',
      highlight: 'Go to "Settings" tab for all options.',
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

  const handleClose = () => {
    setShow(false);
    try { localStorage.setItem('carbonless_tour_seen', 'true'); } catch {}
    if (onComplete) onComplete();
  };

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleClose();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!show) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Step counter & close */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs text-gray-400 font-medium">
              {step + 1} / {steps.length}
            </span>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-2xl flex items-center justify-center mb-5">
            <Icon className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>

          {/* Description */}
          <p className="text-gray-600 leading-relaxed mb-4">{current.description}</p>

          {/* Highlight tip */}
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-sm text-green-800 font-medium">💡 {current.highlight}</p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {language === 'tr' ? 'Turu Atla' : 'Skip Tour'}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {language === 'tr' ? 'Geri' : 'Back'}
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-1 text-sm font-medium"
              >
                {isLast ? (language === 'tr' ? 'Başla!' : 'Get Started!') : (language === 'tr' ? 'İleri' : 'Next')}
                {!isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
