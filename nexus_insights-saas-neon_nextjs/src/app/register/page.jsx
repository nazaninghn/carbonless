'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SimpleHeader from '@/components/SimpleHeader';
import { CheckCircle } from 'lucide-react';
import PasswordStrengthIndicator, { isPasswordStrong } from '@/components/PasswordStrengthIndicator';
import { ALL_NACE_CODES } from '@/lib/data/naceCodes';
import CountryPicker from '@/components/CountryPicker';

export default function RegisterPage() {
  const { language, changeLanguage, t } = useLanguage();
  const [currentSection, setCurrentSection] = useState(1);
  const [formData, setFormData] = useState({
    // Account
    username: '',
    email: '',
    password: '',
    password2: '',
    
    // Section 1
    legalEntityName: '',
    taxNumber: '',
    countryOfHeadquarters: '',
    countriesOfOperation: '',
    naceCode: '',
    mainActivityDescription: '',
    
    // Section 2
    numberOfEmployees: '',
    annualTurnoverRange: '',
    numberOfFacilities: '',
    hasOverseasOperations: '',
    numberOfSubsidiaries: '',
    hasISO14001: '',
    hasISO50001: '',
    hasISO14064Work: '',
    
    // Section 3
    targetISO14064Verification: '',
    has3rdPartyAuditPlan: '',
    isForFinancing: '',
    isDueToExportPressure: '',
    isForGroupReporting: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [naceSearch, setNaceSearch] = useState('');
  const [naceOpen, setNaceOpen] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Per-section validation
  const validateSection1 = () => {
    const missing = [];
    if (!formData.username.trim()) missing.push(language === 'tr' ? 'Kullanıcı Adı' : 'Username');
    if (!formData.email.trim()) missing.push(language === 'tr' ? 'E-posta' : 'Email');
    if (!formData.password) missing.push(language === 'tr' ? 'Şifre' : 'Password');
    if (!formData.password2) missing.push(language === 'tr' ? 'Şifre Tekrar' : 'Confirm Password');
    if (!formData.legalEntityName.trim()) missing.push(language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name');
    // taxNumber is NOT required
    if (!formData.countryOfHeadquarters.trim()) missing.push(language === 'tr' ? 'Merkez Ülkesi' : 'Country of Headquarters');
    if (!formData.countriesOfOperation.trim()) missing.push(language === 'tr' ? 'Faaliyet Gösterilen Ülkeler' : 'Countries of Operation');
    if (!formData.naceCode.trim()) missing.push(language === 'tr' ? 'NACE Kodu' : 'NACE Code');
    if (!formData.mainActivityDescription.trim()) missing.push(language === 'tr' ? 'Ana Faaliyet Açıklaması' : 'Main Activity Description');
    if (formData.password && formData.password2 && formData.password !== formData.password2) {
      setError(language === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match');
      return false;
    }
    if (formData.password && !isPasswordStrong(formData.password)) {
      setError(language === 'tr' ? 'Şifre yeterince güçlü değil' : 'Password is not strong enough');
      return false;
    }
    if (missing.length > 0) {
      setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', '));
      return false;
    }
    return true;
  };

  const validateSection2 = () => {
    const missing = [];
    if (!formData.numberOfEmployees) missing.push(language === 'tr' ? 'Çalışan Sayısı' : 'Number of Employees');
    if (!formData.annualTurnoverRange) missing.push(language === 'tr' ? 'Yıllık Ciro Aralığı' : 'Annual Turnover Range');
    if (!formData.numberOfFacilities && formData.numberOfFacilities !== '0' && formData.numberOfFacilities !== 0) missing.push(language === 'tr' ? 'Tesis Sayısı' : 'Number of Facilities');
    if (!formData.hasOverseasOperations) missing.push(language === 'tr' ? 'Yurtdışı Operasyonları' : 'Overseas Operations');
    if (!formData.numberOfSubsidiaries && formData.numberOfSubsidiaries !== '0' && formData.numberOfSubsidiaries !== 0) missing.push(language === 'tr' ? 'Bağlı Şirket Sayısı' : 'Number of Subsidiaries');
    if (!formData.hasISO14001) missing.push('ISO 14001');
    if (!formData.hasISO50001) missing.push('ISO 50001');
    if (!formData.hasISO14064Work) missing.push('ISO 14064');
    if (missing.length > 0) {
      setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', '));
      return false;
    }
    return true;
  };

  const validateSection3 = () => {
    const missing = [];
    if (!formData.targetISO14064Verification) missing.push(language === 'tr' ? 'ISO 14064-1 doğrulaması' : 'ISO 14064-1 verification');
    if (!formData.has3rdPartyAuditPlan) missing.push(language === 'tr' ? '3. taraf denetim planı' : '3rd party audit plan');
    if (formData.isForFinancing !== 'yes' && formData.isDueToExportPressure !== 'yes' && formData.isForGroupReporting !== 'yes') {
      missing.push(language === 'tr' ? 'Amaç (en az birini seçin)' : 'Purpose (select at least one)');
    }
    if (missing.length > 0) {
      setError((language === 'tr' ? 'Lütfen şu alanları doldurun: ' : 'Please fill in: ') + missing.join(', '));
      return false;
    }
    return true;
  };

  const goToSection = (target) => {
    setError('');
    if (target > currentSection) {
      if (currentSection === 1 && !validateSection1()) return;
      if (currentSection === 2 && !validateSection2()) return;
    }
    setCurrentSection(target);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateSection3()) return;
    if (formData.password !== formData.password2) {
      setError(language === 'tr' ? 'Şifreler eşleşmiyor' : 'Passwords do not match');
      return;
    }
    if (!isPasswordStrong(formData.password)) {
      setError(language === 'tr' ? 'Şifre yeterince güçlü değil. Lütfen büyük harf, küçük harf, rakam ve özel karakter kullanın.' : 'Password is not strong enough. Please use uppercase, lowercase, numbers and special characters.');
      return;
    }
    setLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      // 1. Register user
      const regRes = await fetch(`${API}/accounts/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          password2: formData.password2,
          first_name: formData.legalEntityName,
        }),
      });
      if (!regRes.ok) {
        const data = await regRes.json();
        const msg = Object.values(data).flat().join(', ');
        setError(msg);
        setLoading(false);
        return;
      }
      // 2. Login (sets HttpOnly cookies)
      const loginRes = await fetch(`${API}/accounts/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: formData.username, password: formData.password }),
      });
      if (loginRes.ok) {
        // Store token for dev header-based auth
        try {
          const loginData = await loginRes.json();
          if (loginData.access) {
            const { setAccessToken } = await import('@/lib/utils/api');
            setAccessToken(loginData.access);
          }
        } catch {}
        // 3. Create company (using cookie + header auth)
        const { getAccessToken } = await import('@/lib/utils/api');
        const companyHeaders = { 'Content-Type': 'application/json' };
        const devToken = typeof getAccessToken === 'function' ? null : null;
        // Use stored token for dev
        try {
          const storedToken = localStorage.getItem('_dev_access_token');
          if (storedToken) companyHeaders['Authorization'] = `Bearer ${storedToken}`;
        } catch {}
        await fetch(`${API}/companies/create/`, {
          method: 'POST',
          headers: companyHeaders,
          credentials: 'include',
          body: JSON.stringify({
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
          }),
        });
        window.location.href = '/dashboard';
      }
    } catch {
      setError(language === 'tr' ? 'Sunucu bağlantı hatası' : 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white text-gray-900 antialiased min-h-screen">
      <SimpleHeader />

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold mb-4">
              {t.register.title}
            </h1>
            <p className="text-lg text-gray-600">
              {t.register.subtitle}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8 sm:mb-12">
            <div className="flex items-center gap-2 sm:gap-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentSection === step 
                      ? 'bg-primary text-white' 
                      : currentSection > step 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentSection > step ? <CheckCircle className="w-5 h-5" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-8 sm:w-16 h-1 ${currentSection > step ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-green-50 rounded-2xl shadow-lg border border-green-200 p-4 sm:p-8">
            {/* Section 1: Basic Corporate Information */}
            {currentSection === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {language === 'tr' ? 'Bölüm 1 – Temel Kurumsal Bilgiler' : 'Section 1 – Basic Corporate Information'}
                </h2>

                {/* Account Fields */}
                <div className="bg-white/70 border border-green-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-green-800 mb-3">{language === 'tr' ? 'Hesap Bilgileri' : 'Account Information'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'tr' ? 'Kullanıcı Adı' : 'Username'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <input type="text" required value={formData.username} onChange={(e) => handleInputChange('username', e.target.value)} className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'tr' ? 'E-posta' : 'Email'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <input type="email" required value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'tr' ? 'Şifre' : 'Password'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <input type="password" required value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                      <PasswordStrengthIndicator password={formData.password} language={language} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'tr' ? 'Şifre Tekrar' : 'Confirm Password'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <input type="password" required value={formData.password2} onChange={(e) => handleInputChange('password2', e.target.value)} className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" />
                    </div>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.legalEntityName}
                    onChange={(e) => handleInputChange('legalEntityName', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Vergi Numarası' : 'Tax Number'}
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber}
                    onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={language === 'tr' ? 'Opsiyonel' : 'Optional'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Merkez Ülkesi' : 'Country of Headquarters'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <CountryPicker
                    value={formData.countryOfHeadquarters}
                    onChange={(val) => handleInputChange('countryOfHeadquarters', val)}
                    language={language}
                    placeholder={language === 'tr' ? 'Ülke ara...' : 'Search country...'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Faaliyet Gösterilen Ülkeler' : 'Countries of Operation'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <CountryPicker
                    value={formData.countriesOfOperation}
                    onChange={(val) => handleInputChange('countriesOfOperation', val)}
                    language={language}
                    multi={true}
                    placeholder={language === 'tr' ? 'Ülke ara ve ekle...' : 'Search and add countries...'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.register.naceCode} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={naceSearch}
                      onChange={(e) => { setNaceSearch(e.target.value); setNaceOpen(true); }}
                      onFocus={() => setNaceOpen(true)}
                      placeholder={language === 'tr' ? 'Kod veya sektör adı yazın...' : 'Type code or sector name...'}
                      className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    {formData.naceCode && (
                      <div className="mt-1 px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 flex items-center justify-between">
                        <span><b>{formData.naceCode}</b> — {ALL_NACE_CODES.find(n => n.code === formData.naceCode)?.[language === 'tr' ? 'tr' : 'en'] || ''}</span>
                        <button type="button" onClick={() => { handleInputChange('naceCode', ''); setNaceSearch(''); }} className="text-green-600 hover:text-red-500 ml-2 text-xs">✕</button>
                      </div>
                    )}
                    {naceOpen && naceSearch.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-green-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {ALL_NACE_CODES.filter(n => {
                          const q = naceSearch.toLowerCase();
                          return n.code.toLowerCase().includes(q) || n.tr.toLowerCase().includes(q) || n.en.toLowerCase().includes(q);
                        }).slice(0, 15).map(n => (
                          <button
                            key={n.code}
                            type="button"
                            onClick={() => { handleInputChange('naceCode', n.code); setNaceSearch(''); setNaceOpen(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b border-gray-100 last:border-0"
                          >
                            <span className="font-semibold text-primary">{n.code}</span>
                            <span className="text-gray-600 ml-2">{language === 'tr' ? n.tr : n.en}</span>
                          </button>
                        ))}
                        {ALL_NACE_CODES.filter(n => {
                          const q = naceSearch.toLowerCase();
                          return n.code.toLowerCase().includes(q) || n.tr.toLowerCase().includes(q) || n.en.toLowerCase().includes(q);
                        }).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500">{language === 'tr' ? 'Sonuç bulunamadı' : 'No results found'}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Ana Faaliyet Açıklaması' : 'Description of Main Activity'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.mainActivityDescription}
                    onChange={(e) => handleInputChange('mainActivityDescription', e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={language === 'tr' ? 'Kısa açıklama (max 500 karakter)' : 'Short description (max 500 characters)'}
                  />
                  <p className="text-sm text-gray-500 mt-1">{formData.mainActivityDescription.length}/500</p>
                </div>

                <div className="flex justify-end pt-6">
                  <button
                    type="button"
                    onClick={() => goToSection(2)}
                    className="px-8 py-3 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-105 transition-all duration-300"
                  >
                    {t.register.next}
                  </button>
                </div>
              </div>
            )}

            {/* Section 2: Scale & Complexity */}
            {currentSection === 2 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {language === 'tr' ? 'Bölüm 2 – Ölçek ve Karmaşıklık' : 'Section 2 – Scale & Complexity'}
                </h2>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Çalışan Sayısı' : 'Number of Employees'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <select
                    required
                    value={formData.numberOfEmployees}
                    onChange={(e) => handleInputChange('numberOfEmployees', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-250">51-250</option>
                    <option value="251-1000">251-1000</option>
                    <option value="1000+">1000+</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Yıllık Ciro Aralığı' : 'Annual Turnover Range'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <select
                    required
                    value={formData.annualTurnoverRange}
                    onChange={(e) => handleInputChange('annualTurnoverRange', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                    <option value="<500K">{language === 'tr' ? '< 500 Bin ₺' : '< 500K ₺'}</option>
                    <option value="500K-2M">{language === 'tr' ? '500 Bin – 2 Milyon ₺' : '500K – 2M ₺'}</option>
                    <option value="2M-10M">{language === 'tr' ? '2 – 10 Milyon ₺' : '2M – 10M ₺'}</option>
                    <option value="10M-50M">{language === 'tr' ? '10 – 50 Milyon ₺' : '10M – 50M ₺'}</option>
                    <option value="50M-250M">{language === 'tr' ? '50 – 250 Milyon ₺' : '50M – 250M ₺'}</option>
                    <option value="250M-1B">{language === 'tr' ? '250 Milyon – 1 Milyar ₺' : '250M – 1B ₺'}</option>
                    <option value="1B+">{language === 'tr' ? '1 Milyar ₺ üzeri' : '1B+ ₺'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Tesis Sayısı' : 'Number of Facilities'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.numberOfFacilities}
                    onChange={(e) => handleInputChange('numberOfFacilities', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Yurtdışı Operasyonları Var mı?' : 'Are there Overseas Operations?'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="hasOverseasOperations"
                        value="yes"
                        checked={formData.hasOverseasOperations === 'yes'}
                        onChange={(e) => handleInputChange('hasOverseasOperations', e.target.value)}
                        className="mr-2"
                      />
                      {t.register.yes}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="hasOverseasOperations"
                        value="no"
                        checked={formData.hasOverseasOperations === 'no'}
                        onChange={(e) => handleInputChange('hasOverseasOperations', e.target.value)}
                        className="mr-2"
                      />
                      {language === 'tr' ? 'Hayır' : 'No'}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Bağlı Şirket Sayısı' : 'Number of Subsidiaries'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.numberOfSubsidiaries}
                    onChange={(e) => handleInputChange('numberOfSubsidiaries', e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {language === 'tr' ? 'ISO Sertifikaları' : 'ISO Certifications'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ISO 14001 {language === 'tr' ? 'var mı?' : 'available?'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO14001"
                            value="yes"
                            checked={formData.hasISO14001 === 'yes'}
                            onChange={(e) => handleInputChange('hasISO14001', e.target.value)}
                            className="mr-2"
                          />
                          {t.register.yes}
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO14001"
                            value="no"
                            checked={formData.hasISO14001 === 'no'}
                            onChange={(e) => handleInputChange('hasISO14001', e.target.value)}
                            className="mr-2"
                          />
                          {language === 'tr' ? 'Hayır' : 'No'}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ISO 50001 {language === 'tr' ? 'var mı?' : 'available?'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO50001"
                            value="yes"
                            checked={formData.hasISO50001 === 'yes'}
                            onChange={(e) => handleInputChange('hasISO50001', e.target.value)}
                            className="mr-2"
                          />
                          {t.register.yes}
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO50001"
                            value="no"
                            checked={formData.hasISO50001 === 'no'}
                            onChange={(e) => handleInputChange('hasISO50001', e.target.value)}
                            className="mr-2"
                          />
                          {language === 'tr' ? 'Hayır' : 'No'}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'tr' ? 'ISO 14064 çalışması daha önce yapıldı mı?' : 'Has ISO 14064 work been done before?'} <span className="text-green-500 text-lg">*</span>
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO14064Work"
                            value="yes"
                            checked={formData.hasISO14064Work === 'yes'}
                            onChange={(e) => handleInputChange('hasISO14064Work', e.target.value)}
                            className="mr-2"
                          />
                          {t.register.yes}
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="hasISO14064Work"
                            value="no"
                            checked={formData.hasISO14064Work === 'no'}
                            onChange={(e) => handleInputChange('hasISO14064Work', e.target.value)}
                            className="mr-2"
                          />
                          {language === 'tr' ? 'Hayır' : 'No'}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={() => goToSection(1)}
                    className="px-8 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300"
                  >
                    {language === 'tr' ? 'Geri' : 'Back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => goToSection(3)}
                    className="px-8 py-3 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-105 transition-all duration-300"
                  >
                    {t.register.next}
                  </button>
                </div>
              </div>
            )}

            {/* Section 3: Audit & Purpose */}
            {currentSection === 3 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {language === 'tr' ? 'Bölüm 3 – Denetim ve Amaç' : 'Section 3 – Audit & Purpose'}
                </h2>

                {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">{error}</div>}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'ISO 14064-1 doğrulaması hedefleniyor mu?' : 'Is ISO 14064-1 verification targeted?'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="targetISO14064Verification"
                        value="yes"
                        checked={formData.targetISO14064Verification === 'yes'}
                        onChange={(e) => handleInputChange('targetISO14064Verification', e.target.value)}
                        className="mr-2"
                      />
                      {t.register.yes}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="targetISO14064Verification"
                        value="no"
                        checked={formData.targetISO14064Verification === 'no'}
                        onChange={(e) => handleInputChange('targetISO14064Verification', e.target.value)}
                        className="mr-2"
                      />
                      {language === 'tr' ? 'Hayır' : 'No'}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? '3. taraf denetim planı var mı?' : 'Is there a 3rd party audit plan?'} <span className="text-green-500 text-lg">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="has3rdPartyAuditPlan"
                        value="yes"
                        checked={formData.has3rdPartyAuditPlan === 'yes'}
                        onChange={(e) => handleInputChange('has3rdPartyAuditPlan', e.target.value)}
                        className="mr-2"
                      />
                      {t.register.yes}
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="has3rdPartyAuditPlan"
                        value="no"
                        checked={formData.has3rdPartyAuditPlan === 'no'}
                        onChange={(e) => handleInputChange('has3rdPartyAuditPlan', e.target.value)}
                        className="mr-2"
                      />
                      {language === 'tr' ? 'Hayır' : 'No'}
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {language === 'tr' ? 'Amaç' : 'Purpose'} <span className="text-green-500 text-lg">*</span>
                  </h3>

                  <div className="space-y-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isForFinancing === 'yes'}
                        onChange={(e) => handleInputChange('isForFinancing', e.target.checked ? 'yes' : 'no')}
                        className="mr-3 w-5 h-5 text-primary"
                      />
                      <span className="text-gray-700">
                        {language === 'tr' ? 'Finansman için mi?' : 'Is it for financing?'}
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isDueToExportPressure === 'yes'}
                        onChange={(e) => handleInputChange('isDueToExportPressure', e.target.checked ? 'yes' : 'no')}
                        className="mr-3 w-5 h-5 text-primary"
                      />
                      <span className="text-gray-700">
                        {language === 'tr' ? 'İhracat baskısı nedeniyle mi?' : 'Is it due to export pressure?'}
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isForGroupReporting === 'yes'}
                        onChange={(e) => handleInputChange('isForGroupReporting', e.target.checked ? 'yes' : 'no')}
                        className="mr-3 w-5 h-5 text-primary"
                      />
                      <span className="text-gray-700">
                        {language === 'tr' ? 'Grup raporlaması için mi?' : 'Is it for group reporting?'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={() => goToSection(2)}
                    className="px-8 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300"
                  >
                    {language === 'tr' ? 'Geri' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-105 transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {loading ? (language === 'tr' ? 'Kaydediliyor...' : 'Registering...') : (language === 'tr' ? 'Gönder' : 'Submit')}
                  </button>
                  {error && <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mt-2">{error}</div>}
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
