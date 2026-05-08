'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Factory, FileCheck2, Globe2, Leaf,
  Loader2, LockKeyhole, Mail, ShieldCheck, User,
} from 'lucide-react';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';
import { ALL_NACE_CODES } from '@/lib/data/naceCodes';
import CountryPicker from '@/components/CountryPicker';

export default function RegisterPage() {
  const { language, changeLanguage, t } = useLanguage();
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState(1);
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', password2: '',
    legalEntityName: '', taxNumber: '', countryOfHeadquarters: '',
    countriesOfOperation: '', naceCode: '', mainActivityDescription: '',
    numberOfEmployees: '', annualTurnoverRange: '', numberOfFacilities: '',
    hasOverseasOperations: '', numberOfSubsidiaries: '',
    hasISO14001: '', hasISO50001: '', hasISO14064Work: '',
    targetISO14064Verification: '', has3rdPartyAuditPlan: '',
    isForFinancing: '', isDueToExportPressure: '', isForGroupReporting: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [naceSearch, setNaceSearch] = useState('');
  const [naceOpen, setNaceOpen] = useState(false);

  const handleInputChange = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); setError(''); };

  const validateSection1 = () => {
    const missing = [];
    if (!formData.username.trim()) missing.push(language === 'tr' ? 'Kullanıcı Adı' : 'Username');
    if (!formData.email.trim()) missing.push(language === 'tr' ? 'E-posta' : 'Email');
    if (!formData.password) missing.push(language === 'tr' ? 'Şifre' : 'Password');
    if (!formData.password2) missing.push(language === 'tr' ? 'Şifre Tekrar' : 'Confirm Password');
    if (!formData.legalEntityName.trim()) missing.push(language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name');
    if (formData.taxNumber && formData.taxNumber.length !== 10) { setError(language === 'tr' ? 'Vergi numarası 10 haneli olmalıdır' : 'Tax number must be 10 digits'); return false; }
    if (!formData.countryOfHeadquarters.trim()) missing.push(language === 'tr' ? 'Merkez Ülkesi' : 'Country of Headquarters');
    if (!formData.countriesOfOperation.trim()) missing.push(language === 'tr' ? 'Faaliyet Gösterilen Ülkeler' : 'Countries of Operation');
    if (!formData.naceCode.trim()) missing.push(language === 'tr' ? 'NACE Kodu' : 'NACE Code');
    if (!formData.mainActivityDescription.trim()) missing.push(language === 'tr' ? 'Ana Faaliyet Açıklaması' : 'Main Activity Description');
    if (formData.password && formData.password2 && formData.password !== formData.password2) { setError(language === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match'); return false; }
    if (formData.password && !isPasswordStrong(formData.password)) { setError(language === 'tr' ? 'Şifre yeterince güçlü değil' : 'Password is not strong enough'); return false; }
    if (missing.length > 0) { setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  };

  const validateSection2 = () => {
    const missing = [];
    if (!formData.numberOfEmployees) missing.push(language === 'tr' ? 'Çalışan Sayısı' : 'Number of Employees');
    if (!formData.annualTurnoverRange) missing.push(language === 'tr' ? 'Yıllık Ciro' : 'Annual Turnover');
    if (!formData.numberOfFacilities && formData.numberOfFacilities !== '0') missing.push(language === 'tr' ? 'Tesis Sayısı' : 'Facilities');
    if (!formData.hasOverseasOperations) missing.push(language === 'tr' ? 'Yurtdışı Operasyonları' : 'Overseas Operations');
    if (!formData.numberOfSubsidiaries && formData.numberOfSubsidiaries !== '0') missing.push(language === 'tr' ? 'Bağlı Şirket' : 'Subsidiaries');
    if (!formData.hasISO14001) missing.push('ISO 14001');
    if (!formData.hasISO50001) missing.push('ISO 50001');
    if (!formData.hasISO14064Work) missing.push('ISO 14064');
    if (missing.length > 0) { setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  };

  const validateSection3 = () => {
    const missing = [];
    if (!formData.targetISO14064Verification) missing.push('ISO 14064-1');
    if (!formData.has3rdPartyAuditPlan) missing.push(language === 'tr' ? '3. taraf denetim' : '3rd party audit');
    if (formData.isForFinancing !== 'yes' && formData.isDueToExportPressure !== 'yes' && formData.isForGroupReporting !== 'yes') missing.push(language === 'tr' ? 'Amaç' : 'Purpose');
    if (missing.length > 0) { setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  };

  const goToSection = (target) => { setError(''); if (target > currentSection) { if (currentSection === 1 && !validateSection1()) return; if (currentSection === 2 && !validateSection2()) return; } setCurrentSection(target); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!validateSection3()) return;
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const regRes = await fetch(`${API}/accounts/register/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: formData.username, email: formData.email, password: formData.password, password2: formData.password2, first_name: formData.legalEntityName }) });
      if (!regRes.ok) { const d = await regRes.json(); setError(Object.values(d).flat().join(', ')); setLoading(false); return; }
      const loginRes = await fetch(`${API}/accounts/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username: formData.username, password: formData.password }) });
      if (loginRes.ok) {
        const { markSessionActive } = await import('@/lib/utils/api');
        markSessionActive();
        await fetch(`${API}/companies/create/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ legal_entity_name: formData.legalEntityName, tax_number: formData.taxNumber, country_of_headquarters: formData.countryOfHeadquarters, countries_of_operation: formData.countriesOfOperation, nace_code: formData.naceCode, main_activity_description: formData.mainActivityDescription, number_of_employees: formData.numberOfEmployees, annual_turnover_range: formData.annualTurnoverRange, number_of_facilities: parseInt(formData.numberOfFacilities) || 0, has_overseas_operations: formData.hasOverseasOperations === 'yes', number_of_subsidiaries: parseInt(formData.numberOfSubsidiaries) || 0, has_iso_14001: formData.hasISO14001 === 'yes', has_iso_50001: formData.hasISO50001 === 'yes', has_iso_14064_work: formData.hasISO14064Work === 'yes', target_iso_14064_verification: formData.targetISO14064Verification === 'yes', has_3rd_party_audit_plan: formData.has3rdPartyAuditPlan === 'yes', is_for_financing: formData.isForFinancing === 'yes', is_due_to_export_pressure: formData.isDueToExportPressure === 'yes', is_for_group_reporting: formData.isForGroupReporting === 'yes' }) });
        router.push('/dashboard');
      }
    } catch { setError(language === 'tr' ? 'Sunucu bağlantı hatası' : 'Server connection error'); }
    finally { setLoading(false); }
  };

  const steps = [
    { id: 1, icon: Building2, title: language === 'tr' ? 'Kurumsal Bilgiler' : 'Corporate Info', subtitle: language === 'tr' ? 'Hesap ve şirket profili' : 'Account and company profile' },
    { id: 2, icon: Factory, title: language === 'tr' ? 'Ölçek' : 'Scale', subtitle: language === 'tr' ? 'Operasyon ve sertifikalar' : 'Operations and certificates' },
    { id: 3, icon: ClipboardCheck, title: language === 'tr' ? 'Amaç' : 'Purpose', subtitle: language === 'tr' ? 'Denetim ve raporlama' : 'Audit and reporting' },
  ];
  const progress = Math.round(((currentSection - 1) / 2) * 100);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9EFE5] text-[#302817]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(248,248,248,0.92),transparent_34%),radial-gradient(circle_at_30%_32%,rgba(127,135,144,0.14),transparent_30%),radial-gradient(circle_at_75%_22%,rgba(143,146,161,0.15),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-white/75 via-[#F9EFE5]/50 to-[#F9EFE5]" />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <img src="/carbonless.png" alt="Carbonless" className="h-11 w-11 sm:h-14 sm:w-14" />
          <span className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#302817]">Carbonless</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden text-sm font-bold text-[#302817]/70 transition hover:text-[#302817] sm:inline-flex">{language === 'tr' ? 'Giriş' : 'Login'}</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-8 pt-2 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-4 lg:h-fit">
            <div className="rounded-[2rem] border border-[#302817]/10 bg-white/55 p-4 shadow-xl shadow-[#302817]/8 backdrop-blur-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B4BE6A]">Carbonless onboarding</p>
                  <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#302817]">{t.register.title}</h1>
                  <p className="mt-2 text-sm leading-6 text-[#302817]/60">{t.register.subtitle}</p>
                </div>
              </div>
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#302817]/55"><span>{language === 'tr' ? 'İlerleme' : 'Progress'}</span><span>{progress}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#302817]/10"><div className="h-full rounded-full bg-gradient-to-r from-[#B4BE6A] to-[#95A847] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {steps.map(step => { const Icon = step.icon; const active = currentSection === step.id; const done = currentSection > step.id; return (
                  <button key={step.id} type="button" onClick={() => goToSection(step.id)} className={`group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? 'border-[#B4BE6A]/45 bg-[#B4BE6A]/14 shadow-lg shadow-[#302817]/5' : done ? 'border-[#95A847]/35 bg-white/65 hover:border-[#B4BE6A]/45' : 'border-[#302817]/10 bg-white/35 hover:bg-white/60'}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${active ? 'bg-[#B4BE6A] text-white' : done ? 'bg-[#95A847] text-white' : 'bg-[#F8F8F8] text-[#302817]/55 ring-1 ring-[#302817]/10'}`}>{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</span>
                    <span className="min-w-0"><span className="block truncate text-sm font-bold text-[#302817]">{step.title}</span><span className="block truncate text-xs font-medium text-[#302817]/55">{step.subtitle}</span></span>
                  </button>); })}
              </div>
              <div className="mt-5 rounded-3xl border border-[#302817]/10 bg-[#302817] p-4 text-[#F9EFE5] shadow-xl shadow-[#302817]/15">
                <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-[#B4BE6A]" />{language === 'tr' ? 'Güvenli kayıt' : 'Secure registration'}</div>
                <p className="mt-2 text-xs leading-5 text-[#F9EFE5]/70">{language === 'tr' ? 'Şirket profiliniz güvenli şekilde kaydedilir.' : 'Your company profile is stored securely.'}</p>
              </div>
            </div>
          </aside>

          {/* Form */}
          <form onSubmit={handleSubmit} className="min-w-0 rounded-[2rem] border border-[#302817]/10 bg-white/55 p-4 shadow-xl shadow-[#302817]/8 backdrop-blur-2xl sm:p-5 lg:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[#302817]/10 pb-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B4BE6A]">{language === 'tr' ? `Adım ${currentSection} / 3` : `Step ${currentSection} / 3`}</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#302817]">{steps[currentSection - 1].title}</h2>
                <p className="mt-1 text-sm text-[#302817]/60">{steps[currentSection - 1].subtitle}</p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#302817]/10 bg-white/55 px-4 py-2 text-xs font-bold text-[#302817] shadow-sm backdrop-blur-xl"><BadgeCheck className="h-4 w-4 text-[#B4BE6A]" />{language === 'tr' ? 'Zorunlu *' : 'Required *'}</div>
            </div>
            {error && <ErrorBox message={error} />}

            {currentSection === 1 && (
              <div className="space-y-4">
                <Panel title={language === 'tr' ? 'Hesap Bilgileri' : 'Account Information'} icon={User}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField label={language === 'tr' ? 'Kullanıcı Adı' : 'Username'} required value={formData.username} onChange={e => handleInputChange('username', e.target.value)} icon={User} placeholder={language === 'tr' ? 'örn: alper_yilmaz' : 'e.g. john_doe'} />
                    <TextField label={language === 'tr' ? 'E-posta' : 'Email'} type="email" required value={formData.email} onChange={e => handleInputChange('email', e.target.value)} icon={Mail} placeholder={language === 'tr' ? 'ornek@sirket.com' : 'name@company.com'} />
                    <div><TextField label={language === 'tr' ? 'Şifre' : 'Password'} type="password" required value={formData.password} onChange={e => handleInputChange('password', e.target.value)} icon={LockKeyhole} placeholder={language === 'tr' ? 'En az 8 karakter' : 'Min 8 characters'} /><PasswordStrengthIndicator password={formData.password} language={language} /></div>
                    <TextField label={language === 'tr' ? 'Şifre Tekrar' : 'Confirm Password'} type="password" required value={formData.password2} onChange={e => handleInputChange('password2', e.target.value)} icon={LockKeyhole} placeholder={language === 'tr' ? 'Şifreyi tekrar girin' : 'Re-enter password'} />
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Temel Kurumsal Bilgiler' : 'Corporate Information'} icon={Building2}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextField label={language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name'} required value={formData.legalEntityName} onChange={e => handleInputChange('legalEntityName', e.target.value)} icon={Building2} placeholder={language === 'tr' ? 'örn: ABC Teknoloji A.Ş.' : 'e.g. ABC Technology Inc.'} />
                    <div><Label>{language === 'tr' ? 'Vergi Numarası' : 'Tax Number'}</Label><input type="text" inputMode="numeric" maxLength={10} value={formData.taxNumber} onChange={e => handleInputChange('taxNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} className="field-premium" placeholder={language === 'tr' ? 'Opsiyonel — 10 haneli' : 'Optional — 10 digits'} /></div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div><Label required>{language === 'tr' ? 'Merkez Ülkesi' : 'Country of HQ'}</Label><CountryPicker value={formData.countryOfHeadquarters} onChange={val => handleInputChange('countryOfHeadquarters', val)} language={language} placeholder={language === 'tr' ? 'Ülke ara...' : 'Search...'} /></div>
                    <div><Label required>{language === 'tr' ? 'Faaliyet Ülkeleri' : 'Countries of Operation'}</Label><CountryPicker value={formData.countriesOfOperation} onChange={val => handleInputChange('countriesOfOperation', val)} language={language} multi placeholder={language === 'tr' ? 'Ülke ekle...' : 'Add countries...'} /></div>
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Sektör' : 'Sector'} icon={Globe2}>
                  <div><Label required>{language === 'tr' ? 'NACE Kodu' : 'NACE Code'}</Label><div className="relative"><input type="text" value={naceSearch} onChange={e => { setNaceSearch(e.target.value); setNaceOpen(true); }} onFocus={() => setNaceOpen(true)} placeholder={language === 'tr' ? 'Kod veya sektör adı...' : 'Code or sector name...'} className="field-premium" />{formData.naceCode && <div className="mt-2 flex items-center justify-between rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/12 px-4 py-3 text-sm"><span><b>{formData.naceCode}</b> — {ALL_NACE_CODES.find(n => n.code === formData.naceCode)?.[language === 'tr' ? 'tr' : 'en'] || ''}</span><button type="button" onClick={() => { handleInputChange('naceCode', ''); setNaceSearch(''); }} className="text-xs text-red-500">✕</button></div>}{naceOpen && naceSearch.length > 0 && <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[#302817]/10 bg-white p-2 shadow-2xl">{ALL_NACE_CODES.filter(n => { const q = naceSearch.toLowerCase(); return n.code.toLowerCase().includes(q) || n.tr.toLowerCase().includes(q) || n.en.toLowerCase().includes(q); }).slice(0, 12).map(n => <button key={n.code} type="button" onClick={() => { handleInputChange('naceCode', n.code); setNaceSearch(''); setNaceOpen(false); }} className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-[#B4BE6A]/10"><b className="text-[#95A847]">{n.code}</b> <span className="text-[#302817]/70">{language === 'tr' ? n.tr : n.en}</span></button>)}</div>}</div></div>
                  <div className="mt-4"><Label required>{language === 'tr' ? 'Ana Faaliyet' : 'Main Activity'}</Label><textarea required value={formData.mainActivityDescription} onChange={e => handleInputChange('mainActivityDescription', e.target.value)} maxLength={500} rows={3} className="field-premium resize-none" placeholder={language === 'tr' ? 'Kısa açıklama...' : 'Short description...'} /></div>
                </Panel>
                <FormActions><PrimaryButton type="button" onClick={() => goToSection(2)}>{language === 'tr' ? 'Devam' : 'Continue'}<ArrowRight className="h-4 w-4" /></PrimaryButton></FormActions>
              </div>
            )}

            {currentSection === 2 && (
              <div className="space-y-4">
                <Panel title={language === 'tr' ? 'Ölçek' : 'Scale'} icon={Factory}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SelectField label={language === 'tr' ? 'Çalışan Sayısı' : 'Employees'} required value={formData.numberOfEmployees} onChange={e => handleInputChange('numberOfEmployees', e.target.value)}><option value="">—</option><option value="1-10">1-10</option><option value="11-50">11-50</option><option value="51-250">51-250</option><option value="251-1000">251-1000</option><option value="1000+">1000+</option></SelectField>
                    <SelectField label={language === 'tr' ? 'Yıllık Ciro' : 'Annual Turnover'} required value={formData.annualTurnoverRange} onChange={e => handleInputChange('annualTurnoverRange', e.target.value)}><option value="">—</option><option value="<500K">&lt;500K ₺</option><option value="500K-2M">500K–2M ₺</option><option value="2M-10M">2M–10M ₺</option><option value="10M-50M">10M–50M ₺</option><option value="50M-250M">50M–250M ₺</option><option value="250M-1B">250M–1B ₺</option><option value="1B+">1B+ ₺</option></SelectField>
                    <TextField label={language === 'tr' ? 'Tesis Sayısı' : 'Facilities'} type="number" min="0" required value={formData.numberOfFacilities} onChange={e => handleInputChange('numberOfFacilities', e.target.value)} icon={Factory} />
                    <TextField label={language === 'tr' ? 'Bağlı Şirket' : 'Subsidiaries'} type="number" min="0" required value={formData.numberOfSubsidiaries} onChange={e => handleInputChange('numberOfSubsidiaries', e.target.value)} icon={Building2} />
                  </div>
                  <RadioGroup label={language === 'tr' ? 'Yurtdışı Operasyonları?' : 'Overseas Operations?'} required name="hasOverseasOperations" value={formData.hasOverseasOperations} onChange={val => handleInputChange('hasOverseasOperations', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                </Panel>
                <Panel title={language === 'tr' ? 'ISO Sertifikaları' : 'ISO Certifications'} icon={FileCheck2}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <RadioCard label="ISO 14001" required name="hasISO14001" value={formData.hasISO14001} onChange={val => handleInputChange('hasISO14001', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label="ISO 50001" required name="hasISO50001" value={formData.hasISO50001} onChange={val => handleInputChange('hasISO50001', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label="ISO 14064" required name="hasISO14064Work" value={formData.hasISO14064Work} onChange={val => handleInputChange('hasISO14064Work', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                  </div>
                </Panel>
                <FormActions><SecondaryButton type="button" onClick={() => goToSection(1)}><ArrowLeft className="h-4 w-4" />{language === 'tr' ? 'Geri' : 'Back'}</SecondaryButton><PrimaryButton type="button" onClick={() => goToSection(3)}>{language === 'tr' ? 'Devam' : 'Continue'}<ArrowRight className="h-4 w-4" /></PrimaryButton></FormActions>
              </div>
            )}

            {currentSection === 3 && (
              <div className="space-y-4">
                <Panel title={language === 'tr' ? 'Denetim' : 'Audit'} icon={ClipboardCheck}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <RadioCard label={language === 'tr' ? 'ISO 14064-1 doğrulaması?' : 'ISO 14064-1 verification?'} required name="targetISO14064Verification" value={formData.targetISO14064Verification} onChange={val => handleInputChange('targetISO14064Verification', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label={language === 'tr' ? '3. taraf denetim planı?' : '3rd party audit plan?'} required name="has3rdPartyAuditPlan" value={formData.has3rdPartyAuditPlan} onChange={val => handleInputChange('has3rdPartyAuditPlan', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Amaç' : 'Purpose'} icon={BadgeCheck}>
                  <p className="mb-4 text-sm text-[#302817]/60">{language === 'tr' ? 'En az bir amaç seçin.' : 'Select at least one.'}</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <CheckCard checked={formData.isForFinancing === 'yes'} onChange={c => handleInputChange('isForFinancing', c ? 'yes' : 'no')} label={language === 'tr' ? 'Finansman' : 'Financing'} />
                    <CheckCard checked={formData.isDueToExportPressure === 'yes'} onChange={c => handleInputChange('isDueToExportPressure', c ? 'yes' : 'no')} label={language === 'tr' ? 'İhracat baskısı' : 'Export pressure'} />
                    <CheckCard checked={formData.isForGroupReporting === 'yes'} onChange={c => handleInputChange('isForGroupReporting', c ? 'yes' : 'no')} label={language === 'tr' ? 'Grup raporlaması' : 'Group reporting'} />
                  </div>
                </Panel>
                <FormActions><SecondaryButton type="button" onClick={() => goToSection(2)}><ArrowLeft className="h-4 w-4" />{language === 'tr' ? 'Geri' : 'Back'}</SecondaryButton><PrimaryButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{loading ? '...' : (language === 'tr' ? 'Gönder' : 'Submit')}</PrimaryButton></FormActions>
                <p className="mt-3 text-center text-[11px] text-[#302817]/40">
                  {language === 'tr' ? 'Kaydolarak ' : 'By registering you agree to our '}
                  <a href="/terms" target="_blank" className="font-bold text-[#95A847] hover:underline">{language === 'tr' ? 'Kullanım Şartları' : 'Terms of Use'}</a>
                  {language === 'tr' ? ' ve ' : ' and '}
                  <a href="/privacy" target="_blank" className="font-bold text-[#95A847] hover:underline">{language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</a>
                  {language === 'tr' ? '\'nı kabul etmiş olursunuz.' : '.'}
                </p>
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

/* Sub-components */
function Panel({ title, icon: Icon, children }) { return (<section className="rounded-[1.5rem] border border-[#302817]/10 bg-white/50 p-4 shadow-sm backdrop-blur-xl sm:p-5"><div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#B4BE6A]/14 text-[#95A847] ring-1 ring-[#B4BE6A]/25"><Icon className="h-5 w-5" /></div><h3 className="text-base font-bold text-[#302817] sm:text-lg">{title}</h3></div>{children}</section>); }
function Label({ children, required }) { return <label className="mb-2 block text-sm font-bold text-[#302817]/75">{children} {required && <span className="text-[#B4BE6A]">*</span>}</label>; }
function TextField({ label, required, icon: Icon, ...props }) { return (<div><Label required={required}>{label}</Label><div className="group flex items-center gap-3 rounded-2xl border border-[#302817]/10 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-xl transition focus-within:border-[#B4BE6A]/60 focus-within:ring-4 focus-within:ring-[#B4BE6A]/20">{Icon && <Icon className="h-5 w-5 shrink-0 text-[#95A847]" />}<input {...props} className="w-full bg-transparent text-sm font-semibold text-[#302817] outline-none placeholder:text-[#302817]/35" /></div></div>); }
function SelectField({ label, required, children, ...props }) { return (<div><Label required={required}>{label}</Label><div className="relative"><select {...props} className="field-premium appearance-none pr-10">{children}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#302817]/40" /></div></div>); }
function RadioGroup({ label, required, name, value, onChange, yes, no }) { return (<div className="mt-4"><Label required={required}>{label}</Label><div className="grid gap-3 sm:grid-cols-2"><RadioOption name={name} option="yes" value={value} onChange={onChange} label={yes} /><RadioOption name={name} option="no" value={value} onChange={onChange} label={no} /></div></div>); }
function RadioCard({ label, required, name, value, onChange, yes, no }) { return (<div className="rounded-2xl border border-[#302817]/10 bg-white/45 p-4 shadow-sm backdrop-blur-xl"><Label required={required}>{label}</Label><div className="mt-3 grid gap-3"><RadioOption name={name} option="yes" value={value} onChange={onChange} label={yes} /><RadioOption name={name} option="no" value={value} onChange={onChange} label={no} /></div></div>); }
function RadioOption({ name, option, value, onChange, label }) { const active = value === option; return (<label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${active ? 'border-[#B4BE6A]/55 bg-[#B4BE6A]/14 text-[#302817] ring-4 ring-[#B4BE6A]/15' : 'border-[#302817]/10 bg-white/55 text-[#302817]/70 hover:border-[#B4BE6A]/45'}`}><input type="radio" name={name} value={option} checked={active} onChange={e => onChange(e.target.value)} className="h-4 w-4 accent-[#B4BE6A]" />{label}</label>); }
function CheckCard({ checked, onChange, label }) { return (<label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm font-bold transition ${checked ? 'border-[#B4BE6A]/55 bg-[#B4BE6A]/14 text-[#302817] ring-4 ring-[#B4BE6A]/15' : 'border-[#302817]/10 bg-white/55 text-[#302817]/70 hover:border-[#B4BE6A]/45'}`}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#B4BE6A]" /><span>{label}</span></label>); }
function ErrorBox({ message }) { return <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-semibold text-red-600">{message}</div>; }
function FormActions({ children }) { return <div className="flex flex-col-reverse justify-between gap-3 border-t border-[#302817]/10 pt-5 sm:flex-row sm:items-center">{children}</div>; }
function PrimaryButton({ children, ...props }) { return <button {...props} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] px-6 py-3 text-sm font-bold text-[#F9EFE5] shadow-xl shadow-[#302817]/18 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60 sm:w-auto">{children}</button>; }
function SecondaryButton({ children, ...props }) { return <button {...props} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#302817]/10 bg-white/55 px-6 py-3 text-sm font-bold text-[#302817] shadow-lg shadow-[#302817]/5 backdrop-blur-xl transition hover:bg-white/80 sm:w-auto">{children}</button>; }
