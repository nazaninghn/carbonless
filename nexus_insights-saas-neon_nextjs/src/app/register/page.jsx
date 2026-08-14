'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Factory, FileCheck2, Globe2,
  Loader2, LockKeyhole, Mail, ShieldCheck, User,
} from 'lucide-react';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';
import { ALL_NACE_CODES } from '@/lib/data/naceCodes';
import CountryPicker from '@/components/CountryPicker';
import { api as apiModule, markSessionActive as activate } from '@/lib/utils/api';

export default function RegisterPage() {
  const { language, t } = useLanguage();
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
  const naceRef = useRef(null);
  const tr = language === 'tr';

  // Close NACE dropdown when clicking outside its container
  useEffect(() => {
    if (!naceOpen) return;
    const onMouse = (e) => {
      if (naceRef.current && !naceRef.current.contains(e.target)) {
        setNaceOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [naceOpen]);

  // Stable across renders  -  setFormData and setError are guaranteed stable by React
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }, []);

  const validateSection1 = () => {
    const missing = [];
    if (!formData.username.trim()) missing.push(tr ? 'Kullanıcı Adı' : 'Username');
    if (!formData.email.trim()) missing.push(tr ? 'E-posta' : 'Email');
    if (!formData.password) missing.push(tr ? 'Şifre' : 'Password');
    if (!formData.password2) missing.push(tr ? 'Şifre Tekrar' : 'Confirm Password');
    if (!formData.legalEntityName.trim()) missing.push(tr ? 'Yasal Kuruluş Adı' : 'Legal Entity Name');
    if (formData.taxNumber && formData.taxNumber.length !== 10) { setError(tr ? 'Vergi numarası 10 haneli olmalıdır' : 'Tax number must be 10 digits'); return false; }
    if (!formData.countryOfHeadquarters.trim()) missing.push(tr ? 'Merkez Ülkesi' : 'Country of Headquarters');
    if (!formData.countriesOfOperation.trim()) missing.push(tr ? 'Faaliyet Gösterilen Ülkeler' : 'Countries of Operation');
    if (!formData.naceCode.trim()) missing.push(tr ? 'NACE Kodu' : 'NACE Code');
    if (!formData.mainActivityDescription.trim()) missing.push(tr ? 'Ana Faaliyet Açıklaması' : 'Main Activity Description');
    if (formData.password && formData.password2 && formData.password !== formData.password2) { setError(tr ? 'Şifreler eşleşmiyor' : 'Passwords do not match'); return false; }
    if (formData.password && !isPasswordStrong(formData.password)) { setError(tr ? 'Şifre yeterince güçlü değil' : 'Password is not strong enough'); return false; }
    if (missing.length > 0) { setError((tr ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  };

  const validateSection2 = () => {
    const missing = [];
    if (!formData.numberOfEmployees) missing.push(tr ? 'Çalışan Sayısı' : 'Number of Employees');
    if (!formData.annualTurnoverRange) missing.push(tr ? 'Yıllık Ciro' : 'Annual Turnover');
    if (!formData.numberOfFacilities && formData.numberOfFacilities !== '0') missing.push(tr ? 'Tesis Sayısı' : 'Facilities');
    if (!formData.hasOverseasOperations) missing.push(tr ? 'Yurtdışı Operasyonları' : 'Overseas Operations');
    if (!formData.numberOfSubsidiaries && formData.numberOfSubsidiaries !== '0') missing.push(tr ? 'Bağlı Şirket' : 'Subsidiaries');
    if (!formData.hasISO14001) missing.push('ISO 14001');
    if (!formData.hasISO50001) missing.push('ISO 50001');
    if (!formData.hasISO14064Work) missing.push('ISO 14064');
    if (missing.length > 0) { setError((tr ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  };

  const validateSection3 = useCallback(() => {
    const missing = [];
    if (!formData.targetISO14064Verification) missing.push('ISO 14064-1');
    if (!formData.has3rdPartyAuditPlan) missing.push(tr ? '3. taraf denetim' : '3rd party audit');
    if (formData.isForFinancing !== 'yes' && formData.isDueToExportPressure !== 'yes' && formData.isForGroupReporting !== 'yes') missing.push(tr ? 'Amaç' : 'Purpose');
    if (missing.length > 0) { setError((tr ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', ')); return false; }
    return true;
  }, [formData, tr]);

  // Fix 24D: prevent section navigation while the form is submitting
  const goToSection = (target) => { if (loading) return; setError(''); if (target > currentSection) { if (currentSection === 1 && !validateSection1()) return; if (currentSection === 2 && !validateSection2()) return; } setCurrentSection(target); };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); setError('');
    if (!validateSection3()) return;
    setLoading(true);

    // Step 1 registration hits the backend directly (no auth token needed yet).
    // api.js does not export API_BASE, so we read the same env var here.
    // This is intentional  -  subsequent authenticated calls use api.* helpers.
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

    try {
      // â”€â”€ Step 1: Create account â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let regRes;
      try {
        const regCtrl = new AbortController();
        const regTimer = setTimeout(() => regCtrl.abort(), 30_000);
        regRes = await fetch(`${API_BASE_URL}/accounts/register/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password,
            password2: formData.password2,
            first_name: formData.legalEntityName,
          }),
          signal: regCtrl.signal,
        }).finally(() => clearTimeout(regTimer));
      } catch {
        setError(language === 'tr'
          ? 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.'
          : 'Cannot reach the server. Check your internet connection.');
        return;
      }

      if (!regRes.ok) {
        const d = await regRes.json().catch(() => ({}));
        setError(Object.values(d).flat().join(', ') || (language === 'tr' ? 'Kayıt hatası' : 'Registration error'));
        return; // outer finally calls setLoading(false)
      }

      // The backend reports whether the verification mail actually left the
      // server. If it didn't (SMTP down/unconfigured), sending the user to the
      // "enter your code" screen would strand them waiting for a mail that
      // isn't coming â€” so flag it and let that screen say so.
      const regData = await regRes.json().catch(() => ({}));
      const mailFailedParam = regData?.email_sent === false ? '&mail=failed' : '';

      // â”€â”€ Step 2: Login via proxy (sets localStorage token + session cookie) â”€â”€
      // Must use /api/auth/login (not direct backend) so api.js stores the
      // access token in localStorage and markSessionActive() takes effect.
      // Import once here and reuse for Step 3  -  two separate imports of the same
      // dynamic module were previously used, which risked the second call missing
      // the auth token on a cold SSR edge case.
      let loginRes;
      try {
        loginRes = await apiModule.login(formData.username, formData.password);
        if (loginRes.ok) activate();
      } catch {
        // Login failed  -  likely email verification required
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}${mailFailedParam}`);
        return;
      }

      if (!loginRes.ok) {
        // User created but inactive (needs email verification)
        // Redirect to verify-email page instead of showing error
        router.push(`/verify-email?email=${encodeURIComponent(formData.email)}${mailFailedParam}`);
        return;
      }

      // â”€â”€ Step 3: Create company (token is now set  -  api.createCompany works) â”€

      const companyPayload = {
        legal_entity_name: formData.legalEntityName,
        tax_number: formData.taxNumber,
        country_of_headquarters: formData.countryOfHeadquarters,
        countries_of_operation: formData.countriesOfOperation,
        nace_code: formData.naceCode,
        main_activity_description: formData.mainActivityDescription,
        number_of_employees: formData.numberOfEmployees,
        annual_turnover_range: formData.annualTurnoverRange,
        number_of_facilities: parseInt(formData.numberOfFacilities) || 0,
        has_overseas_operations: formData.hasOverseasOperations === 'yes',
        number_of_subsidiaries: parseInt(formData.numberOfSubsidiaries) || 0,
        has_iso_14001: formData.hasISO14001 === 'yes',
        has_iso_50001: formData.hasISO50001 === 'yes',
        has_iso_14064_work: formData.hasISO14064Work === 'yes',
        target_iso_14064_verification: formData.targetISO14064Verification === 'yes',
        has_3rd_party_audit_plan: formData.has3rdPartyAuditPlan === 'yes',
        is_for_financing: formData.isForFinancing === 'yes',
        is_due_to_export_pressure: formData.isDueToExportPressure === 'yes',
        is_for_group_reporting: formData.isForGroupReporting === 'yes',
      };

      try {
        const companyRes = await apiModule.createCompany(companyPayload); // reuse same import
        if (!companyRes.ok) {
          // Save so Settings â†’ Company can auto-fill  -  no re-typing needed
          try { sessionStorage.setItem('pendingCompany', JSON.stringify(companyPayload)); } catch {}
        } else {
          try { sessionStorage.removeItem('pendingCompany'); } catch {}
        }
      } catch {
        // Company creation failed  -  save data for Settings â†’ Company auto-fill
        try { sessionStorage.setItem('pendingCompany', JSON.stringify(companyPayload)); } catch {}
      }

      // Set mode cookie so middleware allows dashboard access
      document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
      router.push('/dashboard');

    } catch (err) {
      setError(tr
        ? `Beklenmeyen hata: ${err?.message || 'Bilinmeyen'}`
        : `Unexpected error: ${err?.message || 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  }, [formData, language, tr, router, validateSection3]);

  const steps = [
    { id: 1, icon: Building2, title: language === 'tr' ? 'Kurumsal Bilgiler' : 'Corporate Info', subtitle: language === 'tr' ? 'Hesap ve şirket profili' : 'Account and company profile' },
    { id: 2, icon: Factory, title: language === 'tr' ? 'Ölçek' : 'Scale', subtitle: language === 'tr' ? 'Operasyon ve sertifikalar' : 'Operations and certificates' },
    { id: 3, icon: ClipboardCheck, title: language === 'tr' ? 'Amaç' : 'Purpose', subtitle: language === 'tr' ? 'Denetim ve raporlama' : 'Audit and reporting' },
  ];
  const progress = Math.round(((currentSection - 1) / 2) * 100);

  return (
    <main className="relative min-h-screen bg-[#F9FFF4] text-[#072C0E]">

      <header className="relative z-20 mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/carbonless.png" alt="Carbonless" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#072C0E]">Carbonless</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden text-[12px] font-bold text-[#072C0E]/70 transition hover:text-[#072C0E] sm:inline-flex">{language === 'tr' ? 'Giriş' : 'Login'}</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 pt-1 sm:px-6 lg:px-8">
        <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-4 lg:h-fit">
            <div className="rounded-2xl border border-[#072C0E]/10 bg-white/55 p-3 shadow-lg shadow-[#072C0E]/6 backdrop-blur-2xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#51D766]">Carbonless onboarding</p>
                  <h1 className="mt-1.5 text-[16px] font-bold tracking-[-0.03em] text-[#072C0E]">{t.register.title}</h1>
                  <p className="mt-1 text-[11px] leading-5 text-[#072C0E]/60">{t.register.subtitle}</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[#072C0E]/55"><span>{language === 'tr' ? 'İlerleme' : 'Progress'}</span><span>{progress}%</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#072C0E]/10"><div className="h-full rounded-full bg-gradient-to-r from-[#51D766] to-[#2ABD41] transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                {steps.map(step => { const Icon = step.icon; const active = currentSection === step.id; const done = currentSection > step.id; return (
                  <button key={step.id} type="button" onClick={() => goToSection(step.id)} className={`group flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${active ? 'border-[#51D766]/45 bg-[#51D766]/14 shadow-md shadow-[#072C0E]/5' : done ? 'border-[#2ABD41]/35 bg-white/65 hover:border-[#51D766]/45' : 'border-[#072C0E]/10 bg-white/35 hover:bg-white/60'}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${active ? 'bg-[#51D766] text-white' : done ? 'bg-[#2ABD41] text-white' : 'bg-[#F8F8F8] text-[#072C0E]/55 ring-1 ring-[#072C0E]/10'}`}>{done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>
                    <span className="min-w-0"><span className="block truncate text-[12px] font-bold text-[#072C0E]">{step.title}</span><span className="block truncate text-[10px] font-medium text-[#072C0E]/55">{step.subtitle}</span></span>
                  </button>); })}
              </div>
              <div className="mt-3 rounded-2xl border border-[#072C0E]/10 bg-[#072C0E] p-3 text-[#F5F5F5] shadow-lg shadow-[#072C0E]/10">
                <div className="flex items-center gap-2 text-[11px] font-bold"><ShieldCheck className="h-3.5 w-3.5 text-[#51D766]" />{language === 'tr' ? 'Güvenli kayıt' : 'Secure registration'}</div>
                <p className="mt-1.5 text-[10px] leading-4 text-[#F5F5F5]/70">{language === 'tr' ? 'Şirket profiliniz güvenli şekilde kaydedilir.' : 'Your company profile is stored securely.'}</p>
              </div>
            </div>
          </aside>

          {/* Form */}
          <form onSubmit={handleSubmit} className="min-w-0 rounded-2xl border border-[#072C0E]/10 bg-white/55 p-3 shadow-lg shadow-[#072C0E]/6 backdrop-blur-2xl sm:p-4 lg:p-5">
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-[#072C0E]/10 pb-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#51D766]">{language === 'tr' ? `Adım ${currentSection} / 3` : `Step ${currentSection} / 3`}</p>
                <h2 className="mt-1.5 text-[16px] font-bold tracking-[-0.03em] text-[#072C0E]">{steps[currentSection - 1].title}</h2>
                <p className="mt-0.5 text-[11px] text-[#072C0E]/60">{steps[currentSection - 1].subtitle}</p>
              </div>
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#072C0E]/10 bg-white/55 px-3 py-1.5 text-[10px] font-bold text-[#072C0E] shadow-sm backdrop-blur-xl"><BadgeCheck className="h-3.5 w-3.5 text-[#51D766]" />{language === 'tr' ? 'Zorunlu *' : 'Required *'}</div>
            </div>
            {error && <ErrorBox message={error} />}

            {currentSection === 1 && (
              <div className="space-y-3">
                <Panel title={language === 'tr' ? 'Hesap Bilgileri' : 'Account Information'} icon={User}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label={language === 'tr' ? 'Kullanıcı Adı' : 'Username'} required value={formData.username} onChange={e => handleInputChange('username', e.target.value)} icon={User} placeholder={language === 'tr' ? 'örn: alper_yilmaz' : 'e.g. john_doe'} autoComplete="username" />
                    <TextField label={language === 'tr' ? 'E-posta' : 'Email'} type="email" required value={formData.email} onChange={e => handleInputChange('email', e.target.value)} icon={Mail} placeholder={language === 'tr' ? 'ornek@sirket.com' : 'name@company.com'} autoComplete="email" />
                    <div><TextField label={language === 'tr' ? 'Şifre' : 'Password'} type="password" required value={formData.password} onChange={e => handleInputChange('password', e.target.value)} icon={LockKeyhole} placeholder={language === 'tr' ? 'En az 8 karakter' : 'Min 8 characters'} autoComplete="new-password" /><PasswordStrengthIndicator password={formData.password} language={language} /></div>
                    <TextField label={language === 'tr' ? 'Şifre Tekrar' : 'Confirm Password'} type="password" required value={formData.password2} onChange={e => handleInputChange('password2', e.target.value)} icon={LockKeyhole} placeholder={language === 'tr' ? 'Şifreyi tekrar girin' : 'Re-enter password'} autoComplete="new-password" />
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Temel Kurumsal Bilgiler' : 'Corporate Information'} icon={Building2}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextField label={language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name'} required value={formData.legalEntityName} onChange={e => handleInputChange('legalEntityName', e.target.value)} icon={Building2} placeholder={language === 'tr' ? 'örn: ABC Teknoloji A.Ş.' : 'e.g. ABC Technology Inc.'} />
                    <div><Label>{language === 'tr' ? 'Vergi Numarası' : 'Tax Number'}</Label><input type="text" inputMode="numeric" maxLength={10} value={formData.taxNumber} onChange={e => handleInputChange('taxNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} className="field-premium" placeholder={language === 'tr' ? 'Opsiyonel  -  10 haneli' : 'Optional  -  10 digits'} /></div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div><Label required>{language === 'tr' ? 'Merkez Ülkesi' : 'Country of HQ'}</Label><CountryPicker value={formData.countryOfHeadquarters} onChange={val => handleInputChange('countryOfHeadquarters', val)} language={language} placeholder={language === 'tr' ? 'Ülke ara...' : 'Search...'} /></div>
                    <div><Label required>{language === 'tr' ? 'Faaliyet Ülkeleri' : 'Countries of Operation'}</Label><CountryPicker value={formData.countriesOfOperation} onChange={val => handleInputChange('countriesOfOperation', val)} language={language} multi placeholder={language === 'tr' ? 'Ülke ekle...' : 'Add countries...'} /></div>
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Sektör' : 'Sector'} icon={Globe2}>
                  <div><Label required>{language === 'tr' ? 'NACE Kodu' : 'NACE Code'}</Label><div ref={naceRef} className="relative"><input type="text" value={naceSearch} onChange={e => { setNaceSearch(e.target.value); setNaceOpen(true); }} onFocus={() => setNaceOpen(true)} placeholder={language === 'tr' ? 'Kod veya sektör adı...' : 'Code or sector name...'} className="field-premium" />{formData.naceCode && <div className="mt-2 flex items-center justify-between rounded-2xl border border-[#51D766]/30 bg-[#51D766]/12 px-4 py-3 text-sm"><span><b>{formData.naceCode}</b>  -  {ALL_NACE_CODES.find(n => n.code === formData.naceCode)?.[language === 'tr' ? 'tr' : 'en'] || ''}</span><button type="button" onClick={() => { handleInputChange('naceCode', ''); setNaceSearch(''); }} className="text-xs text-red-500">✕</button></div>}{naceOpen && naceSearch.length > 0 && <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[#072C0E]/10 bg-white p-2 shadow-2xl">{ALL_NACE_CODES.filter(n => { const q = naceSearch.toLowerCase(); return n.code.toLowerCase().includes(q) || n.tr.toLowerCase().includes(q) || n.en.toLowerCase().includes(q); }).slice(0, 12).map(n => <button key={n.code} type="button" onClick={() => { handleInputChange('naceCode', n.code); setNaceSearch(''); setNaceOpen(false); }} className="w-full rounded-xl px-4 py-3 text-left text-sm hover:bg-[#51D766]/10"><b className="text-[#2ABD41]">{n.code}</b> <span className="text-[#072C0E]/70">{language === 'tr' ? n.tr : n.en}</span></button>)}</div>}</div></div>
                  <div className="mt-3"><Label required>{language === 'tr' ? 'Ana Faaliyet' : 'Main Activity'}</Label><textarea required value={formData.mainActivityDescription} onChange={e => handleInputChange('mainActivityDescription', e.target.value)} maxLength={500} rows={3} className="field-premium resize-none" placeholder={language === 'tr' ? 'Kısa açıklama...' : 'Short description...'} /></div>
                </Panel>
                <FormActions><PrimaryButton type="button" onClick={() => goToSection(2)}>{language === 'tr' ? 'Devam' : 'Continue'}<ArrowRight className="h-4 w-4" /></PrimaryButton></FormActions>
              </div>
            )}

            {currentSection === 2 && (
              <div className="space-y-3">
                <Panel title={language === 'tr' ? 'Ölçek' : 'Scale'} icon={Factory}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectField label={language === 'tr' ? 'Çalışan Sayısı' : 'Employees'} required value={formData.numberOfEmployees} onChange={e => handleInputChange('numberOfEmployees', e.target.value)}><option value=""> - </option><option value="1-10">1-10</option><option value="11-50">11-50</option><option value="51-250">51-250</option><option value="251-1000">251-1000</option><option value="1000+">1000+</option></SelectField>
                    <SelectField label={language === 'tr' ? 'Yıllık Ciro' : 'Annual Turnover'} required value={formData.annualTurnoverRange} onChange={e => handleInputChange('annualTurnoverRange', e.target.value)}><option value=""> - </option><option value="<500K">&lt;500K â‚º</option><option value="500K-2M">500K - 2M â‚º</option><option value="2M-10M">2M - 10M â‚º</option><option value="10M-50M">10M - 50M â‚º</option><option value="50M-250M">50M - 250M â‚º</option><option value="250M-1B">250M - 1B â‚º</option><option value="1B+">1B+ â‚º</option></SelectField>
                    <TextField label={language === 'tr' ? 'Tesis Sayısı' : 'Facilities'} type="number" min="0" required value={formData.numberOfFacilities} onChange={e => handleInputChange('numberOfFacilities', e.target.value)} icon={Factory} />
                    <TextField label={language === 'tr' ? 'Bağlı Şirket' : 'Subsidiaries'} type="number" min="0" required value={formData.numberOfSubsidiaries} onChange={e => handleInputChange('numberOfSubsidiaries', e.target.value)} icon={Building2} />
                  </div>
                  <RadioGroup label={language === 'tr' ? 'Yurtdışı Operasyonları?' : 'Overseas Operations?'} required name="hasOverseasOperations" value={formData.hasOverseasOperations} onChange={val => handleInputChange('hasOverseasOperations', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                </Panel>
                <Panel title={language === 'tr' ? 'ISO Sertifikaları' : 'ISO Certifications'} icon={FileCheck2}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <RadioCard label="ISO 14001" required name="hasISO14001" value={formData.hasISO14001} onChange={val => handleInputChange('hasISO14001', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label="ISO 50001" required name="hasISO50001" value={formData.hasISO50001} onChange={val => handleInputChange('hasISO50001', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label="ISO 14064" required name="hasISO14064Work" value={formData.hasISO14064Work} onChange={val => handleInputChange('hasISO14064Work', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                  </div>
                </Panel>
                <FormActions><SecondaryButton type="button" onClick={() => goToSection(1)}><ArrowLeft className="h-4 w-4" />{language === 'tr' ? 'Geri' : 'Back'}</SecondaryButton><PrimaryButton type="button" onClick={() => goToSection(3)}>{language === 'tr' ? 'Devam' : 'Continue'}<ArrowRight className="h-4 w-4" /></PrimaryButton></FormActions>
              </div>
            )}

            {currentSection === 3 && (
              <div className="space-y-3">
                <Panel title={language === 'tr' ? 'Denetim' : 'Audit'} icon={ClipboardCheck}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <RadioCard label={language === 'tr' ? 'ISO 14064-1 doğrulaması?' : 'ISO 14064-1 verification?'} required name="targetISO14064Verification" value={formData.targetISO14064Verification} onChange={val => handleInputChange('targetISO14064Verification', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                    <RadioCard label={language === 'tr' ? '3. taraf denetim planı?' : '3rd party audit plan?'} required name="has3rdPartyAuditPlan" value={formData.has3rdPartyAuditPlan} onChange={val => handleInputChange('has3rdPartyAuditPlan', val)} yes={language === 'tr' ? 'Evet' : 'Yes'} no={language === 'tr' ? 'Hayır' : 'No'} />
                  </div>
                </Panel>
                <Panel title={language === 'tr' ? 'Amaç' : 'Purpose'} icon={BadgeCheck}>
                  <p className="mb-3 text-[12px] text-[#072C0E]/60">{language === 'tr' ? 'En az bir amaç seçin.' : 'Select at least one.'}</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <CheckCard checked={formData.isForFinancing === 'yes'} onChange={c => handleInputChange('isForFinancing', c ? 'yes' : 'no')} label={language === 'tr' ? 'Finansman' : 'Financing'} />
                    <CheckCard checked={formData.isDueToExportPressure === 'yes'} onChange={c => handleInputChange('isDueToExportPressure', c ? 'yes' : 'no')} label={language === 'tr' ? 'İhracat baskısı' : 'Export pressure'} />
                    <CheckCard checked={formData.isForGroupReporting === 'yes'} onChange={c => handleInputChange('isForGroupReporting', c ? 'yes' : 'no')} label={language === 'tr' ? 'Grup raporlaması' : 'Group reporting'} />
                  </div>
                </Panel>
                <FormActions><SecondaryButton type="button" onClick={() => goToSection(2)}><ArrowLeft className="h-4 w-4" />{language === 'tr' ? 'Geri' : 'Back'}</SecondaryButton><PrimaryButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{loading ? '...' : (language === 'tr' ? 'Gönder' : 'Submit')}</PrimaryButton></FormActions>
                <p className="mt-3 text-center text-[11px] text-[#072C0E]/40">
                  {language === 'tr' ? 'Kaydolarak ' : 'By registering you agree to our '}
                  <a href="/terms" target="_blank" className="font-bold text-[#2ABD41] hover:underline">{language === 'tr' ? 'Kullanım Şartları' : 'Terms of Use'}</a>
                  {language === 'tr' ? ' ve ' : ' and '}
                  <a href="/privacy" target="_blank" className="font-bold text-[#2ABD41] hover:underline">{language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</a>
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
function Panel({ title, icon: Icon, children }) { return (<section className="rounded-xl border border-[#072C0E]/10 bg-white/50 p-3 shadow-sm backdrop-blur-xl sm:p-4"><div className="mb-3 flex items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#51D766]/14 text-[#2ABD41] ring-1 ring-[#51D766]/25"><Icon className="h-4 w-4" /></div><h3 className="text-[13px] font-bold text-[#072C0E] sm:text-[14px]">{title}</h3></div>{children}</section>); }
function Label({ children, required }) { return <label className="mb-1.5 block text-[12px] font-bold text-[#072C0E]/75">{children} {required && <span className="text-[#51D766]">*</span>}</label>; }
function TextField({ label, required, icon: Icon, ...props }) { return (<div><Label required={required}>{label}</Label><div className="group flex items-center gap-2.5 rounded-xl border border-[#072C0E]/10 bg-white/55 px-3 py-2.5 shadow-sm backdrop-blur-xl transition focus-within:border-[#51D766]/60 focus-within:ring-3 focus-within:ring-[#51D766]/15">{Icon && <Icon className="h-4 w-4 shrink-0 text-[#2ABD41]" />}<input {...props} className="w-full bg-transparent text-[12px] font-semibold text-[#072C0E] outline-none placeholder:text-[#072C0E]/35" /></div></div>); }
function SelectField({ label, required, children, ...props }) { return (<div><Label required={required}>{label}</Label><div className="relative"><select {...props} className="field-premium appearance-none pr-10 text-[12px]">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#072C0E]/40" /></div></div>); }
function RadioGroup({ label, required, name, value, onChange, yes, no }) { return (<div className="mt-3"><Label required={required}>{label}</Label><div className="grid gap-2 sm:grid-cols-2"><RadioOption name={name} option="yes" value={value} onChange={onChange} label={yes} /><RadioOption name={name} option="no" value={value} onChange={onChange} label={no} /></div></div>); }
function RadioCard({ label, required, name, value, onChange, yes, no }) { return (<div className="rounded-xl border border-[#072C0E]/10 bg-white/45 p-3 shadow-sm backdrop-blur-xl"><Label required={required}>{label}</Label><div className="mt-2 grid gap-2"><RadioOption name={name} option="yes" value={value} onChange={onChange} label={yes} /><RadioOption name={name} option="no" value={value} onChange={onChange} label={no} /></div></div>); }
function RadioOption({ name, option, value, onChange, label }) { const active = value === option; return (<label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] font-bold transition ${active ? 'border-[#51D766]/55 bg-[#51D766]/14 text-[#072C0E] ring-3 ring-[#51D766]/12' : 'border-[#072C0E]/10 bg-white/55 text-[#072C0E]/70 hover:border-[#51D766]/45'}`}><input type="radio" name={name} value={option} checked={active} onChange={e => onChange(e.target.value)} className="h-3.5 w-3.5 accent-[#51D766]" />{label}</label>); }
function CheckCard({ checked, onChange, label }) { return (<label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12px] font-bold transition ${checked ? 'border-[#51D766]/55 bg-[#51D766]/14 text-[#072C0E] ring-3 ring-[#51D766]/12' : 'border-[#072C0E]/10 bg-white/55 text-[#072C0E]/70 hover:border-[#51D766]/45'}`}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#51D766]" /><span>{label}</span></label>); }
function ErrorBox({ message }) { return <div className="mb-4 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2.5 text-[12px] font-semibold text-red-600">{message}</div>; }
function FormActions({ children }) { return <div className="flex flex-col-reverse justify-between gap-2.5 border-t border-[#072C0E]/10 pt-4 sm:flex-row sm:items-center">{children}</div>; }
function PrimaryButton({ children, ...props }) { return <button {...props} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#072C0E] px-5 py-2.5 text-[12px] font-bold text-[#F5F5F5] shadow-lg shadow-[#072C0E]/15 transition hover:-translate-y-0.5 hover:bg-[#1D9C31] disabled:opacity-60 sm:w-auto">{children}</button>; }
function SecondaryButton({ children, ...props }) { return <button {...props} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#072C0E]/10 bg-white/55 px-5 py-2.5 text-[12px] font-bold text-[#072C0E] shadow-md shadow-[#072C0E]/5 backdrop-blur-xl transition hover:bg-white/80 sm:w-auto">{children}</button>; }
