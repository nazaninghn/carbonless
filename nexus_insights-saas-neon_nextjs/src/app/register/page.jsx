'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SimpleHeader from '@/components/SimpleHeader';
import { Link } from '@/components/Link';
import { Text } from '@/components/Text';
import { Input } from '@/components/Input';
import { CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const { language, changeLanguage, t } = useLanguage();
  const [currentSection, setCurrentSection] = useState(1);
  const [formData, setFormData] = useState({
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

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Here you would send data to backend
  };

  return (
    <div className="bg-white text-gray-900 antialiased min-h-screen">
      <SimpleHeader />

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              {t.register.title}
            </h1>
            <p className="text-lg text-gray-600">
              {t.register.subtitle}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4">
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
                    <div className={`w-16 h-1 ${currentSection > step ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            {/* Section 1: Basic Corporate Information */}
            {currentSection === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {language === 'tr' ? 'Bölüm 1 – Temel Kurumsal Bilgiler' : 'Section 1 – Basic Corporate Information'}
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Yasal Kuruluş Adı' : 'Legal Entity Name'} *
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.legalEntityName}
                    onChange={(e) => handleInputChange('legalEntityName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Vergi Numarası' : 'Tax Number'} *
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.taxNumber}
                    onChange={(e) => handleInputChange('taxNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Merkez Ülkesi' : 'Country of Headquarters'} *
                  </label>
                  <Input
                    type="text"
                    required
                    value={formData.countryOfHeadquarters}
                    onChange={(e) => handleInputChange('countryOfHeadquarters', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Faaliyet Gösterilen Ülkeler' : 'Countries of Operation'}
                  </label>
                  <Input
                    type="text"
                    value={formData.countriesOfOperation}
                    onChange={(e) => handleInputChange('countriesOfOperation', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={language === 'tr' ? 'Örn: Türkiye, Almanya, Fransa' : 'e.g., Turkey, Germany, France'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.register.naceCode}
                  </label>
                  <Input
                    type="text"
                    value={formData.naceCode}
                    onChange={(e) => handleInputChange('naceCode', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Ana Faaliyet Açıklaması' : 'Description of Main Activity'} *
                  </label>
                  <textarea
                    required
                    value={formData.mainActivityDescription}
                    onChange={(e) => handleInputChange('mainActivityDescription', e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder={language === 'tr' ? 'Kısa açıklama (max 500 karakter)' : 'Short description (max 500 characters)'}
                  />
                  <p className="text-sm text-gray-500 mt-1">{formData.mainActivityDescription.length}/500</p>
                </div>

                <div className="flex justify-end pt-6">
                  <button
                    type="button"
                    onClick={() => setCurrentSection(2)}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Çalışan Sayısı' : 'Number of Employees'} *
                  </label>
                  <select
                    required
                    value={formData.numberOfEmployees}
                    onChange={(e) => handleInputChange('numberOfEmployees', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    {language === 'tr' ? 'Yıllık Ciro Aralığı' : 'Annual Turnover Range'} *
                  </label>
                  <select
                    required
                    value={formData.annualTurnoverRange}
                    onChange={(e) => handleInputChange('annualTurnoverRange', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                    <option value="<1M">&lt; 1M €</option>
                    <option value="1M-10M">1M - 10M €</option>
                    <option value="10M-50M">10M - 50M €</option>
                    <option value="50M-100M">50M - 100M €</option>
                    <option value="100M+">100M+ €</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Tesis Sayısı' : 'Number of Facilities'}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.numberOfFacilities}
                    onChange={(e) => handleInputChange('numberOfFacilities', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'Yurtdışı Operasyonları Var mı?' : 'Are there Overseas Operations?'}
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
                    {language === 'tr' ? 'Bağlı Şirket Sayısı' : 'Number of Subsidiaries'}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.numberOfSubsidiaries}
                    onChange={(e) => handleInputChange('numberOfSubsidiaries', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="border-t pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {language === 'tr' ? 'ISO Sertifikaları' : 'ISO Certifications'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ISO 14001 {language === 'tr' ? 'var mı?' : 'available?'}
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
                        ISO 50001 {language === 'tr' ? 'var mı?' : 'available?'}
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
                        {language === 'tr' ? 'ISO 14064 çalışması daha önce yapıldı mı?' : 'Has ISO 14064 work been done before?'}
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
                    onClick={() => setCurrentSection(1)}
                    className="px-8 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300"
                  >
                    {language === 'tr' ? 'Geri' : 'Back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSection(3)}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'tr' ? 'ISO 14064-1 doğrulaması hedefleniyor mu?' : 'Is ISO 14064-1 verification targeted?'}
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
                    {language === 'tr' ? '3. taraf denetim planı var mı?' : 'Is there a 3rd party audit plan?'}
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
                    {language === 'tr' ? 'Amaç' : 'Purpose'}
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
                    onClick={() => setCurrentSection(2)}
                    className="px-8 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300"
                  >
                    {language === 'tr' ? 'Geri' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:scale-105 transition-all duration-300"
                  >
                    {language === 'tr' ? 'Gönder' : 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
