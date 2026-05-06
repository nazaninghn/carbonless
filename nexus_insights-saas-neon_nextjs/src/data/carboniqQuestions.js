/**
 * CarbonIQ Question Schema — Phase 1 (21 questions)
 * Based on CarbonIQ Chatbot Soru Seti v3.0 — ISO 14064-1
 *
 * Schema per question:
 *   id, phase, block, field, type, required,
 *   tr (question text TR), en (question text EN),
 *   placeholder, help_tr, help_en,
 *   options (for choice/multi), pattern (for text validation),
 *   maxLength, min, max,
 *   next (default next step),
 *   conditions (dynamic branching),
 *   reportField, errors, assumption
 */

export const PHASES = [
  { id: 1, tr: 'Şirketi Tanıma', en: 'Company Identification', blocks: ['A','B','C','D'] },
  { id: 2, tr: 'Organizasyon Sınırı', en: 'Organizational Boundary', blocks: ['2A','2B','2C'] },
  { id: 3, tr: 'Kapsam 1', en: 'Scope 1', blocks: ['3A','3B','3C','3D'] },
  { id: 4, tr: 'Kapsam 2', en: 'Scope 2', blocks: ['4A','4B'] },
  { id: 5, tr: 'Kapsam 3', en: 'Scope 3', blocks: ['K3'] },
  { id: 6, tr: 'Kapatış', en: 'Closure', blocks: ['6A','6B','6C','6D','6E','6F'] },
  { id: 7, tr: 'Rapor Üretimi', en: 'Report Generation', blocks: ['7'] },
];

export const carboniqQuestions = [
  // ═══════════════════════════════════════════════════════
  // PHASE 1 — BLOCK A: İdari Bilgiler (8 questions)
  // ═══════════════════════════════════════════════════════
  {
    id: 'A1',
    phase: 1,
    block: 'A',
    field: 'company_name',
    type: 'text',
    required: true,
    maxLength: 200,
    tr: 'Şirketinizin tam ticari unvanı nedir?',
    en: 'What is the full legal name of your company?',
    placeholder: 'Örn: ABC Teknoloji Danışmanlık A.Ş.',
    help_tr: 'Ticaret sicilinde kayıtlı tam unvanınızı girin. Rapor kapağında bu isim kullanılacak.',
    help_en: 'Enter your full legal name as registered. This will appear on the report cover.',
    next: 'A2',
    reportField: 'tenant.company_name',
    errors: {
      required: { tr: 'Şirket adı zorunludur.', en: 'Company name is required.' },
      maxLength: { tr: 'Şirket adı en fazla 200 karakter olabilir.', en: 'Company name max 200 characters.' },
    },
  },
  {
    id: 'A2',
    phase: 1,
    block: 'A',
    field: 'vkn',
    type: 'text',
    required: true,
    pattern: '^\\d{10,11}$',
    tr: 'Vergi kimlik numaranız nedir?',
    en: 'What is your tax identification number?',
    placeholder: '0000000000',
    help_tr: '10 haneli VKN veya 11 haneli TCKN. Üçüncü taraflarla paylaşılmaz.',
    help_en: '10-digit VKN or 11-digit TCKN. Not shared with third parties.',
    next: 'A3',
    reportField: 'tenant.vkn',
    errors: {
      required: { tr: 'Vergi kimlik numarası zorunludur.', en: 'Tax ID is required.' },
      pattern: { tr: 'Lütfen 10 veya 11 haneli rakam girin.', en: 'Please enter 10 or 11 digits only.' },
    },
  },
  {
    id: 'A3',
    phase: 1,
    block: 'A',
    field: 'location',
    type: 'dual',
    fields: ['country', 'city'],
    required: true,
    tr: 'Şirketinizin kayıtlı olduğu ülke ve şehir nedir?',
    en: 'In which country and city is your company registered?',
    placeholder: ['Türkiye', 'İstanbul'],
    help_tr: 'Ana merkezi yazın — diğer lokasyonlar Aşama 2\'de eklenecek.',
    help_en: 'Enter headquarters — other locations will be added in Phase 2.',
    next: 'A4',
    reportField: 'tenant.country',
    sideEffect: 'suggest_ef_database',
    errors: {
      required: { tr: 'Ülke seçimi zorunludur.', en: 'Country is required.' },
    },
  },
  {
    id: 'A4',
    phase: 1,
    block: 'A',
    field: 'reporting_year',
    type: 'select',
    required: true,
    options: [
      { key: 2026, tr: '2026', en: '2026' },
      { key: 2025, tr: '2025', en: '2025', warning: { tr: '⚠️ 2025 henüz tamamlanmadı.', en: '⚠️ 2025 is not yet complete.' } },
      { key: 2024, tr: '2024', en: '2024' },
      { key: 2023, tr: '2023', en: '2023' },
      { key: 2022, tr: '2022', en: '2022' },
      { key: 2021, tr: '2021', en: '2021' },
      { key: 2020, tr: '2020', en: '2020' },
    ],
    tr: 'Hangi yıla ait rapor hazırlıyoruz?',
    en: 'Which reporting year are we preparing this report for?',
    help_tr: 'Tüm veri girişleriniz bu yıl için geçerli olacak.',
    help_en: 'All data entries will be for this year.',
    next: 'A5',
    reportField: 'reporting_year',
    errors: {
      required: { tr: 'Raporlama yılı zorunludur.', en: 'Reporting year is required.' },
    },
  },
  {
    id: 'A5',
    phase: 1,
    block: 'A',
    field: 'prepared_by',
    type: 'text',
    required: true,
    maxLength: 100,
    tr: 'Raporu hazırlayan kişi veya birimin adı nedir?',
    en: 'Who is preparing this report? (name and/or department)',
    placeholder: 'Örn: Ahmet Yılmaz — Sürdürülebilirlik Birimi',
    help_tr: 'Raporda "Hazırlayan" alanında görünecek.',
    help_en: 'Will appear in the "Prepared by" field of the report.',
    next: 'A6',
    reportField: 'report.prepared_by',
    errors: {
      required: { tr: 'Hazırlayan kişi/birim zorunludur.', en: 'Preparer name is required.' },
    },
  },
  {
    id: 'A6',
    phase: 1,
    block: 'A',
    field: 'purposes',
    type: 'multi',
    required: false,
    tr: 'Bu raporun kullanım amacı nedir?',
    en: 'What is the intended use of this report?',
    help_tr: 'Birden fazla seçebilirsiniz. Atlamak isterseniz devam edebilirsiniz.',
    help_en: 'Select multiple. You can skip if you prefer.',
    options: [
      { key: 'internal', tr: 'İç yönetim ve strateji', en: 'Internal management and strategy' },
      { key: 'legal', tr: 'Yasal zorunluluk (mevzuat uyumu)', en: 'Legal requirement (regulatory compliance)' },
      { key: 'voluntary', tr: 'Gönüllü açıklama (CDP, GRI, TCFD)', en: 'Voluntary disclosure (CDP, GRI, TCFD)' },
      { key: 'client', tr: 'Müşteri / tedarik zinciri talebi', en: 'Client / supply chain requirement' },
      { key: 'skip', tr: 'Atlamak istiyorum', en: 'Skip' },
    ],
    next: 'A7',
    reportField: 'report.purposes',
  },
  {
    id: 'A7',
    phase: 1,
    block: 'A',
    field: 'has_previous_report',
    type: 'choice',
    required: true,
    tr: 'Daha önce karbon raporu hazırladınız mı?',
    en: 'Have you prepared a carbon report before?',
    help_tr: 'Daha önce hazırladıysanız baz yıl karşılaştırması yapılabilir.',
    help_en: 'If yes, baseline comparison will be enabled.',
    options: [
      { key: 'yes', tr: 'Evet — daha önce hazırladık', en: 'Yes — we have prepared one before' },
      { key: 'no', tr: 'Hayır — ilk raporumuz', en: 'No — this is our first report' },
      { key: 'skip', tr: 'Atlamak istiyorum', en: 'Skip' },
    ],
    next: 'B1',
    conditions: [
      { when: 'yes', next: 'A7a' },
      { when: 'no', next: 'B1' },
      { when: 'skip', next: 'B1' },
    ],
    reportField: 'report.has_previous_report',
  },
  {
    id: 'A7a',
    phase: 1,
    block: 'A',
    field: 'baseline_year',
    type: 'number',
    required: false,
    min: 2010,
    max: 2025,
    tr: 'Baz yılınız hangi yıl?',
    en: 'What is your baseline year?',
    placeholder: '2020',
    help_tr: 'Baz yıl, emisyon trendlerinizi kıyaslayacağınız referans yıldır.',
    help_en: 'The baseline year is your reference for emission trend comparison.',
    next: 'B1',
    reportField: 'report.baseline_year',
    errors: {
      invalid: { tr: 'Baz yıl raporlama yılından önce olmalıdır.', en: 'Baseline year must be before reporting year.' },
    },
  },

  // ═══════════════════════════════════════════════════════
  // PHASE 1 — BLOCK B: Faaliyet Profili (6 questions)
  // ═══════════════════════════════════════════════════════
  {
    id: 'B1',
    phase: 1,
    block: 'B',
    field: 'nace_code',
    type: 'nace_search',
    required: true,
    tr: 'Şirketinizin ana sektörü nedir?',
    en: 'What is the primary sector of your company?',
    placeholder: 'Sektör adı veya NACE kodu yazın...',
    help_tr: 'NACE kodunuzu bilmiyorsanız sektörünüzü yazmaya başlayın.',
    help_en: 'Start typing your sector if you don\'t know the NACE code.',
    next: 'B2',
    reportField: 'tenant.nace_code',
    sideEffect: 'determine_cluster',
    errors: {
      required: { tr: 'Sektör seçimi zorunludur.', en: 'Sector selection is required.' },
    },
  },
  {
    id: 'B2',
    phase: 1,
    block: 'B',
    field: 'activity_description',
    type: 'textarea',
    required: true,
    maxLength: 500,
    tr: 'Şirketinizin faaliyetini kısaca tanımlayın.',
    en: 'Briefly describe your company\'s main business activity.',
    placeholder: 'Örn: Kurumsal eğitim ve danışmanlık hizmetleri sunuyoruz.',
    help_tr: 'ISO 14064-1 raporunun "Kuruluş Tanımı" bölümünde kullanılacak.',
    help_en: 'Will be used in the "Organization Description" section of the ISO report.',
    next: 'B3',
    reportField: 'report.organization_description',
    errors: {
      required: { tr: 'Faaliyet tanımı zorunludur.', en: 'Activity description is required.' },
      maxLength: { tr: 'En fazla 500 karakter.', en: 'Max 500 characters.' },
    },
  },
  {
    id: 'B3',
    phase: 1,
    block: 'B',
    field: 'employee_band',
    type: 'choice',
    required: true,
    tr: 'Toplam çalışan sayınız nedir?',
    en: 'What is your total number of employees?',
    help_tr: 'Raporlama yılı sonu itibarıyla tam zamanlı eşdeğer (FTE) çalışan sayısı.',
    help_en: 'Full-time equivalent (FTE) employees at end of reporting year.',
    options: [
      { key: '1-50', tr: '1–50 çalışan', en: '1–50 employees' },
      { key: '51-250', tr: '51–250 çalışan', en: '51–250 employees' },
      { key: '251-1000', tr: '251–1.000 çalışan', en: '251–1,000 employees' },
      { key: '1001-5000', tr: '1.001–5.000 çalışan', en: '1,001–5,000 employees' },
      { key: '5000+', tr: '5.000+ çalışan', en: '5,000+ employees' },
    ],
    next: 'B4',
    reportField: 'tenant.employee_band',
  },
  {
    id: 'B4',
    phase: 1,
    block: 'B',
    field: 'number_of_facilities',
    type: 'number',
    required: true,
    min: 1,
    max: 999,
    tr: 'Kaç farklı fiziksel lokasyonda faaliyet gösteriyorsunuz?',
    en: 'How many physical locations does your company operate from?',
    placeholder: '3',
    help_tr: 'Ofis, fabrika, depo, şube gibi tüm fiziksel lokasyonları sayın.',
    help_en: 'Count all physical locations: offices, factories, warehouses, branches.',
    next: 'B5',
    reportField: 'tenant.number_of_facilities',
    errors: {
      required: { tr: 'Lokasyon sayısı zorunludur.', en: 'Number of locations is required.' },
      min: { tr: 'En az 1 lokasyon gereklidir.', en: 'At least 1 location required.' },
    },
  },
  {
    id: 'B5',
    phase: 1,
    block: 'B',
    field: 'facility_types',
    type: 'multi',
    required: true,
    tr: 'Bu lokasyonların türleri neler?',
    en: 'What types of locations does your company operate?',
    help_tr: 'Birden fazla seçebilirsiniz. Seçimleriniz hangi soruların sorulacağını belirler.',
    help_en: 'Select multiple. Your choices determine which questions will be asked.',
    options: [
      { key: 'office', tr: 'Ofis', en: 'Office' },
      { key: 'factory', tr: 'Fabrika / Üretim tesisi', en: 'Factory / Production facility' },
      { key: 'warehouse', tr: 'Depo / Lojistik merkezi', en: 'Warehouse / Logistics center' },
      { key: 'field', tr: 'Saha / Açık alan operasyonu', en: 'Field / Open area operation' },
      { key: 'datacenter', tr: 'Veri Merkezi', en: 'Data Center' },
      { key: 'retail', tr: 'Perakende mağaza / Showroom', en: 'Retail store / Showroom' },
      { key: 'other', tr: 'Diğer', en: 'Other' },
    ],
    next: 'B6',
    reportField: 'tenant.facility_types',
    errors: {
      required: { tr: 'En az bir lokasyon türü seçin.', en: 'Select at least one location type.' },
    },
  },
  {
    id: 'B6',
    phase: 1,
    block: 'B',
    field: 'revenue_band',
    type: 'choice',
    required: false,
    tr: 'Yıllık ciro aralığınız nedir? (Opsiyonel)',
    en: 'What is your approximate annual revenue range? (Optional)',
    help_tr: 'Kapsam 3 materyalite analizi için kullanılır. Atlanabilir.',
    help_en: 'Used for Scope 3 materiality analysis. Can be skipped.',
    options: [
      { key: '<1M', tr: '< 500 Bin ₺', en: '< 500K ₺' },
      { key: '1-10M', tr: '500 Bin – 2 Milyon ₺', en: '500K – 2M ₺' },
      { key: '10-100M', tr: '2 – 10 Milyon ₺', en: '2M – 10M ₺' },
      { key: '100M-1B', tr: '10 – 50 Milyon ₺', en: '10M – 50M ₺' },
      { key: '1B+', tr: '50 Milyon ₺ üzeri', en: '50M+ ₺' },
      { key: 'skip', tr: 'Atlamak istiyorum', en: 'Skip' },
    ],
    next: 'C1',
    reportField: 'tenant.revenue_band',
  },

  // ═══════════════════════════════════════════════════════
  // PHASE 1 — BLOCK C: Yapısal Bilgiler (3 questions)
  // ═══════════════════════════════════════════════════════
  {
    id: 'C1',
    phase: 1,
    block: 'C',
    field: 'has_subsidiaries',
    type: 'choice',
    required: true,
    tr: 'Bağlı şirket veya iştirakınız var mı?',
    en: 'Does your company have any subsidiaries or affiliates?',
    help_tr: 'Varsa her biri için organizasyon sınırı testi yapılacak.',
    help_en: 'If yes, an organizational boundary test will be conducted for each.',
    options: [
      { key: 'yes', tr: 'Evet', en: 'Yes' },
      { key: 'no', tr: 'Hayır', en: 'No' },
    ],
    next: 'C2',
    reportField: 'tenant.has_subsidiaries',
  },
  {
    id: 'C2',
    phase: 1,
    block: 'C',
    field: 'has_international',
    type: 'choice',
    required: true,
    tr: 'Yurt dışında operasyonunuz var mı?',
    en: 'Does your company have any international operations?',
    help_tr: 'Varsa her ülke için farklı emisyon faktörleri kullanılacak.',
    help_en: 'If yes, country-specific emission factors will be applied.',
    options: [
      { key: 'yes', tr: 'Evet', en: 'Yes' },
      { key: 'no', tr: 'Hayır', en: 'No' },
    ],
    next: 'C3',
    reportField: 'tenant.has_international',
  },
  {
    id: 'C3',
    phase: 1,
    block: 'C',
    field: 'has_jv_franchise',
    type: 'choice',
    required: true,
    tr: 'Franchise veya ortak girişim (JV) var mı?',
    en: 'Does your company have any franchise agreements or joint ventures?',
    help_tr: 'Varsa operasyonel kontrol testi gerekir.',
    help_en: 'If yes, an operational control test is required.',
    options: [
      { key: 'yes', tr: 'Evet', en: 'Yes' },
      { key: 'no', tr: 'Hayır', en: 'No' },
    ],
    next: 'D1',
    reportField: 'tenant.has_jv_franchise',
  },

  // ═══════════════════════════════════════════════════════
  // PHASE 1 — BLOCK D: Raporlama Tercihleri (4 questions)
  // ═══════════════════════════════════════════════════════
  {
    id: 'D1',
    phase: 1,
    block: 'D',
    field: 'ef_database',
    type: 'choice',
    required: true,
    tr: 'Emisyon faktörü veritabanı tercihiniz nedir?',
    en: 'Which emission factor database would you like to use?',
    help_tr: 'Sistem ülkenize göre en uygun veritabanını önerdi. Değiştirebilirsiniz.',
    help_en: 'System suggested the best database for your country. You can change it.',
    options: [
      { key: 'DEFRA', tr: 'DEFRA 2023 (UK — çok ülkede kabul görür)', en: 'DEFRA 2023 (UK — widely accepted)' },
      { key: 'DEFRA_TUIK', tr: 'DEFRA + TÜİK (Türkiye ulusal + DEFRA fallback)', en: 'DEFRA + TÜİK (Turkey national + DEFRA fallback)' },
      { key: 'IPCC_AR6', tr: 'IPCC AR6 2021 (Uluslararası — en güncel GWP)', en: 'IPCC AR6 2021 (International — latest GWP)' },
      { key: 'EPA', tr: 'EPA (ABD Çevre Koruma Ajansı)', en: 'EPA (US Environmental Protection Agency)' },
      { key: 'custom', tr: 'Kullanıcı tanımlı faktör yükle', en: 'Upload custom emission factors' },
    ],
    next: 'D2',
    reportField: 'report.ef_database',
  },
  {
    id: 'D2',
    phase: 1,
    block: 'D',
    field: 'scope2_method_ack',
    type: 'info',
    required: false,
    tr: 'Bu versiyon yalnızca location-based (konum bazlı) Kapsam 2 metodolojisini desteklemektedir.',
    en: 'This version only supports location-based Scope 2 methodology.',
    help_tr: 'Market-based metodoloji ileride eklenecektir.',
    help_en: 'Market-based methodology will be added in a future update.',
    next: 'D3',
    reportField: 'report.scope2_method',
    assumption: {
      type: 'B',
      text_tr: 'Location-based Kapsam 2 metodolojisi uygulandı. Market-based alternatif bu versiyonda desteklenmiyor.',
      text_en: 'Location-based Scope 2 methodology applied. Market-based alternative not supported in this version.',
    },
  },
  {
    id: 'D3',
    phase: 1,
    block: 'D',
    field: 'boundary_approach',
    type: 'choice',
    required: true,
    tr: 'Organizasyon sınırı raporlama yaklaşımı nedir?',
    en: 'Which organizational boundary approach will you use?',
    help_tr: 'Emin değilseniz "Operasyonel Kontrol" ile devam edin — en yaygın yaklaşım.',
    help_en: 'If unsure, use "Operational Control" — the most common approach.',
    options: [
      { key: 'operational_control', tr: 'Operasyonel Kontrol (Önerilen)', en: 'Operational Control (Recommended)', desc_tr: 'Operasyonel politikaları siz belirleyen tüm tesisler dahil.', desc_en: 'All sites where you set operational policies are included.' },
      { key: 'financial_control', tr: 'Finansal Kontrol', en: 'Financial Control', desc_tr: 'Konsolide finansal tablolarla örtüşür.', desc_en: 'Aligns with consolidated financial statements.' },
      { key: 'equity_share', tr: 'Hisse Payı', en: 'Equity Share', desc_tr: 'Her tesisten hisse oranınız kadar emisyon payı.', desc_en: 'Proportional emissions based on equity share.' },
    ],
    next: 'D4',
    reportField: 'report.boundary_approach',
  },
  {
    id: 'D4',
    phase: 1,
    block: 'D',
    field: 'scope3_approach',
    type: 'choice',
    required: true,
    tr: 'Kapsam 3 kapsamını nasıl belirlemek istersiniz?',
    en: 'How would you like to determine the scope of your Scope 3 reporting?',
    help_tr: 'Materyalite bazlı daha hızlı, tam 15 kategori daha kapsamlı.',
    help_en: 'Materiality-based is faster, full 15 categories is more comprehensive.',
    options: [
      { key: 'materiality', tr: 'Materyalite Bazlı (Önerilen — daha hızlı)', en: 'Materiality Based (Recommended — faster)' },
      { key: 'full', tr: 'Tam 15 Kategori (daha kapsamlı)', en: 'Full 15 Categories (more comprehensive)' },
    ],
    next: 'PHASE1_COMPLETE',
    reportField: 'report.scope3_approach',
  },
];

// Helper: get question by ID
export function getQuestionById(id) {
  return carboniqQuestions.find(q => q.id === id);
}

// Helper: get next question based on answer and conditions
export function getNextQuestionId(question, answer, allAnswers) {
  if (question.conditions) {
    const matched = question.conditions.find(c => c.when === answer);
    if (matched) return matched.next;
  }
  return question.next;
}

// Helper: validate answer
export function validateAnswer(question, value, lang = 'tr') {
  if (question.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return question.errors?.required?.[lang] || (lang === 'tr' ? 'Bu alan zorunludur.' : 'This field is required.');
  }
  if (question.pattern && typeof value === 'string') {
    const regex = new RegExp(question.pattern);
    if (!regex.test(value)) {
      return question.errors?.pattern?.[lang] || (lang === 'tr' ? 'Geçersiz format.' : 'Invalid format.');
    }
  }
  if (question.maxLength && typeof value === 'string' && value.length > question.maxLength) {
    return question.errors?.maxLength?.[lang] || (lang === 'tr' ? 'Çok uzun.' : 'Too long.');
  }
  if (question.min !== undefined && typeof value === 'number' && value < question.min) {
    return question.errors?.min?.[lang] || (lang === 'tr' ? `Minimum ${question.min}.` : `Minimum ${question.min}.`);
  }
  if (question.type === 'multi' && question.required && (!Array.isArray(value) || value.length === 0)) {
    return question.errors?.required?.[lang] || (lang === 'tr' ? 'En az bir seçim yapın.' : 'Select at least one.');
  }
  return null; // valid
}
