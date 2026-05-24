export const CARBONIQ_STAGES = [
  {
    id: 1,
    title: { tr: 'Şirketi Tanıma', en: 'Company Profile' },
    blocks: ['A', 'B', 'C', 'D'],
  },
  {
    id: 2,
    title: { tr: 'Organizasyon Sınırı', en: 'Organizational Boundary' },
    blocks: ['2A', '2B', '2C'],
  },
  {
    id: 3,
    title: { tr: 'Kapsam 1', en: 'Scope 1' },
    blocks: ['3A', '3B', '3C', '3D'],
  },
  {
    id: 4,
    title: { tr: 'Kapsam 2', en: 'Scope 2' },
    blocks: ['4A', '4B', '4C'],
  },
  {
    id: 5,
    title: { tr: 'Kapsam 3', en: 'Scope 3' },
    blocks: ['5A', '5B', '5C', '5D', '5E', '5F', '5G', '5H', '5I', '5J', '5K', '5L', '5M', '5N', '5O', '5P'],
  },
  {
    id: 6,
    title: { tr: 'Hariç Tutmalar ve Kabuller', en: 'Exclusions and Assumptions' },
    blocks: ['6-GİRİŞ', '6A', '6B', '6C', '6D', '6E', '6F'],
  },
  {
    id: 7,
    title: { tr: 'Rapor Üretimi', en: 'Report Generation' },
    blocks: ['7-GİRİŞ', '7A', '7B', '7C'],
  },
];

export const CARBONIQ_QUESTIONS = [
  {
    id: 'A1',
    number: 1,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'text',
    subtype: 'single_line',
    required: true,
    maxLength: 200,
    reportField: 'tenant.company_name',
    text: {
      tr: 'Şirketinizin tam ticari unvanı nedir?',
      en: 'What is the full legal name of your company?',
    },
    placeholder: {
      tr: 'Örn: ABC Teknoloji Danışmanlık A.Ş.',
      en: 'Example: ABC Technology Consulting Inc.',
    },
    helper: {
      tr: 'Ticaret sicilinde kayıtlı tam unvanınızı girin. Rapor kapağında ve resmi belgede bu isim kullanılacak.',
      en: 'Enter the full legal name registered in the trade registry. This name will be used on the report cover and official document.',
    },
    validate: {
      requiredMessage: {
        tr: 'Şirket adı zorunludur. Lütfen ticaret sicilinde kayıtlı tam unvanı girin.',
        en: 'Company name is required. Please enter the full legal name registered in the trade registry.',
      },
      maxLengthMessage: {
        tr: 'Şirket adı en fazla 200 karakter olabilir.',
        en: 'Company name can be at most 200 characters.',
      },
    },
    next: 'A2',
  },
  {
    id: 'A2',
    number: 2,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'text',
    subtype: 'numeric',
    required: true,
    exactLength: 10,
    numericOnly: true,
    reportField: 'tenant.vkn',
    text: {
      tr: 'Vergi kimlik numaranız nedir?',
      en: 'What is your tax identification number?',
    },
    placeholder: {
      tr: '0000000000',
      en: '0000000000',
    },
    helper: {
      tr: '10 haneli VKN / TCKN. Sistem içi kimlik doğrulama için kullanılır, üçüncü taraflarla paylaşılmaz.',
      en: '10-digit tax ID. It is used for internal identity verification and is not shared with third parties.',
    },
    validate: {
      requiredMessage: {
        tr: 'Vergi kimlik numarası zorunludur.',
        en: 'Tax identification number is required.',
      },
      formatMessage: {
        tr: 'Lütfen 10 haneli vergi kimlik numaranızı girin (yalnızca rakam).',
        en: 'Please enter your 10-digit tax identification number using digits only.',
      },
    },
    next: 'A3',
  },
  {
    id: 'A3',
    number: 3,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'country_city',
    required: true,
    reportField: 'tenant.registered_location',
    text: {
      tr: 'Şirketinizin kayıtlı olduğu ülke ve şehir nedir?',
      en: 'In which country and city is your company registered?',
    },
    placeholder: {
      tr: 'Ülke: Türkiye seçin | Şehir: İstanbul',
      en: 'Country: Select Turkey | City: Istanbul',
    },
    helper: {
      tr: 'Şirketin ticaret sicilinde kayıtlı olduğu ülke ve şehri seçin. Birden fazla ülkede tesis varsa ana merkezi yazın — diğerleri Aşama 2\'de eklenecek.',
      en: 'Select the country and city where the company is legally registered. If you have facilities in multiple countries, enter the headquarters here — others will be added in Step 2.',
    },
    options: [
      { value: 'TR', label: { tr: 'Türkiye', en: 'Turkey' }, efSuggestion: 'DEFRA_TUIK' },
      { value: 'GB', label: { tr: 'İngiltere', en: 'United Kingdom' }, efSuggestion: 'DEFRA' },
      { value: 'DE', label: { tr: 'Almanya', en: 'Germany' }, efSuggestion: 'DEFRA' },
      { value: 'US', label: { tr: 'ABD', en: 'United States' }, efSuggestion: 'EPA' },
      { value: 'OTHER', label: { tr: 'Diğer', en: 'Other' }, efSuggestion: 'IPCC_AR6' },
    ],
    validate: {
      requiredMessage: {
        tr: 'Lütfen şirketinizin kayıtlı olduğu ülkeyi ve şehri girin.',
        en: 'Please enter the country and city where your company is registered.',
      },
    },
    systemMessages: {
      infoOtherCountry: {
        tr: 'Bilgi: Emisyon faktörü veritabanı önerimiz seçtiğiniz ülkeye göre belirlendi. İsterseniz D1 adımında değiştirebilirsiniz.',
        en: 'Info: Our emission factor database suggestion was selected based on your country. You can change it later in D1.',
      },
    },
    next: 'A4',
  },
  {
    id: 'A4',
    number: 4,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'year_select',
    required: true,
    reportField: 'reporting_year',
    text: {
      tr: 'Hangi yıla ait rapor hazırlıyoruz?',
      en: 'Which reporting year are we preparing this report for?',
    },
    placeholder: {
      tr: 'Yıl seçin',
      en: 'Select year',
    },
    helper: {
      tr: 'Tüm veri girişleriniz bu yıl için geçerli olacak. Cari yılı seçerseniz bazı verilerin tahmini olacağını unutmayın.',
      en: 'All data entries will apply to this year. If you select the current year, some data may need to be estimated.',
    },
    options: [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => ({
      value: String(year),
      label: {
        tr: year === 2026 ? '2026 (cari yıl — veri eksik olabilir)' : String(year),
        en: year === 2026 ? '2026 (current year — data may be incomplete)' : String(year),
      },
    })),
    validate: {
      requiredMessage: {
        tr: 'Lütfen raporlama yılını seçin.',
        en: 'Please select the reporting year.',
      },
    },
    assumptions: [
      {
        when: { equals: '2026' },
        type: 'A',
        trigger: 'current_year_selected',
        text: {
          tr: 'Cari yıl seçildiği için bazı veriler tahmini olabilir.',
          en: 'Because the current year was selected, some data may be estimated.',
        },
        impact: 'May affect completeness of annual data.',
      },
    ],
    warning: {
      when: { equals: '2026' },
      text: {
        tr: '2026 henüz tamamlanmadı. Yıl sonu verileriniz eksik olabilir — bazı kalemlerde tahmini veri kullanmak gerekebilir. Bu durum raporunuzda belgelenecek.',
        en: '2026 is not complete yet. Year-end data may be incomplete — some items may require estimated data. This will be documented in your report.',
      },
    },
    next: 'A5',
  },
  {
    id: 'A5',
    number: 5,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'text',
    subtype: 'single_line',
    required: true,
    maxLength: 100,
    reportField: 'report.prepared_by',
    text: {
      tr: 'Raporu hazırlayan kişi veya birimin adı nedir?',
      en: 'Who is preparing this report? (name and/or department)',
    },
    placeholder: {
      tr: 'Örn: Ahmet Yılmaz — Sürdürülebilirlik Birimi',
      en: 'Example: Alex Smith — Sustainability Department',
    },
    helper: {
      tr: 'Raporda "Hazırlayan" alanında görünecek. Ad ve birim birlikte yazılabilir.',
      en: 'This will appear in the "Prepared by" field of the report. You may enter both name and department.',
    },
    validate: {
      requiredMessage: {
        tr: 'Hazırlayan kişi / birim adı zorunludur.',
        en: 'Prepared by name / department is required.',
      },
      maxLengthMessage: {
        tr: 'Bu alan en fazla 100 karakter olabilir.',
        en: 'This field can be at most 100 characters.',
      },
    },
    next: 'A6',
  },
  {
    id: 'A6',
    number: 6,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'multi_select',
    required: false,
    reportField: 'report.intended_use',
    text: {
      tr: 'Bu raporun kullanım amacı nedir?',
      en: 'What is the intended use of this report?',
    },
    helper: {
      tr: 'Birden fazla seçebilirsiniz. Rapor kapağında ve doğrulama beyanında yer alacak. Atlamak isterseniz devam edebilirsiniz.',
      en: 'You may select more than one. This will appear on the report cover and verification statement. You may skip if you prefer.',
    },
    options: [
      { value: 'internal_strategy', label: { tr: 'İç yönetim ve strateji', en: 'Internal management and strategy' } },
      { value: 'legal_obligation', label: { tr: 'Yasal zorunluluk (mevzuat uyumu)', en: 'Legal obligation / regulatory compliance' }, infoKey: 'legalInfo' },
      { value: 'voluntary_disclosure', label: { tr: 'Gönüllü açıklama (CDP, GRI, TCFD vb.)', en: 'Voluntary disclosure (CDP, GRI, TCFD etc.)' }, infoKey: 'voluntaryInfo' },
      { value: 'customer_request', label: { tr: 'Müşteri / tedarik zinciri talebi', en: 'Customer / supply chain request' } },
      { value: 'skip', label: { tr: 'Atlamak istiyorum', en: 'I want to skip' } },
    ],
    systemMessages: {
      legalInfo: {
        tr: 'Yasal zorunluluk seçtiniz. Hangi mevzuat veya düzenleme kapsamında raporlama yapıyorsunuz? Örn: CSRD, Borsa İstanbul Sürdürülebilirlik Endeksi, TCFD zorunluluğu vb.',
        en: 'You selected legal obligation. Which regulation or framework are you reporting under? Example: CSRD, stock exchange sustainability index, TCFD requirement etc.',
      },
      voluntaryInfo: {
        tr: 'Gönüllü açıklama için hangi çerçeveyi kullanıyorsunuz? CDP, GRI, TCFD veya diğer çerçeveleri belirtirseniz rapor bu çerçeveyle uyumlu notlar içerecek.',
        en: 'For voluntary disclosure, which framework are you using? If you specify CDP, GRI, TCFD or other frameworks, the report will include relevant notes.',
      },
    },
    next: 'A7',
  },
  {
    id: 'A7',
    number: 7,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'single_select',
    required: false,
    reportField: 'baseline_exists',
    text: {
      tr: 'Daha önce karbon raporu hazırladınız mı?',
      en: 'Have you prepared a carbon report before?',
    },
    helper: {
      tr: 'Daha önce hazırladıysanız baz yıl karşılaştırması ve trend analizi raporunuza eklenecek.',
      en: 'If you have prepared one before, baseline comparison and trend analysis will be added to your report.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — daha önce hazırladık', en: 'Yes — we prepared one before' } },
      { value: 'no', label: { tr: 'Hayır — ilk raporumuz', en: 'No — this is our first report' } },
      { value: 'skip', label: { tr: 'Atlamak istiyorum', en: 'I want to skip' } },
    ],
    nextByValue: {
      yes: 'A7a',
      no: 'B1',
      skip: 'B1',
    },
    systemMessages: {
      yes: {
        tr: 'Baz yılınızı bir sonraki adımda soracağız. Önceki raporunuzdaki veriler varsa karşılaştırmalı analiz yapabiliriz.',
        en: 'We will ask your baseline year in the next step. If you have previous report data, we can create comparative analysis.',
      },
    },
  },
  {
    id: 'A7a',
    number: 8,
    stage: 1,
    block: 'A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'year_select',
    required: false,
    conditionalRequired: { questionId: 'A7', equals: 'yes' },
    reportField: 'baseline_year',
    text: {
      tr: 'Baz yılınız hangi yıl?',
      en: 'What is your baseline year?',
    },
    placeholder: {
      tr: 'Baz yılı seçin',
      en: 'Select baseline year',
    },
    helper: {
      tr: 'Baz yıl, emisyon trendlerinizi kıyaslayacağınız referans yıldır. Genellikle en eski güvenilir veri yılı seçilir.',
      en: 'The baseline year is the reference year used to compare your emissions trend. Usually, the earliest reliable data year is selected.',
    },
    options: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025].map((year) => ({
      value: String(year),
      label: { tr: String(year), en: String(year) },
    })),
    validateAgainst: {
      questionId: 'A4',
      rule: 'less_than',
      messageSame: {
        tr: 'Baz yıl ile raporlama yılı aynı olamaz. Lütfen daha önceki bir yıl seçin.',
        en: 'Baseline year and reporting year cannot be the same. Please select an earlier year.',
      },
      messageAfter: {
        tr: 'Baz yıl, raporlama yılından önce olmalıdır.',
        en: 'Baseline year must be before the reporting year.',
      },
    },
    systemMessages: {
      selected: {
        tr: 'Baz yıl olarak seçilen yıl belirlendi. Bu yıla ait emisyon verilerinizi raporun sonunda girmenizi isteyeceğiz.',
        en: 'Baseline year selected. We will ask you to enter emission data for this year at the end of the report flow.',
      },
    },
    next: 'B1',
  },

  // ── BLOCK B ─ Activity Profile ─────────────────────────────────────────────
  {
    id: 'B1',
    number: 9,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    subtype: 'searchable',
    required: true,
    reportField: 'company.nace_sector',
    text: {
      tr: 'Şirketinizin ana sektörü nedir?',
      en: 'What is the primary sector of your company?',
    },
    placeholder: {
      tr: 'Sektör adı veya NACE kodu yazın...',
      en: 'Type sector name or NACE code...',
    },
    helper: {
      tr: 'NACE kodunuzu bilmiyorsanız sektörünüzü yazmaya başlayın, sistem eşleşen seçenekleri gösterir. Bu seçim hangi soruların sorulacağını belirler.',
      en: 'If you don\'t know your NACE code, start typing your sector and the system will show matching options. This selection determines which questions will be asked.',
    },
    options: [
      { value: 'NACE_A', label: { tr: 'NACE A — Tarım, ormancılık, balıkçılık', en: 'NACE A — Agriculture, forestry and fishing' }, cluster: 'agriculture' },
      { value: 'NACE_B', label: { tr: 'NACE B — Madencilik ve taş ocakçılığı', en: 'NACE B — Mining and quarrying' }, cluster: 'mining' },
      { value: 'NACE_C', label: { tr: 'NACE C — İmalat / Üretim', en: 'NACE C — Manufacturing' }, cluster: 'manufacturing' },
      { value: 'NACE_D', label: { tr: 'NACE D — Elektrik, gaz, buhar üretimi ve dağıtımı', en: 'NACE D — Electricity, gas, steam and air conditioning supply' }, cluster: 'energy' },
      { value: 'NACE_E', label: { tr: 'NACE E — Su temini, kanalizasyon, atık yönetimi', en: 'NACE E — Water supply, sewerage, waste management' }, cluster: 'utilities' },
      { value: 'NACE_F', label: { tr: 'NACE F — İnşaat', en: 'NACE F — Construction' }, cluster: 'construction' },
      { value: 'NACE_G', label: { tr: 'NACE G — Toptan ve perakende ticaret', en: 'NACE G — Wholesale and retail trade' }, cluster: 'services' },
      { value: 'NACE_H', label: { tr: 'NACE H — Ulaştırma ve depolama', en: 'NACE H — Transportation and storage' }, cluster: 'logistics' },
      { value: 'NACE_I', label: { tr: 'NACE I — Konaklama ve yiyecek-içecek', en: 'NACE I — Accommodation and food service' }, cluster: 'services' },
      { value: 'NACE_J', label: { tr: 'NACE J — Bilgi ve iletişim / Yazılım / BT', en: 'NACE J — Information and communication / Software / IT' }, cluster: 'services' },
      { value: 'NACE_K', label: { tr: 'NACE K — Finans ve sigortacılık', en: 'NACE K — Financial and insurance activities' }, cluster: 'finance' },
      { value: 'NACE_L', label: { tr: 'NACE L — Gayrimenkul faaliyetleri', en: 'NACE L — Real estate activities' }, cluster: 'services' },
      { value: 'NACE_M', label: { tr: 'NACE M — Mesleki, bilimsel ve teknik faaliyetler', en: 'NACE M — Professional, scientific and technical activities' }, cluster: 'services' },
      { value: 'NACE_N', label: { tr: 'NACE N — İdari ve destek hizmetleri', en: 'NACE N — Administrative and support services' }, cluster: 'services' },
      { value: 'NACE_O', label: { tr: 'NACE O — Kamu yönetimi ve savunma', en: 'NACE O — Public administration and defence' }, cluster: 'public' },
      { value: 'NACE_P', label: { tr: 'NACE P — Eğitim', en: 'NACE P — Education' }, cluster: 'public' },
      { value: 'NACE_Q', label: { tr: 'NACE Q — Sağlık ve sosyal hizmetler', en: 'NACE Q — Human health and social work' }, cluster: 'public' },
      { value: 'NACE_R', label: { tr: 'NACE R — Kültür, sanat, eğlence', en: 'NACE R — Arts, entertainment and recreation' }, cluster: 'services' },
      { value: 'NACE_SU', label: { tr: 'NACE S–U — Diğer hizmet faaliyetleri', en: 'NACE S–U — Other service activities' }, cluster: 'services' },
    ],
    validate: {
      requiredMessage: {
        tr: 'Lütfen şirketinizin ana sektörünü seçin.',
        en: 'Please select the primary sector of your company.',
      },
    },
    systemMessages: {
      NACE_C: {
        tr: 'İmalat sektörü seçildi. Proses emisyonları dahil tüm Kapsam 1 kategorileri için sorular gelecek. Üretim süreçlerinize dair teknik bilgilere ihtiyaç duyabiliriz.',
        en: 'Manufacturing sector selected. Questions will cover all Scope 1 categories including process emissions. We may need technical information about your production processes.',
      },
      NACE_G: {
        tr: 'Hizmet sektörü seçildi. Proses emisyon soruları atlanacak. Enerji, seyahat ve tedarik zinciri odaklı ilerleyeceğiz.',
        en: 'Service sector selected. Process emission questions will be skipped. We will focus on energy, travel and supply chain.',
      },
      NACE_K: {
        tr: 'Finans sektörü seçildi. Kapsam 3 Kategori 15 (Finansal Yatırımlar) için PCAF standardı uygulanacak.',
        en: 'Finance sector selected. PCAF standard will be applied for Scope 3 Category 15 (Financial Investments).',
      },
    },
    next: 'B2',
  },
  {
    id: 'B2',
    number: 10,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: true,
    maxLength: 200,
    reportField: 'company.organization_description',
    text: {
      tr: 'Şirketinizin faaliyetini kısaca tanımlayın.',
      en: 'Briefly describe your company\'s main business activity.',
    },
    placeholder: {
      tr: 'Örn: Kurumsal eğitim ve danışmanlık hizmetleri sunuyoruz. İstanbul merkezli, yurt içi müşterilere hizmet veriyoruz.',
      en: 'Example: We provide corporate training and consulting services, headquartered in Istanbul, serving domestic clients.',
    },
    helper: {
      tr: 'ISO 14064-1 raporunun "Kuruluş Tanımı" bölümünde aynen kullanılacak. Sade ve açıklayıcı bir cümle yeterli. En fazla 200 karakter.',
      en: 'Will be used verbatim in the "Organization Description" section of the ISO 14064-1 report. A simple and clear sentence is sufficient. Maximum 200 characters.',
    },
    validate: {
      requiredMessage: {
        tr: 'Faaliyet tanımı zorunludur. Kısa bir cümle yeterli.',
        en: 'Activity description is required. A short sentence is sufficient.',
      },
      maxLengthMessage: {
        tr: 'En fazla 200 karakter girebilirsiniz. Lütfen metni kısaltın.',
        en: 'Maximum 200 characters allowed. Please shorten the text.',
      },
    },
    next: 'B3',
  },
  {
    id: 'B3',
    number: 11,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.employee_count_band',
    text: {
      tr: 'Toplam çalışan sayınız nedir?',
      en: 'What is your total number of employees?',
    },
    placeholder: {
      tr: 'Çalışan sayısı aralığını seçin',
      en: 'Select employee count range',
    },
    helper: {
      tr: 'Raporlama yılı sonu itibarıyla tam zamanlı eşdeğer (FTE) çalışan sayınızı seçin. Bu bilgi Kapsam 3 çalışan ulaşım hesaplarında kullanılacak.',
      en: 'Select the full-time equivalent (FTE) employee count as of the end of the reporting year. Used for Scope 3 employee commuting calculations.',
    },
    options: [
      { value: '1_50', label: { tr: '1–50 çalışan', en: '1–50 employees' }, band: 'micro' },
      { value: '51_250', label: { tr: '51–250 çalışan', en: '51–250 employees' }, band: 'small' },
      { value: '251_1000', label: { tr: '251–1.000 çalışan', en: '251–1,000 employees' }, band: 'medium' },
      { value: '1001_5000', label: { tr: '1.001–5.000 çalışan', en: '1,001–5,000 employees' }, band: 'large' },
      { value: '5000_plus', label: { tr: '5.000+ çalışan', en: '5,000+ employees' }, band: 'enterprise' },
    ],
    validate: {
      requiredMessage: {
        tr: 'Lütfen çalışan sayısı aralığını seçin.',
        en: 'Please select the employee count range.',
      },
    },
    systemMessages: {
      '1001_5000': {
        tr: 'Büyük bir organizasyonunuz var. Çalışan ulaşım hesapları için lokasyon bazlı dağılım soracağız — bu daha doğru bir sonuç verecek.',
        en: 'You have a large organization. We will ask for location-based distribution for employee commuting calculations — this will give a more accurate result.',
      },
      '5000_plus': {
        tr: 'Büyük bir organizasyonunuz var. Çalışan ulaşım hesapları için lokasyon bazlı dağılım soracağız — bu daha doğru bir sonuç verecek.',
        en: 'You have a large organization. We will ask for location-based distribution for employee commuting calculations — this will give a more accurate result.',
      },
    },
    next: 'B4',
  },
  {
    id: 'B4',
    number: 12,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'numeric',
    required: true,
    maxLength: 6,
    numericOnly: true,
    reportField: 'company.facility_count',
    text: {
      tr: 'Kaç farklı fiziksel lokasyonda faaliyet gösteriyorsunuz?',
      en: 'How many physical locations does your company operate from?',
    },
    placeholder: { tr: 'Örn: 3', en: 'Example: 3' },
    helper: {
      tr: 'Ofis, fabrika, depo, şube gibi tüm fiziksel lokasyonları sayın. Her lokasyon için ayrı emisyon verisi gireceksiniz. Bu sayı Aşama 2\'ye otomatik taşınacak.',
      en: 'Count all physical locations including offices, factories, warehouses, and branches. You will enter separate emission data for each. This number will automatically carry to Stage 2.',
    },
    validate: {
      requiredMessage: { tr: 'Lokasyon sayısı zorunludur.', en: 'Location count is required.' },
      formatMessage: { tr: 'Lütfen yalnızca rakam girin.', en: 'Please enter digits only.' },
    },
    next: 'B5',
  },
  {
    id: 'B5',
    number: 13,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'multi_select',
    required: true,
    reportField: 'company.location_types',
    text: {
      tr: 'Bu lokasyonların türleri neler?',
      en: 'What types of locations does your company operate?',
    },
    helper: {
      tr: 'Birden fazla seçebilirsiniz. Seçimleriniz hangi emisyon kaynaklarının sorulacağını belirler. Fabrika seçerseniz endüstriyel proses soruları eklenir, veri merkezi seçerseniz PUE sorusu gelir.',
      en: 'You may select multiple options. Your selections determine which emission sources will be asked. Selecting factory adds industrial process questions; selecting data center adds a PUE question.',
    },
    options: [
      { value: 'office', label: { tr: 'Ofis', en: 'Office' } },
      { value: 'factory', label: { tr: 'Fabrika / Üretim tesisi', en: 'Factory / Production facility' } },
      { value: 'warehouse', label: { tr: 'Depo / Lojistik merkezi', en: 'Warehouse / Logistics center' } },
      { value: 'field', label: { tr: 'Saha / Açık alan operasyonu', en: 'Field / Outdoor operations' } },
      { value: 'datacenter', label: { tr: 'Veri Merkezi', en: 'Data Center' } },
      { value: 'retail', label: { tr: 'Perakende mağaza / Showroom', en: 'Retail store / Showroom' } },
      { value: 'other', label: { tr: 'Diğer', en: 'Other' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir lokasyon türü seçin.', en: 'Please select at least one location type.' },
    },
    systemMessages: {
      factory: {
        tr: 'Üretim tesisi seçildi. Endüstriyel proses emisyonları ve ağır makine kullanımı için ek sorular gelecek.',
        en: 'Production facility selected. Additional questions about industrial process emissions and heavy machinery will be added.',
      },
      datacenter: {
        tr: 'Veri merkezi seçildi. Enerji verimliliği (PUE) için ek soru eklenecek — bu değer elektrik emisyonlarını doğrudan etkiler.',
        en: 'Data center selected. An additional question about energy efficiency (PUE) will be added — this directly affects electricity emissions.',
      },
    },
    next: 'B6',
  },
  {
    id: 'B6',
    number: 14,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'company.revenue_band',
    text: {
      tr: 'Yıllık ciro aralığınız nedir? (Opsiyonel)',
      en: 'What is your approximate annual revenue range? (Optional)',
    },
    placeholder: {
      tr: 'Ciro aralığını seçin veya atlayın',
      en: 'Select revenue range or skip',
    },
    helper: {
      tr: 'Bu bilgi Kapsam 3 materyalite analizi için kullanılır. Paylaşmak istemezseniz atlayabilirsiniz — yalnızca hangi kategorilerin öncelikli sorulacağını etkiler.',
      en: 'This information is used for Scope 3 materiality analysis. You may skip — it only affects which categories will be prioritized.',
    },
    options: [
      { value: 'under_1m', label: { tr: '1 Milyon TL\'nin altı', en: 'Under 1 Million TRY' }, band: 'micro' },
      { value: '1m_10m', label: { tr: '1–10 Milyon TL', en: '1–10 Million TRY' }, band: 'small' },
      { value: '10m_100m', label: { tr: '10–100 Milyon TL', en: '10–100 Million TRY' }, band: 'medium' },
      { value: '100m_1b', label: { tr: '100 Milyon – 1 Milyar TL', en: '100 Million – 1 Billion TRY' }, band: 'large' },
      { value: 'over_1b', label: { tr: '1 Milyar TL ve üzeri', en: '1 Billion TRY and above' }, band: 'enterprise' },
      { value: 'skip', label: { tr: 'Atlamak istiyorum', en: 'I want to skip' } },
    ],
    systemMessages: {
      '100m_1b': {
        tr: 'Büyük ölçekli şirketiniz için Kapsam 3\'ün tüm 15 kategorisini değerlendirmenizi öneririz. Bu daha kapsamlı ama çok daha güvenilir bir rapor anlamına gelir.',
        en: 'For your large-scale company, we recommend evaluating all 15 Scope 3 categories. This means a more comprehensive but much more reliable report.',
      },
      over_1b: {
        tr: 'Büyük ölçekli şirketiniz için Kapsam 3\'ün tüm 15 kategorisini değerlendirmenizi öneririz. Bu daha kapsamlı ama çok daha güvenilir bir rapor anlamına gelir.',
        en: 'For your large-scale company, we recommend evaluating all 15 Scope 3 categories. This means a more comprehensive but much more reliable report.',
      },
      skip: {
        tr: 'Ciro bilgisi girilmedi. Kapsam 3 kategori önceliklendirmesi için ilerleyen adımda manuel seçim yapmanızı isteyeceğiz.',
        en: 'Revenue information not entered. We will ask you to make a manual selection for Scope 3 category prioritization in a later step.',
      },
    },
    next: 'C1',
  },

  // ── BLOCK C ─ Structural Information ──────────────────────────────────────
  {
    id: 'C1',
    number: 15,
    stage: 1,
    block: 'C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.has_subsidiaries',
    text: {
      tr: 'Bağlı şirket veya iştirakınız var mı?',
      en: 'Does your company have any subsidiaries or affiliates?',
    },
    helper: {
      tr: 'Bağlı şirket veya iştiraklerin olması durumunda her biri için organizasyon sınırı testi yapılacak. Bu ISO 14064-1\'in zorunlu kıldığı bir adım.',
      en: 'If you have subsidiaries or affiliates, an organizational boundary test will be conducted for each. This is a mandatory step under ISO 14064-1.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      yes: {
        tr: 'Her bağlı şirket veya iştirak için Aşama 2\'de organizasyon sınırı testi yapacağız. Bu, ISO 14064-1 §5.1\'in zorunlu kıldığı bir adım — hangi şirketlerin rapora dahil edileceğini birlikte belirleyeceğiz.',
        en: 'We will conduct an organizational boundary test for each subsidiary or affiliate in Stage 2. This is mandatory under ISO 14064-1 §5.1 — we will determine together which companies are included in the report.',
      },
    },
    next: 'C2',
  },
  {
    id: 'C2',
    number: 16,
    stage: 1,
    block: 'C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.has_international_ops',
    text: {
      tr: 'Yurt dışında operasyonunuz var mı?',
      en: 'Does your company have any international operations?',
    },
    helper: {
      tr: 'Yurt dışı tesis, şube veya çalışanınız varsa her ülke için farklı emisyon faktörleri kullanılacak. Bu özellikle elektrik emisyonlarını önemli ölçüde etkiler.',
      en: 'If you have overseas facilities, branches or employees, different emission factors will be used for each country. This significantly affects electricity emissions in particular.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      yes: {
        tr: 'Yurt dışı operasyonlarınız için her ülkenin elektrik şebeke emisyon faktörü ayrıca uygulanacak. Örneğin Fransa\'daki bir tesisiniz Türkiye\'dekinden çok farklı bir elektrik emisyon faktörüne sahip olabilir.',
        en: 'The electricity grid emission factor of each country will be applied separately for your international operations. For example, a facility in France may have a very different electricity emission factor than one in Turkey.',
      },
    },
    next: 'C3',
  },
  {
    id: 'C3',
    number: 17,
    stage: 1,
    block: 'C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.has_franchise_jv',
    text: {
      tr: 'Franchise veya ortak girişim (JV) var mı?',
      en: 'Does your company have any franchise agreements or joint ventures?',
    },
    helper: {
      tr: 'Franchise veriyorsanız veya ortak girişiminiz varsa operasyonel kontrol testi gerekir. Bu, emisyonların kimin raporuna gireceğini belirler.',
      en: 'If you have franchise agreements or joint ventures, an operational control test is required. This determines whose report the emissions will be included in.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      yes: {
        tr: 'Franchise veya ortak girişimde operasyonel kontrolü elinde bulunduran taraf tüm emisyonları raporlar. Aşama 2\'de bu kontrolün kimde olduğunu birlikte belirleyeceğiz.',
        en: 'The party holding operational control of a franchise or joint venture reports all emissions. We will determine in Stage 2 who holds this control.',
      },
    },
    next: 'D1',
  },

  // ── BLOCK D ─ Reporting Preferences ───────────────────────────────────────
  {
    id: 'D1',
    number: 18,
    stage: 1,
    block: 'D',
    isoRef: 'ISO 14064-1 §6.1',
    type: 'single_select',
    subtype: 'searchable',
    required: true,
    reportField: 'report.ef_database',
    text: {
      tr: 'Emisyon faktörü veritabanı tercihiniz nedir?',
      en: 'Which emission factor database would you like to use?',
    },
    placeholder: {
      tr: 'Veritabanı seçin',
      en: 'Select database',
    },
    helper: {
      tr: 'Sistem bulunduğunuz ülkeye göre en uygun veritabanını önerdi. Değiştirmeniz gerekmez ama farklı bir tercih varsa aşağıdan seçebilirsiniz. Seçiminiz raporunuzda belgelenecek.',
      en: 'The system suggested the most suitable database based on your country. You don\'t need to change it, but you can select below if preferred. Your selection will be documented in the report.',
    },
    options: [
      { value: 'DEFRA_TUIK', label: { tr: 'DEFRA + TÜİK kombinasyonu (Türkiye için önerilen)', en: 'DEFRA + TUIK combination (recommended for Turkey)' }, efSuggestion: 'TR' },
      { value: 'DEFRA', label: { tr: 'DEFRA 2023 (UK — çok ülkede kabul görür)', en: 'DEFRA 2023 (UK — widely accepted internationally)' }, efSuggestion: 'GB' },
      { value: 'IPCC_AR6', label: { tr: 'IPCC AR6 2021 (Uluslararası — en güncel GWP değerleri)', en: 'IPCC AR6 2021 (International — latest GWP values)' }, efSuggestion: 'OTHER' },
      { value: 'EPA', label: { tr: 'EPA (ABD Çevre Koruma Ajansı)', en: 'EPA (US Environmental Protection Agency)' }, efSuggestion: 'US' },
      { value: 'custom', label: { tr: 'Kullanıcı tanımlı faktör yükle', en: 'Upload user-defined factor' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir emisyon faktörü veritabanı seçin.', en: 'Please select an emission factor database.' },
    },
    systemMessages: {
      preload_TR: {
        tr: 'Türkiye seçiminiz doğrultusunda DEFRA + TÜİK kombinasyonunu önerdik. Bu, ulusal veriler mevcut olduğunda onları, eksik kalemlerde ise DEFRA 2023\'ü kullanır.',
        en: 'Based on your Turkey selection, we suggested the DEFRA + TUIK combination. This uses national data when available and DEFRA 2023 as fallback.',
      },
      EPA: {
        tr: 'EPA veritabanı ABD bazlı faktörler içerir. Türkiye\'deki operasyonlarınız için bazı değerler uygun olmayabilir. DEFRA veya IPCC AR6 daha uygun olabilir.',
        en: 'EPA database contains US-based factors. Some values may not be suitable for your Turkey operations. DEFRA or IPCC AR6 may be more appropriate.',
      },
      custom: {
        tr: 'Özel emisyon faktörü yükleyeceksiniz. Kullandığınız kaynağı (kurum adı, yayın yılı) ve hangi kategoriler için kullandığınızı belirtmeniz raporunuzun güvenilirliği açısından önemli.',
        en: 'You will upload a custom emission factor. Specifying the source (institution name, year) and categories is important for the reliability of your report.',
      },
    },
    next: 'D2',
  },
  {
    id: 'D2',
    number: 19,
    stage: 1,
    block: 'D',
    isoRef: 'ISO 14064-1 §6.2',
    type: 'info',
    required: false,
    reportField: null,
    text: {
      tr: 'Kapsam 2 hesaplama metodolojisi hakkında bilgi',
      en: 'Information about Scope 2 calculation methodology',
    },
    helper: {
      tr: 'Bu versiyon yalnızca konum bazlı (location-based) Kapsam 2 metodolojisini desteklemektedir. Bu yöntemde elektrik emisyonları, tesisinizin bulunduğu bölgenin ortalama şebeke emisyon faktörü kullanılarak hesaplanır. Piyasa bazlı (market-based) metodoloji — yenilenebilir enerji sertifikalarını dikkate alan yöntem — ileride eklenecektir.',
      en: 'This version supports only the location-based Scope 2 methodology. Electricity emissions are calculated using the average grid emission factor of the region where your facility is located. The market-based methodology — which accounts for renewable energy certificates — will be added in the future.',
    },
    systemMessages: {
      onLoad: {
        tr: 'Konum bazlı yöntem uygulanacak. Aşama 4\'te tesis başına elektrik tüketiminizi girmeniz yeterli olacak.',
        en: 'Location-based method will be applied. In Stage 4, entering electricity consumption per facility will be sufficient.',
      },
    },
    next: 'D3',
  },
  {
    id: 'D3',
    number: 20,
    stage: 1,
    block: 'D',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'report.boundary_approach',
    text: {
      tr: 'Organizasyon sınırı raporlama yaklaşımı nedir?',
      en: 'Which organizational boundary approach will you use?',
    },
    helper: {
      tr: 'Bu seçim hangi tesislerinizin ve bağlı şirketlerinizin rapora dahil edileceğini belirler. Emin değilseniz "Operasyonel Kontrol" ile devam edin — en yaygın kullanılan yaklaşım budur.',
      en: 'This selection determines which of your facilities and subsidiaries will be included in the report. If unsure, continue with "Operational Control" — it is the most widely used approach.',
    },
    options: [
      {
        value: 'operational_control',
        label: { tr: 'Operasyonel Kontrol (Önerilen)', en: 'Operational Control (Recommended)' },
        description: {
          tr: 'Operasyonel politikaları siz belirleyen tüm tesisler dahil edilir. En yaygın yaklaşım.',
          en: 'All facilities where you set operational policies are included. The most common approach.',
        },
      },
      {
        value: 'financial_control',
        label: { tr: 'Finansal Kontrol', en: 'Financial Control' },
        description: {
          tr: 'Finansal ve operasyonel politikaları yönetme yetkisi olduğunuz birimler dahil edilir. Genellikle konsolide finansal tablolarla örtüşür.',
          en: 'Units where you have authority to manage financial and operating policies are included. Generally aligns with consolidated financial statements.',
        },
      },
      {
        value: 'equity_share',
        label: { tr: 'Hisse Payı', en: 'Equity Share' },
        description: {
          tr: 'Her tesisten hisse oranınız kadar emisyon payı alınır. Ortak girişimlerde kullanılır.',
          en: 'Emissions are allocated proportionally based on your equity share in each facility. Used for joint ventures.',
        },
      },
    ],
    validate: {
      requiredMessage: {
        tr: 'Lütfen organizasyon sınırı yaklaşımını seçin. Emin değilseniz "Operasyonel Kontrol" ile devam edebilirsiniz.',
        en: 'Please select the organizational boundary approach. If unsure, you can continue with "Operational Control".',
      },
    },
    systemMessages: {
      operational_control: {
        tr: 'Operasyonel kontrol: Şirketin operasyonel politikalarını yönetme yetkisine sahip olduğu tüm işletmeler envantere dahil edilir.',
        en: 'Operational control: All operations where the company has authority to introduce and implement its operating policies are included.',
      },
      financial_control: {
        tr: 'Finansal kontrol: Şirketin finansal ve operasyonel politikalarını yönetme yetkisine sahip olduğu işletmeler dahil edilir.',
        en: 'Financial control: Operations where the company has the ability to direct the financial and operating policies are included.',
      },
      equity_share: {
        tr: 'Hisse Payı yaklaşımı seçildi. Bir sonraki aşamada her tesis ve bağlı şirket için hisse oranınızı girmenizi isteyeceğiz. Emisyonlar bu orana göre orantılı hesaplanacak.',
        en: 'Equity Share approach selected. In the next stage, we will ask you to enter your equity share for each facility and subsidiary. Emissions will be calculated proportionally.',
      },
    },
    next: 'D4',
  },
  {
    id: 'D4',
    number: 21,
    stage: 1,
    block: 'D',
    isoRef: 'ISO 14064-1 §6.1',
    type: 'single_select',
    required: true,
    reportField: 'report.scope3_approach',
    text: {
      tr: 'Kapsam 3 kapsamını nasıl belirlemek istersiniz?',
      en: 'How would you like to determine the scope of your Scope 3 reporting?',
    },
    helper: {
      tr: 'Materyalite bazlı yaklaşım şirketinize en önemli kategorileri öne çıkarır — daha hızlı ve verimli. Tam 15 kategori ise kapsamlı ama daha uzun sürer.',
      en: 'The materiality-based approach highlights the most important categories for your company — faster and more efficient. Full 15 categories is comprehensive but takes longer.',
    },
    options: [
      {
        value: 'materiality',
        label: { tr: 'Materyalite Bazlı (Önerilen)', en: 'Materiality-Based (Recommended)' },
        description: {
          tr: 'Sektörünüz ve büyüklüğünüze göre materyel kategoriler öne çıkar, düşük öncelikli kategoriler arka planda kalır. Daha hızlı ve pratik.',
          en: 'Material categories are highlighted based on your sector and size; lower priority categories stay in the background. Faster and more practical.',
        },
      },
      {
        value: 'full',
        label: { tr: 'Tam 15 Kategori', en: 'Full 15 Categories' },
        description: {
          tr: 'Kapsam 3\'ün tüm 15 kategorisi eksiksiz sorulur. Daha kapsamlı rapor, daha uzun sürer.',
          en: 'All 15 Scope 3 categories are asked in full. More comprehensive report, takes longer.',
        },
      },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen Kapsam 3 yaklaşımını seçin.', en: 'Please select the Scope 3 approach.' },
    },
    systemMessages: {
      materiality_no_revenue: {
        tr: 'Ciro bilgisi girilmediği için materyalite hesabı yalnızca sektör (NACE) bazlı yapılacak. Bu yeterli bir başlangıç noktasıdır.',
        en: 'Since no revenue information was entered, materiality calculation will be based on sector (NACE) only. This is a sufficient starting point.',
      },
      full: {
        tr: 'Tüm 15 Kapsam 3 kategorisi sorulacak. Bazı kategoriler için veri olmayabilir — bu normaldir. Veri olmayan kategorileri atlayabilir veya "veri yok" olarak işaretleyebilirsiniz.',
        en: 'All 15 Scope 3 categories will be asked. There may be no data for some categories — this is normal. You can skip or mark them as "no data".',
      },
      complete: {
        tr: 'Harika! Aşama 1 tamamlandı. Şimdi organizasyon sınırınızı belirlemek için Aşama 2\'ye geçiyoruz.',
        en: 'Great! Stage 1 is complete. We are now moving to Stage 2 to define your organizational boundary.',
      },
    },
    next: '2A-0',
  },

  // ── STAGE 2 ─ Organizational Boundary ────────────────────────────────────
  {
    id: '2A-0',
    number: 22,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 2: Organizasyon Sınırı',
      en: 'Stage 2: Organizational Boundary',
    },
    helper: {
      tr: 'Bu aşamada GHG envanterinize dahil edilecek organizasyon birimlerini, tesisleri ve faaliyetleri belirleyeceğiz. Seçtiğiniz konsolidasyon yaklaşımı (operasyonel kontrol, finansal kontrol veya hisse oranı) esas alınacak.',
      en: 'In this stage, we will define the organizational units, facilities, and activities included in your GHG inventory. The consolidation approach you selected (operational control, financial control, or equity share) will be applied.',
    },
    next: '2A-1',
  },
  {
    id: '2A-1',
    number: 23,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: true,
    maxLength: 600,
    reportField: 'org_boundary.included_entities',
    text: {
      tr: 'Envantere dahil edilecek organizasyon birimlerini / tesisleri listeleyin.',
      en: 'List the organizational units / facilities to be included in the inventory.',
    },
    placeholder: {
      tr: 'Örn: Merkez ofis (İstanbul), Fabrika 1 (Kocaeli), Depo (Bursa)',
      en: 'Example: Head office (Istanbul), Factory 1 (Kocaeli), Warehouse (Bursa)',
    },
    helper: {
      tr: 'Her birimi virgül veya yeni satırla ayırabilirsiniz.',
      en: 'You can separate each unit with a comma or new line.',
    },
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir organizasyon birimi veya tesis girin.', en: 'Please enter at least one organizational unit or facility.' },
    },
    next: '2A-2',
  },
  {
    id: '2A-2',
    number: 24,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'org_boundary.leased_facilities',
    text: {
      tr: 'Kiralanmış tesis veya ofisler var mı?',
      en: 'Are there any leased facilities or offices?',
    },
    helper: {
      tr: 'Kiralık tesisler operasyonel kontrol altındaysa genellikle Kapsam 1/2\'ye dahil edilir. Kira sözleşmesi tipi önemlidir.',
      en: 'Leased facilities are generally included in Scope 1/2 if under operational control. The type of lease agreement matters.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — kiralık tesis/ofisim var', en: 'Yes — I have leased facilities/offices' } },
      { value: 'no', label: { tr: 'Hayır — tüm tesisler şirkete ait', en: 'No — all facilities are company-owned' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '2A-3',
  },
  {
    id: '2A-3',
    number: 25,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'org_boundary.joint_ventures',
    text: {
      tr: 'Ortak girişim (joint venture) faaliyetiniz var mı?',
      en: 'Do you have any joint venture operations?',
    },
    helper: {
      tr: 'Ortak girişimler, seçtiğiniz konsolidasyon yaklaşımına göre kısmen veya tamamen envantere dahil edilir.',
      en: 'Joint ventures are included partially or fully in the inventory depending on the consolidation approach selected.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '2A-4',
  },
  {
    id: '2A-4',
    number: 26,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'org_boundary.overseas_operations',
    text: {
      tr: 'Yurt dışı bağlı ortaklıklar veya şubeler bu envantere dahil edilecek mi?',
      en: 'Will overseas subsidiaries or branches be included in this inventory?',
    },
    helper: {
      tr: 'Dahil edilecekse emisyon faktörü hesabı ilgili ülkenin verisiyle yapılacak.',
      en: 'If included, emission factor calculation will use the relevant country\'s data.',
    },
    options: [
      { value: 'yes_all', label: { tr: 'Evet — tüm yurt dışı birimler', en: 'Yes — all overseas units' } },
      { value: 'yes_some', label: { tr: 'Evet — bazı yurt dışı birimler', en: 'Yes — some overseas units' } },
      { value: 'no', label: { tr: 'Hayır — yalnızca yurt içi operasyonlar', en: 'No — domestic operations only' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '2A-5',
  },
  {
    id: '2A-5',
    number: 27,
    stage: 2,
    block: '2A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'org_boundary.any_exclusions',
    text: {
      tr: 'Kapsam dışı bırakılan organizasyon birimi veya tesis var mı?',
      en: 'Are there any organizational units or facilities explicitly excluded from the inventory?',
    },
    helper: {
      tr: 'ISO 14064-1, dışlamalar için gerekçe belgelenmesini gerektirir. Dışlamalar 6. Aşama\'da raporlanacak.',
      en: 'ISO 14064-1 requires justification for exclusions to be documented. Exclusions will be reported in Stage 6.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — kapsam dışı bırakılan birim/tesis var', en: 'Yes — some units/facilities are excluded' } },
      { value: 'no', label: { tr: 'Hayır — tüm birimler dahil', en: 'No — all units are included' } },
    ],
    next: '2B-OC1',
  },
  {
    id: '2B-OC1',
    number: 28,
    stage: 2,
    block: '2B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'org_boundary.control_description',
    text: {
      tr: 'Seçtiğiniz konsolidasyon yaklaşımı kapsamındaki operasyonel kontrolü kısaca açıklayın.',
      en: 'Briefly describe the operational control under your selected consolidation approach.',
    },
    placeholder: {
      tr: 'Örn: Tüm Türkiye tesislerinde operasyonel kararlar merkezi yönetim tarafından alınmaktadır.',
      en: 'Example: All operational decisions for Turkey facilities are made by central management.',
    },
    helper: {
      tr: 'Bu açıklama raporun metodoloji bölümünde kullanılacak. Atlamak isterseniz devam edebilirsiniz.',
      en: 'This description will be used in the methodology section of the report. You may skip if preferred.',
    },
    next: '2B-OC2',
  },
  {
    id: '2B-OC2',
    number: 29,
    stage: 2,
    block: '2B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'org_boundary.shared_control_exists',
    text: {
      tr: 'Kontrolün paylaşıldığı (ortak yönetilen) tesis veya operasyon var mı?',
      en: 'Are there any facilities or operations with shared control (jointly managed)?',
    },
    helper: {
      tr: 'Paylaşımlı kontrol, emisyon hesabı yöntemini etkileyebilir. Evet seçerseniz, sonraki adımda detay girebilirsiniz.',
      en: 'Shared control can affect the emission accounting method. If yes, you can provide details in the next step.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '2B-FC1',
  },
  {
    id: '2B-FC1',
    number: 30,
    stage: 2,
    block: '2B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'org_boundary.financial_consolidation_basis',
    text: {
      tr: 'Finansal konsolidasyon nasıl gerçekleştirilmektedir?',
      en: 'How is financial consolidation carried out?',
    },
    helper: {
      tr: 'Finansal kontrol yaklaşımı kullanıyorsanız bu bilgi gereklidir. Operasyonel kontrol kullanıyorsanız atlayabilirsiniz.',
      en: 'This is required if you are using the financial control approach. You may skip if using operational control.',
    },
    options: [
      { value: 'full_consolidation', label: { tr: 'Tam konsolidasyon (%100 hisse)', en: 'Full consolidation (100% ownership)' } },
      { value: 'proportional', label: { tr: 'Orantılı konsolidasyon', en: 'Proportional consolidation' } },
      { value: 'equity_method', label: { tr: 'Özkaynak yöntemi', en: 'Equity method' } },
      { value: 'not_applicable', label: { tr: 'Uygulanamaz / Atla', en: 'Not applicable / Skip' } },
    ],
    next: '2B-FC2',
  },
  {
    id: '2B-FC2',
    number: 31,
    stage: 2,
    block: '2B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'org_boundary.minority_interests',
    text: {
      tr: 'Azınlık hisseleri (minority interests) envantere dahil ediliyor mu?',
      en: 'Are minority interests included in the inventory?',
    },
    helper: {
      tr: 'Azınlık hisseleri, seçilen konsolidasyon yaklaşımına ve hisse oranına göre dahil veya hariç tutulabilir.',
      en: 'Minority interests can be included or excluded based on the selected consolidation approach and ownership share.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — orantılı olarak dahil', en: 'Yes — included proportionally' } },
      { value: 'no', label: { tr: 'Hayır — dahil edilmiyor', en: 'No — not included' } },
      { value: 'not_applicable', label: { tr: 'Uygulanamaz', en: 'Not applicable' } },
    ],
    next: '2B-EQ1',
  },
  {
    id: '2B-EQ1',
    number: 32,
    stage: 2,
    block: '2B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: false,
    reportField: 'org_boundary.equity_threshold',
    text: {
      tr: 'Hisse oranı yaklaşımı kullanılıyorsa dahil etme eşiği nedir?',
      en: 'If using the equity share approach, what is the inclusion threshold?',
    },
    helper: {
      tr: 'Genellikle %20 veya %50 eşiği kullanılır. Operasyonel/finansal kontrol kullanıyorsanız atla\'ya tıklayın.',
      en: 'Typically a 20% or 50% threshold is used. If using operational/financial control, click skip.',
    },
    options: [
      { value: 'over_50', label: { tr: '%50 üzeri hisse oranı', en: 'Over 50% equity share' } },
      { value: 'over_20', label: { tr: '%20 üzeri hisse oranı', en: 'Over 20% equity share' } },
      { value: 'any', label: { tr: 'Tüm hisseler dahil (sıfır eşik)', en: 'All equity shares included (no threshold)' } },
      { value: 'not_applicable', label: { tr: 'Uygulanamaz / Atla', en: 'Not applicable / Skip' } },
    ],
    next: '2C-1',
  },
  {
    id: '2C-1',
    number: 33,
    stage: 2,
    block: '2C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'multi_select',
    required: true,
    reportField: 'org_boundary.included_functions',
    text: {
      tr: 'Envantere dahil edilen fonksiyonel alanları seçin.',
      en: 'Select the functional areas included in the inventory.',
    },
    helper: {
      tr: 'Birden fazla seçebilirsiniz.',
      en: 'You may select multiple options.',
    },
    options: [
      { value: 'production', label: { tr: 'Üretim / Operasyon', en: 'Production / Operations' } },
      { value: 'logistics', label: { tr: 'Lojistik / Nakliye', en: 'Logistics / Transportation' } },
      { value: 'offices', label: { tr: 'Ofisler / İdari birimler', en: 'Offices / Administrative units' } },
      { value: 'warehouses', label: { tr: 'Depolar', en: 'Warehouses' } },
      { value: 'retail', label: { tr: 'Perakende / Satış noktaları', en: 'Retail / Sales points' } },
      { value: 'rd', label: { tr: 'Ar-Ge tesisleri', en: 'R&D facilities' } },
      { value: 'other', label: { tr: 'Diğer', en: 'Other' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir fonksiyonel alan seçin.', en: 'Please select at least one functional area.' },
    },
    next: '2C-2',
  },
  {
    id: '2C-2',
    number: 34,
    stage: 2,
    block: '2C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'org_boundary.exclusion_reason',
    text: {
      tr: 'Kapsam dışı bırakılan birim veya tesisler varsa gerekçeyi açıklayın.',
      en: 'If any units or facilities are excluded, explain the reason.',
    },
    placeholder: {
      tr: 'Örn: Yurt dışı depo emisyon verisi mevcut olmadığından kapsam dışı bırakıldı.',
      en: 'Example: Overseas warehouse excluded due to unavailability of emission data.',
    },
    helper: {
      tr: 'ISO 14064-1 kapsamında tüm dışlamalar gerekçelendirilmelidir. Dışlama yoksa bu adımı atlayabilirsiniz.',
      en: 'Under ISO 14064-1, all exclusions must be justified. If there are no exclusions, you may skip this step.',
    },
    next: '2C-3',
  },
  {
    id: '2C-3',
    number: 35,
    stage: 2,
    block: '2C',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'info',
    required: false,
    text: {
      tr: 'Organizasyon sınırı tamamlandı',
      en: 'Organizational boundary complete',
    },
    helper: {
      tr: 'Organizasyon sınırı tanımlandı. Şimdi Kapsam 1 (Doğrudan) emisyonlarını girmeye başlayacağız.',
      en: 'The organizational boundary has been defined. We will now begin entering Scope 1 (Direct) emissions.',
    },
    next: '3-GİRİŞ',
  },

  // ── STAGE 3 ─ Scope 1 Emissions ───────────────────────────────────────────
  {
    id: '3-GİRİŞ',
    number: 36,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Kapsam 1 Giriş Ekranı — Doğrudan kontrol ettiğiniz emisyon kaynaklarını keşfedelim.',
      en: 'Scope 1 Introduction — Let\'s identify your direct emission sources.',
    },
    helper: {
      tr: 'Kapsam 1, şirketinizin sahip olduğu veya kontrol ettiği kaynaklardan doğrudan atmosfere salınan emisyonları kapsar. 4 kategori sırayla sorulacak: Sabit Yanma · Hareketli Yanma · Proses Emisyonları · Kaçak Emisyonlar. Önemli: Kiralık araçlar ve kiralık binaların enerji kullanımı bu kapsamın dışındadır — onlar ilerleyen aşamalarda Kapsam 3\'te ele alınacak.',
      en: 'Scope 1 covers direct GHG emissions from sources owned or controlled by your company. 4 categories will be asked in sequence: Stationary Combustion · Mobile Combustion · Process Emissions · Fugitive Emissions. Note: Rented vehicles and energy use of rented buildings are excluded — they will be covered in Scope 3.',
    },
    next: '3A-0',
  },
  {
    id: '3A-0',
    number: 37,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.stationary_combustion.exists',
    text: {
      tr: 'Sabit bir noktada yakıt yakan herhangi bir sisteminiz var mı?',
      en: 'Do you have any stationary combustion equipment?',
    },
    helper: {
      tr: 'Kazan, fırın, jeneratör, ısıtma sistemi gibi sabit bir noktada yakıt yakan her ekipman bu kapsamda. Hareketli araçlar bir sonraki bölümde sorulacak.',
      en: 'Any equipment that burns fuel at a fixed point — boilers, furnaces, generators, heating systems. Mobile vehicles will be asked in the next section.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      yes: '3A-1',
      no: '3B-0',
    },
    next: '3B-0', // safe fallback for skip-loop (conditionalShow hidden path)
    systemMessages: {
      yes: {
        tr: 'Sabit yanma ekipmanlarınızı katalogdan seçeceğiz. Her ekipman için yakıt türü ve tüketim miktarını soracağız.',
        en: 'We will select your stationary combustion equipment from a catalog. We will ask for fuel type and consumption amount for each equipment.',
      },
    },
  },
  {
    id: '3A-1',
    number: 38,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'multi_select',
    subtype: 'searchable_catalog',
    required: true,
    reportField: 'scope1.stationary_combustion.equipment_list',
    loopType: 'per_equipment',
    loopNext: '3A-2',
    text: {
      tr: 'Sabit yanma ekipmanlarınız hangileri?',
      en: 'Which stationary combustion equipment do you have?',
    },
    placeholder: {
      tr: 'Ekipman adı veya türü arayın...',
      en: 'Search equipment name or type...',
    },
    helper: {
      tr: 'Listede olmayan bir ekipmanınız varsa "Diğer" seçeneğini kullanın. Her seçilen ekipman için ayrı bir veri girişi yapacaksınız.',
      en: 'If you have equipment not in the list, use the "Other" option. You will enter separate data for each selected equipment.',
    },
    options: [
      { value: 'EQ-3A-01', label: { tr: 'EQ-3A-01 — Sıcak su kazanı', en: 'EQ-3A-01 — Hot water boiler' }, defaultFuels: ['Doğalgaz', 'Fuel oil', 'LPG'] },
      { value: 'EQ-3A-02', label: { tr: 'EQ-3A-02 — Buhar kazanı', en: 'EQ-3A-02 — Steam boiler' }, defaultFuels: ['Doğalgaz', 'Fuel oil', 'Kömür'] },
      { value: 'EQ-3A-03', label: { tr: 'EQ-3A-03 — Kızgın yağ kazanı', en: 'EQ-3A-03 — Thermal oil boiler' }, defaultFuels: ['Doğalgaz', 'Fuel oil'] },
      { value: 'EQ-3A-04', label: { tr: 'EQ-3A-04 — Kombi / duvar tipi kazan', en: 'EQ-3A-04 — Combi / wall-mounted boiler' }, defaultFuels: ['Doğalgaz', 'LPG'] },
      { value: 'EQ-3A-05', label: { tr: 'EQ-3A-05 — Kojenerasyon (CHP) sistemi', en: 'EQ-3A-05 — Cogeneration (CHP) system' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-06', label: { tr: 'EQ-3A-06 — Isı pompası (fosil destekli hibrit)', en: 'EQ-3A-06 — Heat pump (fossil-hybrid)' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-07', label: { tr: 'EQ-3A-07 — Dizel jeneratör', en: 'EQ-3A-07 — Diesel generator' }, defaultFuels: ['Motorin'] },
      { value: 'EQ-3A-08', label: { tr: 'EQ-3A-08 — Doğalgaz jeneratörü', en: 'EQ-3A-08 — Natural gas generator' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-09', label: { tr: 'EQ-3A-09 — Seyyar jeneratör', en: 'EQ-3A-09 — Portable generator' }, defaultFuels: ['Motorin', 'Benzin'] },
      { value: 'EQ-3A-10', label: { tr: 'EQ-3A-10 — Endüstriyel fırın (genel)', en: 'EQ-3A-10 — Industrial furnace (general)' }, defaultFuels: ['Doğalgaz', 'Fuel oil'] },
      { value: 'EQ-3A-11', label: { tr: 'EQ-3A-11 — Tünel / döner fırın', en: 'EQ-3A-11 — Tunnel / rotary kiln' }, defaultFuels: ['Doğalgaz', 'Kömür'] },
      { value: 'EQ-3A-12', label: { tr: 'EQ-3A-12 — Kurutma fırını / spray dryer', en: 'EQ-3A-12 — Drying oven / spray dryer' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-13', label: { tr: 'EQ-3A-13 — Ergitme / döküm fırını', en: 'EQ-3A-13 — Melting / casting furnace' }, defaultFuels: ['Doğalgaz', 'Fuel oil'] },
      { value: 'EQ-3A-14', label: { tr: 'EQ-3A-14 — Isıl işlem fırını', en: 'EQ-3A-14 — Heat treatment furnace' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-15', label: { tr: 'EQ-3A-15 — Flare (yakma bacası)', en: 'EQ-3A-15 — Flare stack' }, defaultFuels: ['Doğalgaz', 'Diğer fosil yakıt'] },
      { value: 'EQ-3A-16', label: { tr: 'EQ-3A-16 — Rejeneratif termal oksidatör (RTO)', en: 'EQ-3A-16 — Regenerative thermal oxidizer (RTO)' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-17', label: { tr: 'EQ-3A-17 — Pişirme / sterilizasyon fırını', en: 'EQ-3A-17 — Cooking / sterilization oven' }, defaultFuels: ['Doğalgaz', 'LPG'] },
      { value: 'EQ-3A-18', label: { tr: 'EQ-3A-18 — Buhar kazanı (tekstil/boya)', en: 'EQ-3A-18 — Steam boiler (textile/dyeing)' }, defaultFuels: ['Doğalgaz', 'Fuel oil'] },
      { value: 'EQ-3A-19', label: { tr: 'EQ-3A-19 — Endüstriyel çamaşırhane kazanı', en: 'EQ-3A-19 — Industrial laundry boiler' }, defaultFuels: ['Doğalgaz'] },
      { value: 'EQ-3A-20', label: { tr: 'EQ-3A-20 — Endüstriyel mutfak ocağı', en: 'EQ-3A-20 — Industrial kitchen stove' }, defaultFuels: ['Doğalgaz', 'LPG'] },
      { value: 'EQ-3A-21', label: { tr: 'EQ-3A-21 — Sıcak hava jeneratörü', en: 'EQ-3A-21 — Hot air generator' }, defaultFuels: ['Doğalgaz', 'Fuel oil'] },
      { value: 'EQ-3A-22', label: { tr: 'EQ-3A-22 — Radyan ısıtıcı (yakıtlı)', en: 'EQ-3A-22 — Radiant heater (fuel-fired)' }, defaultFuels: ['Doğalgaz', 'LPG'] },
      { value: 'EQ-3A-23', label: { tr: 'EQ-3A-23 — Atık yakma fırını', en: 'EQ-3A-23 — Waste incineration furnace' }, defaultFuels: ['Diğer fosil yakıt'] },
      { value: 'EQ-3A-24', label: { tr: 'EQ-3A-24 — Biyokütle / pellet kazanı', en: 'EQ-3A-24 — Biomass / pellet boiler' }, defaultFuels: ['Biyokütle / Odun pellet'] },
      { value: 'EQ-3A-25', label: { tr: 'EQ-3A-25 — Yakıtlı forklift ısıtıcısı', en: 'EQ-3A-25 — Fuel-fired forklift heater' }, defaultFuels: ['LPG', 'Doğalgaz'] },
      { value: 'EQ-3A-99', label: { tr: 'EQ-3A-99 — Diğer (listede yok)', en: 'EQ-3A-99 — Other (not in list)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir ekipman seçin.', en: 'Please select at least one equipment item.' },
    },
    systemMessages: {
      EQ_3A_99: {
        tr: 'Ekipman adını ve yakıt türünü giriniz. Bu ekipman incelemeye alınacak ve onaylanırsa standart listeye eklenecek.',
        en: 'Please enter the equipment name and fuel type. This equipment will be reviewed and if approved, added to the standard list.',
      },
    },
    next: '3A-1a',
  },
  {
    id: '3A-1a',
    number: 39,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'single_line',
    required: false,
    maxLength: 150,
    conditionalShow: { questionId: '3A-1', includesValue: 'EQ-3A-99' },
    reportField: 'scope1.stationary_combustion.other_equipment_name',
    text: {
      tr: '[EQ-3A-99] Ekipman adı ve yakıt türü nedir?',
      en: '[EQ-3A-99] What is the equipment name and fuel type?',
    },
    placeholder: {
      tr: 'Ekipman adı: Örn: Katalitik yakıcı | Yakıt: Doğalgaz',
      en: 'Equipment name: e.g. Catalytic combustor | Fuel: Natural gas',
    },
    helper: {
      tr: 'Ekipmanı mümkün olduğunca spesifik tanımlayın. Bu bilgi sistem yöneticileri tarafından incelenecek. Bu aşamada DEFRA varsayılan EF uygulanacak.',
      en: 'Describe the equipment as specifically as possible. This information will be reviewed by administrators. DEFRA default EF will be applied at this stage.',
    },
    next: '3A-2',
  },
  {
    id: '3A-2',
    number: 40,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3A-1',
    loopNext: '3A-3',
    required: true,
    reportField: 'scope1.stationary_combustion.equipment_details',
    text: {
      tr: '[Ekipman adı] — Kaç adet ve hangi tesiste?',
      en: '[Equipment name] — How many units and at which site?',
    },
    placeholder: {
      tr: 'Adet: 2 | Tesis: İstanbul Ofisi',
      en: 'Count: 2 | Site: Istanbul Office',
    },
    helper: {
      tr: 'Aynı türde birden fazla ekipmanınız varsa adedi girin. Farklı tesislerdeyse her tesis için ayrı kayıt oluşturabilirsiniz.',
      en: 'If you have multiple units of the same type, enter the count. If at different sites, you can create separate records for each site.',
    },
    validate: {
      requiredMessage: { tr: 'Adet ve tesis zorunludur.', en: 'Count and site are required.' },
    },
    next: '3A-3',
  },
  {
    id: '3A-3',
    number: 41,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3A-1',
    loopNext: '3A-4',
    required: false,
    reportField: 'scope1.stationary_combustion.equipment_capacity',
    text: {
      tr: '[Ekipman adı] — Teknik kapasite nedir?',
      en: '[Equipment name] — What is the technical capacity?',
    },
    placeholder: { tr: 'Örn: 500 kW', en: 'Example: 500 kW' },
    helper: {
      tr: 'Nameplate (etiket) kapasitesi veya teknik belgeden alınan değer. Girilmesi azaltım analizi için değerli olacak. Bilmiyorsanız atlayabilirsiniz.',
      en: 'Nameplate capacity or value from technical documentation. Entering this enables reduction analysis. You may skip if unknown.',
    },
    units: ['kW', 'kcal/h', 'kg buhar/h', 'MJ/h', 'hp'],
    next: '3A-4',
  },
  {
    id: '3A-4',
    number: 42,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'multi_select',
    loopSource: '3A-1',
    loopNext: '3A-5',
    required: true,
    reportField: 'scope1.stationary_combustion.fuel_types',
    text: {
      tr: '[Ekipman adı] — Hangi yakıt türlerini kullanıyor?',
      en: '[Equipment name] — What fuel types does this equipment use?',
    },
    helper: {
      tr: 'Ekipmanınızın katalog bilgisinden olası yakıtlar önerildi. Birden fazla yakıt kullanıyorsa hepsini seçin — her biri için ayrı tüketim girişi yapacaksınız.',
      en: 'Possible fuels were suggested based on the equipment catalog. If using multiple fuels, select all — you will enter separate consumption for each.',
    },
    options: [
      { value: 'natural_gas', label: { tr: 'Doğalgaz', en: 'Natural gas' } },
      { value: 'fuel_oil', label: { tr: 'Fuel oil (No.2, No.6)', en: 'Fuel oil (No.2, No.6)' } },
      { value: 'diesel', label: { tr: 'Motorin / Dizel', en: 'Diesel' } },
      { value: 'lpg', label: { tr: 'LPG', en: 'LPG' } },
      { value: 'coal', label: { tr: 'Kömür', en: 'Coal' } },
      { value: 'biomass', label: { tr: 'Biyokütle / Odun pellet', en: 'Biomass / Wood pellet' } },
      { value: 'other_fossil', label: { tr: 'Diğer fosil yakıt', en: 'Other fossil fuel' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir yakıt türü seçin.', en: 'Please select at least one fuel type.' },
    },
    systemMessages: {
      biomass: {
        tr: 'Biyokütle CO₂ emisyonları ISO 14064-1 kapsamında Kapsam 1\'de raporlanır, ancak fosil yakıt emisyonlarından ayrı gösterilir.',
        en: 'Biomass CO₂ emissions are reported in Scope 1 under ISO 14064-1, but shown separately from fossil fuel emissions.',
      },
    },
    next: '3A-5',
  },
  {
    id: '3A-5',
    number: 43,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'fuel_loop',
    loopSource: '3A-4',
    loopNext: '3A-6',
    required: true,
    reportField: 'scope1.stationary_combustion.consumption',
    text: {
      tr: '[Ekipman] — [Yakıt türü] yıllık tüketim miktarı nedir?',
      en: '[Equipment] — [Fuel type] annual consumption quantity?',
    },
    placeholder: { tr: 'Örn: 15.000 m³', en: 'Example: 15,000 m³' },
    helper: {
      tr: 'Yıllık toplam tüketim. Fatura verisi en doğru kaynaktır. Bilmiyorsanız tahmini değer girebilirsiniz — bir sonraki soruda nasıl elde ettiğinizi soracağız.',
      en: 'Annual total consumption. Invoice data is the most accurate source. If unknown, you can enter an estimated value — the next question will ask how you obtained it.',
    },
    units: {
      natural_gas: ['m³', 'kWh'],
      fuel_oil: ['litre', 'kg'],
      diesel: ['litre'],
      lpg: ['kg', 'litre'],
      coal: ['ton', 'kg'],
      biomass: ['ton', 'kg'],
      other_fossil: ['litre', 'kg', 'ton'],
    },
    validate: {
      requiredMessage: { tr: 'Lütfen tüketim miktarını girin.', en: 'Please enter the consumption amount.' },
    },
    next: '3A-6',
  },
  {
    id: '3A-6',
    number: 44,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3A-4',
    loopNext: '3A-EF',
    required: true,
    reportField: 'scope1.stationary_combustion.data_source',
    text: {
      tr: '[Yakıt türü] tüketim verisi nasıl elde edildi?',
      en: '[Fuel type] — How was this consumption data obtained?',
    },
    helper: {
      tr: 'Veri kaynağı raporunuzda belgelenir. Fatura verisi en güvenilir kaynaktır — mümkünse bunu kullanın.',
      en: 'The data source is documented in your report. Invoice data is the most reliable source — use it if available.',
    },
    options: [
      { value: 'invoice_meter', label: { tr: 'Fatura veya sayaç ölçümü — en doğru yöntem', en: 'Invoice or meter reading — most accurate' }, dataQuality: 'high' },
      { value: 'engineering_estimate', label: { tr: 'Mühendislik hesabı veya tahmin', en: 'Engineering calculation or estimate' }, dataQuality: 'medium' },
      { value: 'sector_average', label: { tr: 'Sektör ortalaması kullanıldı', en: 'Sector average used' }, dataQuality: 'low' },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen veri kaynağını seçin.', en: 'Please select the data source.' },
    },
    systemMessages: {
      sector_average: {
        tr: 'Sektör ortalaması kullanımı veri kalitesini düşürür. Fatura veya sayaç verisi mevcutsa o kaynağı kullanmanızı öneririz.',
        en: 'Using sector averages reduces data quality. If invoice or meter data is available, we recommend using that source.',
      },
    },
    nextByValue: {
      invoice_meter: '3A-EF',
      engineering_estimate: '3A-6a',
      sector_average: '3A-6a',
    },
  },
  {
    id: '3A-6a',
    number: 45,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'multi_line',
    required: true,
    maxLength: 300,
    conditionalShow: { questionId: '3A-6', inValues: ['engineering_estimate', 'sector_average'] },
    reportField: 'scope1.stationary_combustion.estimation_method',
    text: {
      tr: '[Tahmin / Sektör ortalaması ise] Tahmin yöntemi ve kaynağı nedir?',
      en: '[If estimated] What estimation method and source was used?',
    },
    placeholder: {
      tr: 'Örn: Makine teknik şartnamesinden günlük çalışma saati × nominal tüketim değeri hesaplandı.',
      en: 'Example: Daily operating hours × nominal consumption value calculated from machine technical specifications.',
    },
    helper: {
      tr: 'Bu açıklama raporunuzda "Veri Kalitesi Notları" bölümünde aynen yayınlanacak. Ne kadar açık yazarsanız rapor o kadar güvenilir olur.',
      en: 'This description will be published verbatim in the "Data Quality Notes" section of your report. The clearer you write, the more reliable the report.',
    },
    validate: {
      requiredMessage: { tr: 'Tahmin yöntemi zorunludur. Kısa bir açıklama yeterli.', en: 'Estimation method is required. A short explanation is sufficient.' },
    },
    next: '3A-EF',
  },
  {
    id: '3A-EF',
    number: 46,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3A-4',
    loopNext: '3B-0',
    required: true,
    reportField: 'scope1.stationary_combustion.supplier_ef',
    text: {
      tr: '[Yakıt türü] için tedarikçinin emisyon faktörü belgesi var mı?',
      en: '[Fuel type] — Does your supplier have an emission factor document?',
    },
    helper: {
      tr: 'Doğalgaz tedarikçinizin ısıl değer belgesi, yakıt analiz raporu veya çevre beyanı varsa bu Seviye 1 (en doğru) veri sayılır. Yoksa sistem size uygun bir emisyon faktörü önerecek.',
      en: 'If your natural gas supplier has a calorific value document, fuel analysis report or environmental declaration, this counts as Level 1 (most accurate) data. Otherwise, the system will suggest an appropriate emission factor.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — tedarikçi belgesi / ısıl değer beyanı var', en: 'Yes — supplier document / calorific value declaration available' }, efLevel: 1 },
      { value: 'no', label: { tr: 'Hayır — belge yok', en: 'No — no document available' }, efLevel: 2 },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      no_TR_natural_gas: {
        tr: 'Önerilen emisyon faktörü: DEFRA 2023 doğalgaz EF — 0.2023 kg CO₂e/kWh (TTW). Kaynak: DEFRA 2023. Kullanmak ister misiniz?',
        en: 'Suggested emission factor: DEFRA 2023 natural gas EF — 0.2023 kg CO₂e/kWh (TTW). Source: DEFRA 2023. Would you like to use this?',
      },
    },
    next: '3B-0',
  },

  {
    id: '3B-0',
    number: 47,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.mobile_combustion.exists',
    text: {
      tr: 'Şirketinizin sahip olduğu veya kontrol ettiği araç, iş makinesi ya da taşıt var mı?',
      en: 'Does your company own or control any vehicles, machinery or vessels?',
    },
    helper: {
      tr: 'Şirkete ait veya finansal kiralamadaki (leasing) araçlar bu kapsamda. Kısa dönem operasyonel kiralık araçlar bu kapsama girmez — onlar Kapsam 3\'te ele alınır.',
      en: 'Company-owned or financial lease (leasing) vehicles are in scope. Short-term operational rental vehicles are not — they are covered in Scope 3.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      yes: '3B-1',
      no: '3C-0',
    },
    systemMessages: {
      yes: {
        tr: 'DEFRA emisyon faktörü metodolojisine göre araç tipi, yakıt türü, büyüklük ve kullanım verisi soracağız. Her araç türü için ayrı hesaplama yapılacak.',
        en: 'We will ask for vehicle type, fuel type, size and usage data per DEFRA emission factor methodology. A separate calculation will be made for each vehicle type.',
      },
    },
  },
  {
    id: '3B-1',
    number: 48,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'multi_select',
    subtype: 'searchable_catalog',
    required: true,
    reportField: 'scope1.mobile_combustion.vehicle_list',
    loopType: 'per_vehicle',
    loopNext: '3B-2',
    text: {
      tr: 'Araç tipleriniz hangileri?',
      en: 'What types of vehicles does your company have?',
    },
    placeholder: {
      tr: 'Araç tipi veya ismi arayın...',
      en: 'Search vehicle type or name...',
    },
    helper: {
      tr: 'Her araç tipi için DEFRA metodolojisine göre farklı emisyon faktörü uygulanacak. Aynı tipte birden fazla aracınız varsa adedi sonraki adımda gireceksiniz.',
      en: 'A different emission factor will be applied per DEFRA methodology for each vehicle type. If you have multiple vehicles of the same type, you will enter the count in the next step.',
    },
    options: [
      { value: 'EQ-3B-01', label: { tr: 'EQ-3B-01 — Binek araç', en: 'EQ-3B-01 — Passenger car' } },
      { value: 'EQ-3B-02', label: { tr: 'EQ-3B-02 — Minibüs / van (≤9 kişi)', en: 'EQ-3B-02 — Minibus / van (≤9 persons)' } },
      { value: 'EQ-3B-03', label: { tr: 'EQ-3B-03 — Otobüs / servis aracı', en: 'EQ-3B-03 — Bus / shuttle vehicle' } },
      { value: 'EQ-3B-04', label: { tr: 'EQ-3B-04 — Motosiklet', en: 'EQ-3B-04 — Motorcycle' } },
      { value: 'EQ-3B-05', label: { tr: 'EQ-3B-05 — Hafif ticari araç / kamyonet (≤3.5t)', en: 'EQ-3B-05 — Light commercial vehicle / pickup (≤3.5t)' } },
      { value: 'EQ-3B-06', label: { tr: 'EQ-3B-06 — Orta ticari araç (3.5–7.5t)', en: 'EQ-3B-06 — Medium commercial vehicle (3.5–7.5t)' } },
      { value: 'EQ-3B-07', label: { tr: 'EQ-3B-07 — Ağır ticari araç küçük (7.5–17t)', en: 'EQ-3B-07 — Heavy commercial vehicle small (7.5–17t)' } },
      { value: 'EQ-3B-08', label: { tr: 'EQ-3B-08 — Ağır ticari araç orta (17–25t)', en: 'EQ-3B-08 — Heavy commercial vehicle medium (17–25t)' } },
      { value: 'EQ-3B-09', label: { tr: 'EQ-3B-09 — Ağır ticari araç büyük (25–33t)', en: 'EQ-3B-09 — Heavy commercial vehicle large (25–33t)' } },
      { value: 'EQ-3B-10', label: { tr: 'EQ-3B-10 — TIR / artic tır (33t+)', en: 'EQ-3B-10 — Articulated truck (33t+)' } },
      { value: 'EQ-3B-11', label: { tr: 'EQ-3B-11 — Forklift (içten yanmalı)', en: 'EQ-3B-11 — Forklift (internal combustion)' } },
      { value: 'EQ-3B-12', label: { tr: 'EQ-3B-12 — Kepçe / ekskavatör', en: 'EQ-3B-12 — Excavator / backhoe' } },
      { value: 'EQ-3B-13', label: { tr: 'EQ-3B-13 — Buldozer / greyder', en: 'EQ-3B-13 — Bulldozer / grader' } },
      { value: 'EQ-3B-14', label: { tr: 'EQ-3B-14 — Vinç (mobil)', en: 'EQ-3B-14 — Mobile crane' } },
      { value: 'EQ-3B-15', label: { tr: 'EQ-3B-15 — Tarım traktörü / biçerdöver', en: 'EQ-3B-15 — Agricultural tractor / harvester' } },
      { value: 'EQ-3B-16', label: { tr: 'EQ-3B-16 — Beton pompası / mikseri', en: 'EQ-3B-16 — Concrete pump / mixer' } },
      { value: 'EQ-3B-17', label: { tr: 'EQ-3B-17 — Kıyı / iç hat gemisi', en: 'EQ-3B-17 — Coastal / inland waterway vessel' } },
      { value: 'EQ-3B-18', label: { tr: 'EQ-3B-18 — Feribot / Ro-Ro', en: 'EQ-3B-18 — Ferry / Ro-Ro' } },
      { value: 'EQ-3B-19', label: { tr: 'EQ-3B-19 — Küçük tekne / hizmet botu', en: 'EQ-3B-19 — Small boat / service vessel' } },
      { value: 'EQ-3B-20', label: { tr: 'EQ-3B-20 — Kurumsal uçak (jet)', en: 'EQ-3B-20 — Corporate aircraft (jet)' } },
      { value: 'EQ-3B-21', label: { tr: 'EQ-3B-21 — Helikopter', en: 'EQ-3B-21 — Helicopter' } },
      { value: 'EQ-3B-22', label: { tr: 'EQ-3B-22 — Dizel lokomotif', en: 'EQ-3B-22 — Diesel locomotive' } },
      { value: 'EQ-3B-23', label: { tr: 'EQ-3B-23 — Fabrika içi ray aracı', en: 'EQ-3B-23 — Factory rail vehicle' } },
      { value: 'EQ-3B-99', label: { tr: 'EQ-3B-99 — Diğer (listede yok)', en: 'EQ-3B-99 — Other (not in list)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir araç tipi seçin.', en: 'Please select at least one vehicle type.' },
    },
    systemMessages: {
      EQ_3B_20_21: {
        tr: 'Şirkete ait hava taşıtı Kapsam 1\'de raporlanır. Çalışanların iş amaçlı charter dışı uçuşları ise Kapsam 3 Kategori 6\'ya girer. Bu iki kategorinin ayrı tutulması önemli.',
        en: 'Company-owned aircraft is reported in Scope 1. Employee non-charter business flights fall under Scope 3 Category 6. It is important to keep these two categories separate.',
      },
    },
    next: '3B-2',
  },
  {
    id: '3B-2',
    number: 49,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3B-1',
    loopNext: '3B-3',
    required: true,
    reportField: 'scope1.mobile_combustion.ownership',
    text: {
      tr: '[Araç tipi] — Mülkiyet durumu nedir?',
      en: '[Vehicle type] — What is the ownership status?',
    },
    helper: {
      tr: 'Bu soru Kapsam 1 ile Kapsam 3 arasındaki sınırı belirler. Doğru yanıtlamak emisyonların doğru kapsama atanması için kritik.',
      en: 'This question defines the boundary between Scope 1 and Scope 3. Answering correctly is critical for assigning emissions to the right scope.',
    },
    options: [
      { value: 'owned', label: { tr: 'Şirkete ait — ruhsat şirkette → Kapsam 1', en: 'Company-owned — registered to company → Scope 1' }, scope: 1 },
      { value: 'financial_lease', label: { tr: 'Finansal kiralama / Uzun dönem leasing — bilançoda varlık kayıtlı → Kapsam 1', en: 'Financial lease / Long-term leasing — asset on balance sheet → Scope 1' }, scope: 1 },
      { value: 'operational_lease', label: { tr: 'Operasyonel kiralama — günlük / haftalık / aylık kiralık → Kapsam 3 (Kategori 13)', en: 'Operational lease — daily / weekly / monthly rental → Scope 3 (Category 13)' }, scope: 3 },
      { value: 'employee_owned', label: { tr: 'Çalışana ait — şirket yakıt veya km ödemesi yapıyor → Kapsam 3 (Kategori 6)', en: 'Employee-owned — company pays fuel or mileage → Scope 3 (Category 6)' }, scope: 3 },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen mülkiyet durumunu seçin.', en: 'Please select ownership status.' },
    },
    systemMessages: {
      operational_lease: {
        tr: 'Operasyonel kiralık araçlar Kapsam 3 Kategori 13\'e girer. Bu araç Kapsam 1\'e dahil edilmeyecek. Kapsam 3 bölümünde tekrar sorulacak.',
        en: 'Operational lease vehicles fall under Scope 3 Category 13. This vehicle will not be included in Scope 1. It will be asked again in Scope 3.',
      },
      employee_owned: {
        tr: 'Çalışana ait araçlar için yapılan yakıt veya km ödemesi Kapsam 3 Kategori 6\'ya girer. Bu araç Kapsam 1\'e dahil edilmeyecek.',
        en: 'Fuel or mileage payments for employee-owned vehicles fall under Scope 3 Category 6. This vehicle will not be included in Scope 1.',
      },
    },
    next: '3B-3',
  },
  {
    id: '3B-3',
    number: 50,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3B-1',
    loopNext: '3B-4',
    required: true,
    reportField: 'scope1.mobile_combustion.vehicle_details',
    text: {
      tr: '[Araç tipi] — Adet, tesis ve büyüklük/tonaj bandı nedir?',
      en: '[Vehicle type] — How many units, at which site, and what size/tonnage band?',
    },
    placeholder: {
      tr: 'Adet: 5 | Tesis: İstanbul | Boyut: Orta (1.4–2.0L)',
      en: 'Count: 5 | Site: Istanbul | Size: Medium (1.4–2.0L)',
    },
    helper: {
      tr: 'Büyüklük/tonaj DEFRA emisyon faktörü tablosunda doğru sütunu seçmek için gerekli. Binek araçlar için motor hacmi, ticari araçlar için GVW (brüt araç ağırlığı) kullanılır.',
      en: 'Size/tonnage is needed to select the correct column in the DEFRA emission factor table. Engine displacement for passenger cars, GVW (Gross Vehicle Weight) for commercial vehicles.',
    },
    validate: {
      requiredMessage: { tr: 'Adet ve tesis zorunludur.', en: 'Count and site are required.' },
    },
    next: '3B-4',
  },
  {
    id: '3B-4',
    number: 51,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3B-1',
    loopNext: '3B-5',
    required: false,
    reportField: 'scope1.mobile_combustion.euro_standard',
    text: {
      tr: '[Araç tipi] — Model yılı veya Euro emisyon normu nedir?',
      en: '[Vehicle type] — What is the model year or Euro emission standard?',
    },
    placeholder: {
      tr: 'Model yılı: 2019 veya Euro normu seçin',
      en: 'Model year: 2019 or select Euro standard',
    },
    helper: {
      tr: 'Euro normu bazı EF tablolarında kullanılır. Bilmiyorsanız atlayın — sistem en güncel Euro normunu varsayılan olarak uygular.',
      en: 'Euro standard is used in some EF tables. If unknown, skip — the system will apply the latest Euro standard as default.',
    },
    options: [
      { value: 'euro_3', label: { tr: 'Euro 3', en: 'Euro 3' } },
      { value: 'euro_4', label: { tr: 'Euro 4', en: 'Euro 4' } },
      { value: 'euro_5', label: { tr: 'Euro 5', en: 'Euro 5' } },
      { value: 'euro_6d', label: { tr: 'Euro 6d', en: 'Euro 6d' } },
      { value: 'unknown', label: { tr: 'Bilinmiyor — en güncel uygulanacak', en: 'Unknown — latest will be applied' } },
    ],
    next: '3B-5',
  },
  {
    id: '3B-5',
    number: 52,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3B-1',
    loopNext: '3B-6',
    required: true,
    reportField: 'scope1.mobile_combustion.fuel_type',
    text: {
      tr: '[Araç tipi] — Yakıt tipi nedir?',
      en: '[Vehicle type] — What fuel type does this vehicle use?',
    },
    helper: {
      tr: 'Araç tipinize göre uygun yakıt seçenekleri gösterildi. Elektrikli araç seçerseniz şarj tüketimi Kapsam 2\'ye aktarılır.',
      en: 'Suitable fuel options are shown for your vehicle type. If you select electric vehicle, charge consumption will be transferred to Scope 2.',
    },
    options: [
      { value: 'diesel', label: { tr: 'Motorin / Dizel', en: 'Diesel' } },
      { value: 'petrol', label: { tr: 'Benzin', en: 'Petrol' } },
      { value: 'lpg_cng', label: { tr: 'LPG / Doğalgaz (CNG/LNG)', en: 'LPG / Natural gas (CNG/LNG)' } },
      { value: 'electric', label: { tr: 'Elektrik → Kapsam 2\'ye aktarılır', en: 'Electric → Transferred to Scope 2' }, scope: 2 },
      { value: 'hybrid', label: { tr: 'Hibrit (fosil + elektrik) → ikisi ayrı hesaplanır', en: 'Hybrid (fossil + electric) → calculated separately' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen yakıt tipini seçin.', en: 'Please select fuel type.' },
    },
    systemMessages: {
      electric: {
        tr: 'Elektrikli araçların şarj tüketimi Kapsam 2\'de raporlanır. Aşama 4\'te bu aracın yıllık şarj tüketimini (kWh) girmenizi hatırlatacağız.',
        en: 'Electric vehicle charge consumption is reported in Scope 2. We will remind you to enter this vehicle\'s annual charge consumption (kWh) in Stage 4.',
      },
    },
    next: '3B-6',
  },
  {
    id: '3B-6',
    number: 53,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3B-1',
    loopNext: '3B-EF',
    required: true,
    reportField: 'scope1.mobile_combustion.activity_data',
    text: {
      tr: '[Araç tipi] — Aktivite verisi: yakıt tüketimi mi, mesafe mi?',
      en: '[Vehicle type] — Activity data: fuel consumption or distance?',
    },
    placeholder: {
      tr: 'Yakıt: 12.000 litre VEYA Mesafe: 80.000 km',
      en: 'Fuel: 12,000 litres OR Distance: 80,000 km',
    },
    helper: {
      tr: 'Yakıt faturası varsa onu kullanın — daha doğru sonuç verir (Seviye 1). Yalnızca km bilginiz varsa onu da kabul ederiz (Seviye 2 — sistem ortalama tüketim faktörü uygular).',
      en: 'If you have fuel invoices, use them — gives more accurate results (Level 1). If you only have km data, that is also accepted (Level 2 — system applies average consumption factor).',
    },
    options: [
      { value: 'fuel_litres', label: { tr: 'Yıllık yakıt tüketimi (litre) — Seviye 1 — tercih edilen', en: 'Annual fuel consumption (litres) — Level 1 — preferred' }, dataQuality: 'high' },
      { value: 'annual_km', label: { tr: 'Yıllık km — Seviye 2 — sistem ortalama tüketim uygular', en: 'Annual km — Level 2 — system applies average consumption' }, dataQuality: 'medium' },
      { value: 'tonne_km', label: { tr: 'Yük araçları: Ton-km — Seviye 1', en: 'Heavy goods vehicles: Tonne-km — Level 1' }, dataQuality: 'high' },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen aktivite verisi türünü seçin.', en: 'Please select the activity data type.' },
    },
    systemMessages: {
      annual_km: {
        tr: 'Mesafe bazlı hesaplama tahmini bir sonuç üretir — yakıt faturası verisine göre %10–30 sapma olabilir. Raporunuzda "Mesafe bazlı — Seviye 2 tahmini" olarak işaretlenecek.',
        en: 'Distance-based calculation produces an estimated result — may deviate 10–30% from fuel invoice data. Will be marked as "Distance-based — Level 2 estimate" in your report.',
      },
    },
    next: '3B-EF',
  },
  {
    id: '3B-EF',
    number: 54,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3B-1',
    loopNext: '3C-0',
    required: true,
    reportField: 'scope1.mobile_combustion.supplier_ef',
    text: {
      tr: '[Araç tipi — Yakıt türü] için tedarikçi veya üretici EF belgesi var mı?',
      en: '[Vehicle type — Fuel type] — Is there a supplier or manufacturer EF document?',
    },
    helper: {
      tr: 'Araç üreticisinin LCA belgesi veya yakıt tedarikçisinin emisyon beyanı varsa bu Seviye 1 veri sayılır. Yoksa sistem DEFRA tablosundan araç tipi + yakıt + boyut kombinasyonu için değer önerecek.',
      en: 'If the vehicle manufacturer has an LCA document or the fuel supplier has an emission declaration, this counts as Level 1 data. Otherwise, the system will suggest a value from DEFRA tables for the vehicle type + fuel + size combination.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — üretici LCA veya yakıt tedarikçi belgesi var', en: 'Yes — manufacturer LCA or fuel supplier document available' }, efLevel: 1 },
      { value: 'no', label: { tr: 'Hayır — belge yok', en: 'No — no document available' }, efLevel: 2 },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3C-0',
  },

  {
    id: '3C-0',
    number: 55,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: false,
    conditionalShow: { questionId: 'B1', inValues: ['NACE_A', 'NACE_B', 'NACE_C', 'NACE_D', 'NACE_E', 'NACE_F'] },
    reportField: 'scope1.process_emissions.exists',
    text: {
      tr: 'Yanma dışı herhangi bir üretim, kimyasal veya biyolojik süreciniz var mı?',
      en: 'Do you have any non-combustion industrial process emissions?',
    },
    helper: {
      tr: 'Kalsinasyon, metal eritme, kimyasal reaksiyon, atık su arıtma gibi yanma dışı süreçler bu kapsamda. Üretim yapıyorsanız muhtemelen bu tür emisyonlarınız vardır.',
      en: 'Non-combustion processes such as calcination, metal melting, chemical reactions, wastewater treatment fall under this scope. If you manufacture, you likely have such emissions.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    nextByValue: {
      yes: '3C-1',
      no: '3D-0',
    },
    next: '3D-0', // safe fallback for skip-loop (conditionalShow hidden path)
  },
  {
    id: '3C-1',
    number: 56,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'multi_select',
    subtype: 'searchable_catalog',
    required: true,
    reportField: 'scope1.process_emissions.equipment_list',
    loopType: 'per_process',
    loopNext: '3C-2',
    text: {
      tr: 'Proses ekipmanlarınız hangileri?',
      en: 'Which process equipment do you operate?',
    },
    placeholder: {
      tr: 'Proses ekipmanı veya proses türü arayın...',
      en: 'Search process equipment or process type...',
    },
    helper: {
      tr: 'Sektörünüze uygun ekipmanlar öne çıkarıldı. Her ekipman için üretim miktarı ve ölçüm yöntemi soracağız.',
      en: 'Equipment relevant to your sector has been highlighted. We will ask for production quantity and measurement method for each equipment.',
    },
    options: [
      { value: 'EQ-3C-01', label: { tr: 'EQ-3C-01 — Çimento / klinker fırını (NACE C23)', en: 'EQ-3C-01 — Cement / clinker kiln (NACE C23)' }, nace: 'C23' },
      { value: 'EQ-3C-02', label: { tr: 'EQ-3C-02 — Kireç fırını (NACE C23)', en: 'EQ-3C-02 — Lime kiln (NACE C23)' }, nace: 'C23' },
      { value: 'EQ-3C-03', label: { tr: 'EQ-3C-03 — Cam eritme fırını (NACE C23)', en: 'EQ-3C-03 — Glass melting furnace (NACE C23)' }, nace: 'C23' },
      { value: 'EQ-3C-04', label: { tr: 'EQ-3C-04 — Seramik / tuğla pişirme (NACE C23)', en: 'EQ-3C-04 — Ceramic / brick firing (NACE C23)' }, nace: 'C23' },
      { value: 'EQ-3C-05', label: { tr: 'EQ-3C-05 — Yüksek fırın / demir-çelik (NACE C24)', en: 'EQ-3C-05 — Blast furnace / iron-steel (NACE C24)' }, nace: 'C24' },
      { value: 'EQ-3C-06', label: { tr: 'EQ-3C-06 — Elektrik ark ocağı EAF (NACE C24)', en: 'EQ-3C-06 — Electric arc furnace EAF (NACE C24)' }, nace: 'C24' },
      { value: 'EQ-3C-07', label: { tr: 'EQ-3C-07 — Alüminyum eritme (NACE C24)', en: 'EQ-3C-07 — Aluminium smelting (NACE C24)' }, nace: 'C24' },
      { value: 'EQ-3C-08', label: { tr: 'EQ-3C-08 — Amonyak / üre üretimi (NACE C20)', en: 'EQ-3C-08 — Ammonia / urea production (NACE C20)' }, nace: 'C20' },
      { value: 'EQ-3C-09', label: { tr: 'EQ-3C-09 — Nitrik asit üretimi (NACE C20)', en: 'EQ-3C-09 — Nitric acid production (NACE C20)' }, nace: 'C20' },
      { value: 'EQ-3C-10', label: { tr: 'EQ-3C-10 — Petrokimya / rafine prosesi (NACE C19)', en: 'EQ-3C-10 — Petrochemical / refinery process (NACE C19)' }, nace: 'C19' },
      { value: 'EQ-3C-11', label: { tr: 'EQ-3C-11 — Endüstriyel atık su arıtma (NACE E)', en: 'EQ-3C-11 — Industrial wastewater treatment (NACE E)' }, nace: 'E' },
      { value: 'EQ-3C-12', label: { tr: 'EQ-3C-12 — Biyogaz / biyometan sistemi', en: 'EQ-3C-12 — Biogas / biomethane system' } },
      { value: 'EQ-3C-13', label: { tr: 'EQ-3C-13 — Kompost / organik atık işleme', en: 'EQ-3C-13 — Composting / organic waste processing' } },
      { value: 'EQ-3C-99', label: { tr: 'EQ-3C-99 — Diğer proses (listede yok)', en: 'EQ-3C-99 — Other process (not in list)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir proses ekipmanı seçin.', en: 'Please select at least one process equipment item.' },
    },
    next: '3C-2',
  },
  {
    id: '3C-2',
    number: 57,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3C-1',
    loopNext: '3C-EF',
    required: true,
    reportField: 'scope1.process_emissions.production_data',
    text: {
      tr: '[Proses adı] — Üretim miktarı ve ölçüm yöntemi nedir?',
      en: '[Process name] — What is the production quantity and measurement method?',
    },
    placeholder: {
      tr: 'Miktar: 50.000 | Birim: ton/yıl | Ölçüm: Periyodik ölçüm',
      en: 'Quantity: 50,000 | Unit: tonne/year | Measurement: Periodic measurement',
    },
    helper: {
      tr: 'Birim proses tipine göre otomatik belirlendi. Ölçüm yöntemi IPCC Tier seviyesini ve dolayısıyla veri kalitesini belirler.',
      en: 'Unit is automatically determined based on process type. Measurement method determines the IPCC Tier level and thus data quality.',
    },
    options: [
      { value: 'cems_tier3', label: { tr: 'Sürekli ölçüm sistemi (CEMS) — Tier 3 (en doğru)', en: 'Continuous emission monitoring (CEMS) — Tier 3 (most accurate)' }, tier: 3 },
      { value: 'periodic_tier2', label: { tr: 'Periyodik ölçüm — Tier 2', en: 'Periodic measurement — Tier 2' }, tier: 2 },
      { value: 'calculation_tier1', label: { tr: 'Hesaplama / tahmin — Tier 1', en: 'Calculation / estimate — Tier 1' }, tier: 1 },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen ölçüm yöntemini seçin.', en: 'Please select the measurement method.' },
    },
    next: '3C-EF',
  },
  {
    id: '3C-EF',
    number: 58,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3C-1',
    loopNext: '3D-0',
    required: true,
    reportField: 'scope1.process_emissions.facility_ef',
    text: {
      tr: '[Proses adı] için tesis spesifik emisyon faktörü var mı?',
      en: '[Process name] — Do you have a facility-specific emission factor?',
    },
    helper: {
      tr: 'Tesis ölçümüne dayalı veya mühendislik hesabından üretilen bir EF en doğru sonucu verir. Yoksa sistem sektör protokolüne göre öneride bulunur.',
      en: 'An EF based on facility measurement or engineering calculation gives the most accurate result. If not available, the system will make a suggestion based on sector protocol.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — tesis ölçümü veya mühendislik hesabı', en: 'Yes — facility measurement or engineering calculation' }, efLevel: 1 },
      { value: 'no', label: { tr: 'Hayır — yok', en: 'No — not available' }, efLevel: 2 },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3D-0',
  },

  {
    id: '3D-0',
    number: 59,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'multi_select',
    subtype: 'searchable_catalog',
    required: true,
    reportField: 'scope1.fugitive.equipment_list',
    loopType: 'per_fugitive',
    loopNext: '3D-2',
    text: {
      tr: 'Kaçak emisyon kaynaklarınız hangileri?',
      en: 'Which fugitive emission sources do you have?',
    },
    placeholder: {
      tr: 'Kaçak emisyon kaynağı arayın...',
      en: 'Search fugitive emission source...',
    },
    helper: {
      tr: 'Soğutucu gaz içeren her sistem bu kapsama girer — küçük bir ofis kliması bile dahil. GWP değerleri çok yüksek olduğundan bunları atlamak raporunuzu önemli ölçüde eksik bırakır.',
      en: 'Any system containing refrigerant gases falls under this scope — even a small office air conditioner. Skipping these will significantly underreport your emissions due to very high GWP values.',
    },
    options: [
      { value: 'EQ-3D-01', label: { tr: 'EQ-3D-01 — Split klima (R-410A / R-32)', en: 'EQ-3D-01 — Split air conditioner (R-410A / R-32)' } },
      { value: 'EQ-3D-02', label: { tr: 'EQ-3D-02 — VRF/VRV merkezi klima sistemi', en: 'EQ-3D-02 — VRF/VRV central air conditioning system' } },
      { value: 'EQ-3D-03', label: { tr: 'EQ-3D-03 — Chiller (su soğutma grubu)', en: 'EQ-3D-03 — Chiller (water cooling unit)' } },
      { value: 'EQ-3D-04', label: { tr: 'EQ-3D-04 — Soğuk oda / endüstriyel soğutucu', en: 'EQ-3D-04 — Cold room / industrial refrigerator' } },
      { value: 'EQ-3D-05', label: { tr: 'EQ-3D-05 — Isı pompası (soğutucu gaz döngülü)', en: 'EQ-3D-05 — Heat pump (refrigerant cycle)' } },
      { value: 'EQ-3D-06', label: { tr: 'EQ-3D-06 — Ticari buzdolabı / soğutma rafı', en: 'EQ-3D-06 — Commercial refrigerator / cooling shelf' } },
      { value: 'EQ-3D-07', label: { tr: 'EQ-3D-07 — Araç kliması (filo)', en: 'EQ-3D-07 — Vehicle air conditioning (fleet)' } },
      { value: 'EQ-3D-08', label: { tr: 'EQ-3D-08 — Doğalgaz boru hattı (tesis içi)', en: 'EQ-3D-08 — Natural gas pipeline (within facility)' } },
      { value: 'EQ-3D-09', label: { tr: 'EQ-3D-09 — Kompresör istasyonu / vana grubu', en: 'EQ-3D-09 — Compressor station / valve group' } },
      { value: 'EQ-3D-10', label: { tr: 'EQ-3D-10 — LPG / LNG depolama tankı', en: 'EQ-3D-10 — LPG / LNG storage tank' } },
      { value: 'EQ-3D-11', label: { tr: 'EQ-3D-11 — SF₆ gazlı şalt tesisi (GIS)', en: 'EQ-3D-11 — SF₆ gas-insulated switchgear (GIS)' } },
      { value: 'EQ-3D-12', label: { tr: 'EQ-3D-12 — SF₆ gazlı yüksek gerilim trafosu', en: 'EQ-3D-12 — SF₆ gas high-voltage transformer' } },
      { value: 'EQ-3D-13', label: { tr: 'EQ-3D-13 — HFC/PFC kullanan proses ekipmanı', en: 'EQ-3D-13 — Process equipment using HFC/PFC' } },
      { value: 'EQ-3D-14', label: { tr: 'EQ-3D-14 — NF₃ kullanan temizleme ekipmanı', en: 'EQ-3D-14 — Cleaning equipment using NF₃' } },
      { value: 'EQ-3D-99', label: { tr: 'EQ-3D-99 — Diğer (listede yok)', en: 'EQ-3D-99 — Other (not in list)' } },
      { value: 'none', label: { tr: 'Hiçbiri — kaçak emisyon kaynağım yok', en: 'None — I have no fugitive emission sources' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen kaçak emisyon kaynaklarınızı seçin veya "Hiçbiri" seçeneğini işaretleyin.', en: 'Please select your fugitive emission sources or check "None".' },
    },
    systemMessages: {
      office_no_ac: {
        tr: 'Ofis ortamında klima sistemi genellikle bulunur. Klima sisteminiz varsa bu kaynağı eklemenizi öneririz — soğutucu gazların GWP değerleri çok yüksek.',
        en: 'Office environments typically have air conditioning. If you have AC, we recommend adding this source — refrigerant GWP values are very high.',
      },
    },
    next: '3D-2',
  },
  {
    id: '3D-2',
    number: 60,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3D-0',
    loopNext: '3D-4',
    required: true,
    reportField: 'scope1.fugitive.equipment_details',
    text: {
      tr: '[Ekipman adı] — Adet, tesis ve soğutucu/gaz türü nedir?',
      en: '[Equipment] — Number of units, site, and refrigerant/gas type?',
    },
    placeholder: {
      tr: 'Adet: 8 | Tesis: İstanbul | Gaz: R-410A',
      en: 'Count: 8 | Site: Istanbul | Gas: R-410A',
    },
    helper: {
      tr: 'Gaz türü ekipman tipine göre önerildi. Emin değilseniz klima veya soğutma servis fişinizi kontrol edin — gaz türü orada yazıyor.',
      en: 'Gas type was suggested based on equipment type. If unsure, check your AC or refrigeration service receipt — the gas type is listed there.',
    },
    options: [
      { value: 'R410A', label: { tr: 'R-410A (GWP: 2.088)', en: 'R-410A (GWP: 2,088)' }, gwp: 2088 },
      { value: 'R32', label: { tr: 'R-32 (GWP: 675)', en: 'R-32 (GWP: 675)' }, gwp: 675 },
      { value: 'R22', label: { tr: 'R-22 (GWP: 1.810) — aşamalı kaldırılıyor', en: 'R-22 (GWP: 1,810) — being phased out' }, gwp: 1810 },
      { value: 'R134a', label: { tr: 'R-134a (GWP: 1.430)', en: 'R-134a (GWP: 1,430)' }, gwp: 1430 },
      { value: 'R404A', label: { tr: 'R-404A (GWP: 3.922) — yüksek GWP', en: 'R-404A (GWP: 3,922) — high GWP' }, gwp: 3922 },
      { value: 'R1234yf', label: { tr: 'R-1234yf (GWP: 4) — düşük GWP', en: 'R-1234yf (GWP: 4) — low GWP' }, gwp: 4 },
      { value: 'SF6', label: { tr: 'SF₆ (GWP: 23.500) — çok yüksek GWP', en: 'SF₆ (GWP: 23,500) — very high GWP' }, gwp: 23500 },
      { value: 'unknown', label: { tr: 'Bilinmiyor — sistem konservatif değer uygular', en: 'Unknown — system applies conservative value' }, gwp: null },
    ],
    validate: {
      requiredMessage: { tr: 'Adet, tesis ve gaz türü zorunludur.', en: 'Count, site and gas type are required.' },
    },
    systemMessages: {
      SF6: {
        tr: 'SF₆ GWP değeri 23.500 — 1 kg SF₆ kaçağı 23,5 ton CO₂\'ye eşdeğer. Servis kayıtlarından kesin dolum miktarını almanızı kesinlikle öneririz.',
        en: 'SF₆ GWP value is 23,500 — 1 kg SF₆ leak equals 23.5 tonnes of CO₂. We strongly recommend obtaining the exact refill amount from service records.',
      },
      R404A: {
        tr: 'R-404A yüksek GWP\'li. Kaçak miktarına özellikle dikkat ediniz.',
        en: 'R-404A has a high GWP. Pay special attention to the leakage amount.',
      },
    },
    next: '3D-4',
  },
  {
    id: '3D-4',
    number: 61,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'equipment_loop',
    loopSource: '3D-0',
    loopNext: '3D-EF',
    required: true,
    reportField: 'scope1.fugitive.refill_data',
    text: {
      tr: '[Ekipman] — Aktivite verisi: yıllık dolum miktarı veya sistem kapasitesi?',
      en: '[Equipment] — Activity data: annual refill quantity or system capacity?',
    },
    placeholder: {
      tr: 'Dolum: 2.5 kg | Kapasite: 8 kg',
      en: 'Refill: 2.5 kg | Capacity: 8 kg',
    },
    helper: {
      tr: 'Yıllık dolum miktarını servis faturasından veya servis formundan alabilirsiniz — "yüklenen gaz miktarı" olarak geçer. Kapasite bilgisi kaçak oranını hesaplamak için kullanılır, opsiyoneldir.',
      en: 'You can get the annual refill amount from the service invoice or form — it appears as "gas charged". Capacity information is used to calculate the leak rate and is optional.',
    },
    validate: {
      requiredMessage: { tr: 'Dolum miktarı veya kapasite en az biri zorunludur.', en: 'At least one of refill amount or capacity is required.' },
    },
    systemMessages: {
      service_reminder: {
        tr: 'Servis faturanızda "yüklenen gaz miktarı" veya "şarj edilen gaz" yazıyor. Bu değeri direkt kullanabilirsiniz.',
        en: 'Your service invoice shows "gas charged" or "gas loaded". You can use this value directly.',
      },
    },
    next: '3D-EF',
  },
  {
    id: '3D-EF',
    number: 62,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    loopSource: '3D-0',
    loopNext: 'TY-1',
    required: true,
    reportField: 'scope1.fugitive.gwp_reference',
    text: {
      tr: 'GWP referansı: IPCC AR6 (2021) onaylıyor musunuz?',
      en: 'GWP reference: Do you approve IPCC AR6 (2021)?',
    },
    helper: {
      tr: 'Sistem IPCC AR6 (2021) GWP değerlerini kullanıyor. Bu en güncel uluslararası standarttır. Farklı bir raporlama çerçevesi gerektiriyorsa AR4 veya AR5 seçebilirsiniz.',
      en: 'The system uses IPCC AR6 (2021) GWP values. This is the most current international standard. If a different reporting framework requires it, you can select AR4 or AR5.',
    },
    options: [
      { value: 'AR6', label: { tr: 'Onayla — IPCC AR6 (2021) kullanılsın (önerilen)', en: 'Approve — Use IPCC AR6 (2021) (recommended)' } },
      { value: 'AR4', label: { tr: 'Farklı GWP referansı seçmek istiyorum (AR4/AR5)', en: 'I want to select a different GWP reference (AR4/AR5)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen GWP referansını onaylayın.', en: 'Please approve the GWP reference.' },
    },
    next: 'TY-1',
  },

  {
    id: 'TY-1',
    number: 63,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.confirmed',
    text: {
      tr: 'Kapsam 1 özeti: Tespit edilen kaynaklar ve miktarlar doğru mu?',
      en: 'Scope 1 summary: Are the identified sources and quantities correct?',
    },
    helper: {
      tr: 'Tüm Kapsam 1 kaynaklarınız ve tahmini emisyon miktarları gösterildi. Yanlış veya eksik bir şey varsa düzenleyebilirsiniz. EF seviyesi düşük olanlar iyileştirme için işaretlendi.',
      en: 'All your Scope 1 sources and estimated emission amounts are shown. If anything is incorrect or missing, you can edit. Low EF level items are marked for improvement.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Onayla — Kapsam 1 tamamlandı', en: 'Approve — Scope 1 complete' } },
      { value: 'edit', label: { tr: 'Düzenle — Bir kaynağı değiştirmek istiyorum', en: 'Edit — I want to change a source' } },
      { value: 'add_source', label: { tr: 'Kaynak ekle — Gözden kaçan bir kaynak var', en: 'Add source — I missed a source' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      confirmed: {
        tr: 'Kapsam 1 tamamlandı! Şimdi Kapsam 2 — satın alınan enerji emisyonlarına geçiyoruz.',
        en: 'Scope 1 complete! We are now moving to Scope 2 — purchased energy emissions.',
      },
    },
    nextByValue: {
      confirmed: '4-GİRİŞ',
      edit: '3A-0',  // routes to Scope 1 start to re-enter data
      add_source: 'TY-2',
    },
  },
  {
    id: 'TY-2',
    number: 64,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 300,
    conditionalShow: { questionId: 'TY-1', equals: 'add_source' },
    reportField: 'scope1.missed_source',
    text: {
      tr: 'Gözden kaçan kaynağı tanımlayın.',
      en: 'Describe the missed emission source.',
    },
    placeholder: {
      tr: 'Örn: Çatımızda hava ısıtma sistemi var, LPG ile çalışıyor',
      en: 'Example: We have a roof heating system that runs on LPG',
    },
    helper: {
      tr: 'Kaynağı kendi ifadenizle yazın. Sistem hangi kategoriye gireceğini belirleyecek ve onayınızı soracak.',
      en: 'Describe the source in your own words. The system will determine which category it belongs to and ask for your confirmation.',
    },
    next: '4-GİRİŞ',
  },

  // ── STAGE 4 ─ Scope 2 Emissions ───────────────────────────────────────────
  {
    id: '4-GİRİŞ',
    number: 65,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'info',
    required: false,
    text: {
      tr: 'Kapsam 2 Giriş Ekranı — Dışarıdan satın aldığınız enerjinin emisyonlarını hesaplayalım.',
      en: 'Scope 2 Introduction — Let\'s calculate the emissions from your purchased energy.',
    },
    systemMessages: {
      onLoad: {
        tr: 'Kapsam 2, dışarıdan satın aldığınız elektrik, ısı, buhar veya soğutma enerjisinden kaynaklanan dolaylı emisyonları kapsar. Bu versiyonda location-based (konum bazlı) metodoloji uygulanır: emisyonlar tesisinizin bulunduğu bölgenin ortalama şebeke faktörüyle hesaplanır.',
        en: 'Scope 2 covers indirect emissions from purchased electricity, heat, steam, or cooling energy. This version applies the location-based methodology: emissions are calculated using the average grid factor of your facility\'s region.',
      },
      warning: {
        tr: 'Dikkat: Kendi ürettiğiniz enerji (güneş paneli, rüzgar türbini vb.) bu kapsamın dışındadır. Aşama 3\'teki araçlarınızın elektrik şarjı da bu aşamada kayıt altına alınacak.',
        en: 'Note: Self-generated energy (solar panels, wind turbines, etc.) is outside this scope. Your electric vehicle charging from Stage 3 will also be recorded here.',
      },
    },
    options: [
      { value: 'start', label: { tr: 'Başlayalım', en: 'Let\'s Start' } },
    ],
    next: '4A-0',
  },
  {
    id: '4A-0',
    number: 66,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.grid_electricity',
    text: {
      tr: 'Şebekeden elektrik satın alıyor musunuz?',
      en: 'Do you purchase electricity from the grid?',
    },
    helper: {
      tr: 'Fatura ödediğiniz her türlü elektrik tüketimi bu kapsamda. Tamamen güneş enerjisi gibi kendi üretiminizle çalışıyorsanız \'Hayır\' seçebilirsiniz.',
      en: 'Any electricity consumption for which you pay a bill falls under this scope. If you operate entirely on self-generation such as solar, you may select \'No\'.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      yes: {
        tr: 'Her tesisiniz için ayrı elektrik tüketimi soracağız. Faturalarınızı veya sayaç verilerinizi hazır bulundurmanızı öneririz.',
        en: 'We will ask for electricity consumption data for each facility separately. We recommend having your invoices or meter readings ready.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      yes: '4A-1',
      no: '4B-0',
    },
  },
  {
    id: '4A-1',
    number: 67,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: true,
    loopType: 'per_facility',
    loopSource: '2A-1',
    loopNext: '4A-2',
    reportField: 'scope2.facility_electricity_kwh',
    text: {
      tr: '[Tesis adı] — Yıllık elektrik tüketimi nedir?',
      en: '[Site name] — What is the annual electricity consumption?',
    },
    placeholder: {
      tr: 'Örn: 45.000 kWh',
      en: 'Example: 45,000 kWh',
    },
    helper: {
      tr: 'Yıllık toplam tüketim. Fatura veya sayaç verisi en doğru kaynaktır. Farklı birimdeyse (MWh, GJ) sistem dönüşüm yapar. Bilmiyorsanız tahmin ile başlayabilirsiniz.',
      en: 'Annual total consumption. Invoice or meter data is the most accurate source. If in a different unit (MWh, GJ), the system will convert. You can start with an estimate if unsure.',
    },
    units: ['kWh', 'MWh'],
    systemMessages: {
      facilityStart: {
        tr: 'Tesis [N]/[Toplam]: [Tesis adı]. Bu tesis için elektrik tüketimini giriyoruz.',
        en: 'Site [N]/[Total]: [Site name]. Entering electricity consumption for this site.',
      },
      mwhConverted: {
        tr: 'MWh değeriniz kWh\'a dönüştürüldü: [değer] MWh = [değer×1000] kWh.',
        en: 'Your MWh value was converted to kWh: [value] MWh = [value×1000] kWh.',
      },
      tlWarning: {
        tr: 'Fatura tutarı girildi. Para biriminden kWh tahmini yapacağız — daha az doğru.',
        en: 'Invoice amount entered. We will estimate kWh from the monetary amount — less accurate.',
      },
      zeroWarning: {
        tr: 'Bu tesis hiç elektrik tüketmiyor mu? Evet ise atlamak ister misiniz?',
        en: 'Does this site have zero electricity consumption? Would you like to skip it?',
      },
      empty: {
        tr: 'Lütfen yıllık elektrik tüketimini girin.',
        en: 'Please enter the annual electricity consumption.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Tüketim miktarı zorunludur.', en: 'Consumption amount is required.' },
    },
    // nextByValue removed: 4A-1 is text/numeric — the answer is a number string,
    // never the unit key 'kwh'/'mwh'/'tl'. Route via next; 4A-1a is conditional.
    next: '4A-2',
  },
  {
    id: '4A-1a',
    number: 68,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: true,
    conditionalShow: { questionId: '4A-1', equals: 'tl' },
    reportField: 'scope2.facility_unit_price',
    text: {
      tr: '[Fatura tutarı girilmişse] Birim elektrik fiyatı nedir?',
      en: '[If invoice amount entered] What is the unit electricity price?',
    },
    placeholder: {
      tr: 'Örn: 3.85 TL/kWh',
      en: 'Example: 3.85 TL/kWh',
    },
    helper: {
      tr: 'Faturanızın son sayfasında veya EPDK web sitesinde birim fiyatı bulabilirsiniz. Bu değerle fatura tutarından kWh hesaplanacak. Tahmin olduğundan raporunuzda belgelenecek.',
      en: 'You can find the unit price on the last page of your invoice or on the EPDK website. kWh will be calculated from the invoice amount using this value. It will be documented as an estimate in your report.',
    },
    systemMessages: {
      calculated: {
        tr: 'Tahmini tüketim: [TL tutarı] / [birim fiyat] = [kWh]. Bu tahmin raporunuzda \'tahmini veri\' olarak işaretlenecek.',
        en: 'Estimated consumption: [TL amount] / [unit price] = [kWh]. This estimate will be flagged as \'estimated data\' in your report.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Birim fiyat zorunludur.', en: 'Unit price is required.' },
    },
    next: '4A-2',
  },
  {
    id: '4A-2',
    number: 69,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.facility_shared_building',
    text: {
      tr: '[Tesis adı] — Bu tesis paylaşımlı veya kiralık bir binada mı?',
      en: '[Site name] — Is this site located in a shared or rented building?',
    },
    helper: {
      tr: 'Ofis binanızı başka şirketlerle paylaşıyorsanız veya kiracıysanız \'Evet\' seçin. Tüketim payını bina yönetiminden belgesiyle veya metrekare oranıyla hesaplayacağız.',
      en: 'If you share your office building with other companies or are a tenant, select \'Yes\'. We will calculate your consumption share using a building management document or floor area ratio.',
    },
    options: [
      { value: 'no', label: { tr: 'Hayır — tesisin tamamı bizim / bağımsız bina', en: 'No — we own the entire site / independent building' } },
      { value: 'yes', label: { tr: 'Evet — paylaşımlı bina (kiracı, ortak kullanım vb.)', en: 'Yes — shared building (tenant, common use, etc.)' } },
    ],
    systemMessages: {
      yes: {
        tr: 'Paylaşımlı bina seçildi. Bina yönetiminden tüketim payı belgesi alabilir misiniz? Belge varsa en doğru veridir. Yoksa metrekare bazlı tahmin yapabiliriz.',
        en: 'Shared building selected. Can you obtain a consumption allocation document from building management? A document is the most accurate data. If not, we can estimate using floor area.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      no: '4A-3',
      yes: '4A-2a',
    },
  },
  {
    id: '4A-2a',
    number: 70,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    conditionalShow: { questionId: '4A-2', equals: 'yes' },
    reportField: 'scope2.building_mgmt_doc_available',
    text: {
      tr: '[Paylaşımlı bina] Bina yönetiminden tüketim payı belgesi alabilir misiniz?',
      en: '[Shared building] Can you obtain a consumption allocation document from building management?',
    },
    helper: {
      tr: 'Bina yönetiminden şirketinize düşen kWh payını gösteren resmi belge en doğru veridir. Alınamazsa metrekare oranı ile tahmin yapılabilir.',
      en: 'An official document from building management showing your company\'s kWh share is the most accurate data. If unavailable, estimation using floor area ratio is possible.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — bina yönetimi belge sağlayabilir', en: 'Yes — building management can provide a document' } },
      { value: 'no', label: { tr: 'Hayır — belge alınamıyor', en: 'No — document not available' } },
    ],
    systemMessages: {
      yes: {
        tr: 'Bina yönetiminden alacağınız tüketim payı belgesi Seviye 1 veri sayılır — en doğru yöntem budur.',
        en: 'The consumption share document from building management is considered Level 1 data — this is the most accurate method.',
      },
      no: {
        tr: 'Metrekare bazlı tahmin uygulanacak: Şirket alanı (m²) / Bina toplam alanı (m²) × Bina toplam tüketimi = Şirket payı. Aşama 6\'da kabul olarak belgelenecek.',
        en: 'Floor area-based estimation will be applied: Company area (m²) / Building total area (m²) × Building total consumption = Company share. Will be documented as an assumption in Stage 6.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '4A-3',
    nextByValue: {
      yes: '4A-2b',
      no: '4A-2c',
    },
  },
  {
    id: '4A-2b',
    number: 71,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: true,
    conditionalShow: { questionId: '4A-2a', equals: 'yes' },
    reportField: 'scope2.building_mgmt_kwh',
    text: {
      tr: '[Belge var] Bina yönetiminin beyan ettiği tüketim payı (kWh) nedir?',
      en: '[Document available] What is the consumption share declared by building management (kWh)?',
    },
    placeholder: {
      tr: 'Örn: 18.500 kWh',
      en: 'Example: 18,500 kWh',
    },
    helper: {
      tr: 'Bina yönetiminin size ilettiği yıllık kWh değerini girin. Bu değer 4A-1\'de girdiğinizin üzerine yazacak.',
      en: 'Enter the annual kWh value communicated to you by building management. This value will overwrite what you entered in 4A-1.',
    },
    systemMessages: {
      higher: {
        tr: 'Bina yönetimi beyanı daha önce girdiğiniz değerden yüksek. Hangisi daha doğru? Bina yönetimi beyanı güncel ise onu kullanmanızı öneririz.',
        en: 'Building management declaration is higher than the value you previously entered. Which is more accurate? We recommend using the building management declaration if it is current.',
      },
      saved: {
        tr: 'Bina yönetimi beyanı kaydedildi: [kWh]. Bu değer Seviye 1 veri olarak işaretlendi.',
        en: 'Building management declaration saved: [kWh]. This value has been flagged as Level 1 data.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Tüketim payı zorunludur.', en: 'Consumption share is required.' },
    },
    next: '4A-3',
  },
  {
    id: '4A-2c',
    number: 72,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'compound',
    required: true,
    conditionalShow: { questionId: '4A-2a', equals: 'no' },
    reportField: 'scope2.building_m2_estimate',
    text: {
      tr: '[Belge yok] Şirketin net kira alanı ve binanın toplam alanı nedir?',
      en: '[No document] What is the company\'s net floor area and the building\'s total area?',
    },
    placeholder: {
      tr: 'Şirket alanı: 350 m² | Bina toplam: 2.400 m²',
      en: 'Company area: 350 m² | Building total: 2,400 m²',
    },
    helper: {
      tr: 'Pay oranı = Şirket alanı / Bina toplam alanı. Örn: 350/2400 = %14.6 → Bu oran bina toplam elektrik tüketimine uygulanır. Kira sözleşmenizde net alan yazıyor.',
      en: 'Share ratio = Company area / Building total area. Example: 350/2400 = 14.6% → This ratio is applied to the building\'s total electricity consumption. Net area is stated in your lease agreement.',
    },
    fields: [
      { id: 'company_m2', label: { tr: 'Şirket kira alanı (m²)', en: 'Company lease area (m²)' }, type: 'numeric', required: true },
      { id: 'building_m2', label: { tr: 'Bina toplam alanı (m²)', en: 'Building total area (m²)' }, type: 'numeric', required: true },
    ],
    systemMessages: {
      logicError: {
        tr: 'Şirket kira alanı, bina toplam alanından büyük olamaz. Lütfen değerleri kontrol edin.',
        en: 'Company lease area cannot be greater than the building total area. Please check the values.',
      },
      calculated: {
        tr: 'Pay oranı: [şirket_m2]/[bina_m2] = %[oran]. Tahmini tüketiminiz: [kWh]. Bu tahmin raporunuzda \'m² bazlı tahmini\' olarak belgelenecek.',
        en: 'Share ratio: [company_m2]/[building_m2] = [ratio]%. Estimated consumption: [kWh]. This estimate will be documented as \'m²-based estimate\' in your report.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Her iki alan da zorunludur.', en: 'Both fields are required.' },
      logicMessage: { tr: 'Şirket alanı bina alanından büyük olamaz.', en: 'Company area cannot exceed building area.' },
    },
    next: '4A-3',
  },
  {
    id: '4A-3',
    number: 73,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.onsite_generation',
    text: {
      tr: '[Tesis adı] — Sahadaki yenilenebilir enerji üretiminiz var mı?',
      en: '[Site name] — Do you have on-site renewable energy generation?',
    },
    helper: {
      tr: 'Çatı güneş paneli, rüzgar türbini, biyogaz sistemi gibi sahada enerji üretiminiz varsa \'Evet\' seçin. Bu üretim Kapsam 2\'den düşülmez ama ayrıca raporlanır.',
      en: 'If you have on-site energy generation such as rooftop solar panels, wind turbines, or biogas systems, select \'Yes\'. This generation is not deducted from Scope 2 but is reported separately.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      yes: {
        tr: 'Sahadaki yenilenebilir enerji üretiminiz Kapsam 2 hesabından düşülmez. Ancak raporunuzda ayrı bir bölümde \'sıfır emisyonlu üretim\' olarak gösterilecek. Bu durum şirketinizin iklim çabasını daha görünür kılar.',
        en: 'Your on-site renewable energy generation is not deducted from Scope 2. However, it will be shown as \'zero-emission generation\' in a separate section of your report, making your company\'s climate efforts more visible.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      yes: '4A-3a',
      no: '4A-EF',
    },
  },
  {
    id: '4A-3a',
    number: 74,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'compound',
    required: true,
    conditionalShow: { questionId: '4A-3', equals: 'yes' },
    reportField: 'scope2.onsite_generation_detail',
    text: {
      tr: '[Sahada üretim] Yıllık üretim miktarı ve şebekeye satış var mı?',
      en: '[On-site generation] Annual production and any grid sales?',
    },
    placeholder: {
      tr: 'Üretim: 12.000 kWh | Şebeke satışı: Hayır',
      en: 'Production: 12,000 kWh | Grid sales: No',
    },
    helper: {
      tr: 'Yıllık üretim miktarını inverter veya sayaç verilerinden alabilirsiniz. Şebekeye sattığınız kısım ayrı kaydedilecek — satış Kapsam 2\'yi azaltmaz, yalnızca raporlanır.',
      en: 'You can obtain the annual production amount from inverter or meter data. The portion sold to the grid will be recorded separately — grid sales do not reduce Scope 2, they are only reported.',
    },
    fields: [
      { id: 'production_kwh', label: { tr: 'Yıllık üretim (kWh)', en: 'Annual production (kWh)' }, type: 'numeric', required: true },
      { id: 'grid_sales', label: { tr: 'Şebekeye satış var mı?', en: 'Any grid sales?' }, type: 'boolean', required: true },
      { id: 'grid_sales_kwh', label: { tr: 'Şebeke satış miktarı (kWh)', en: 'Grid sales amount (kWh)' }, type: 'numeric', required: false, conditionalOn: 'grid_sales' },
    ],
    systemMessages: {
      gridSales: {
        tr: 'Şebekeye sattığınız enerji Kapsam 2 hesabınızı azaltmaz. Yalnızca sahada tüketilen kısım raporunuzu etkiler. Örneğin: 12.000 kWh üretip 4.000 kWh sattıysanız 8.000 kWh sahada tüketim sayılır ve bu Kapsam 2\'nizden bağımsız raporlanır.',
        en: 'Energy sold to the grid does not reduce your Scope 2 calculation. Only the portion consumed on-site affects your report. For example: if you produce 12,000 kWh and sell 4,000 kWh, 8,000 kWh counts as on-site consumption and is reported independently of your Scope 2.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Üretim miktarı zorunludur.', en: 'Production amount is required.' },
    },
    next: '4A-EF',
  },
  {
    id: '4A-EF',
    number: 75,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.supplier_ef_declaration',
    text: {
      tr: '[Tesis adı] — Elektrik tedarikçinizin resmi emisyon beyanı var mı?',
      en: '[Site name] — Does your electricity supplier have an official emission declaration?',
    },
    helper: {
      tr: 'Tedarikçinizin resmi emisyon beyanı Seviye 1 veri sayılır. Yoksa sistem tesisin bulunduğu ülkenin ulusal şebeke emisyon faktörünü (Seviye 2) önerecek.',
      en: 'Your supplier\'s official emission declaration is considered Level 1 data. If unavailable, the system will suggest the national grid emission factor for the country where the facility is located (Level 2).',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — tedarikçi resmi emisyon beyanı var', en: 'Yes — supplier has an official emission declaration' } },
      { value: 'no', label: { tr: 'Hayır — beyan yok', en: 'No — no declaration available' } },
    ],
    systemMessages: {
      no_turkey: {
        tr: 'Türkiye şebeke emisyon faktörü öneriliyor: 0.4312 kg CO₂e/kWh (TÜİK/DEFRA 2023). Kaynak: DEFRA Greenhouse Gas Conversion Factors 2023. Kullanmak ister misiniz?',
        en: 'Turkey grid emission factor suggested: 0.4312 kg CO₂e/kWh (TÜİK/DEFRA 2023). Source: DEFRA Greenhouse Gas Conversion Factors 2023. Would you like to use this?',
      },
      no_country_ef_missing: {
        tr: 'Bu ülke için Seviye 2 EF bulunamadı. Bölgesel ortalama (Seviye 3) uygulandı. Ülkenin ulusal enerji ajansından güncel EF almanızı öneririz.',
        en: 'Level 2 EF not found for this country. Regional average (Level 3) was applied. We recommend obtaining current EF from the country\'s national energy agency.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '4B-0',
  },
  {
    id: '4B-0',
    number: 76,
    stage: 4,
    block: '4B',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.purchased_heat_steam',
    text: {
      tr: 'Dışarıdan ısı, buhar, soğutma veya sıkıştırılmış hava satın alıyor musunuz?',
      en: 'Do you purchase heat, steam, cooling or compressed air from external sources?',
    },
    helper: {
      tr: 'Bölgesel ısıtma/soğutma ağına bağlıysanız, fabrika dışından buhar satın alıyorsanız veya ortak kompresör sistemi kullanıyorsanız \'Evet\' seçin. Çoğu ofis şirketi için bu \'Hayır\'dır.',
      en: 'If you are connected to a district heating/cooling network, purchase steam from outside the plant, or use a shared compressor system, select \'Yes\'. For most office companies, this is \'No\'.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      yes: {
        tr: 'Satın aldığınız enerji türlerini ve yıllık miktarlarını soracağız. Tedarikçi faturanızı hazır bulundurmanızı öneririz.',
        en: 'We will ask for the types and annual amounts of energy you purchase. We recommend having your supplier invoices ready.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      yes: '4B-1',
      no: '4C-1',
    },
  },
  {
    id: '4B-1',
    number: 77,
    stage: 4,
    block: '4B',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'multi_select',
    required: true,
    reportField: 'scope2.purchased_energy_types',
    text: {
      tr: 'Satın aldığınız enerji türleri ve yıllık miktarlar neler?',
      en: 'What types of energy do you purchase and in what quantities?',
    },
    helper: {
      tr: 'Her enerji türü için yıllık tüketim miktarını girin. Birim olarak GJ veya MWh tercih edilir — faturanızda hangisi yazıyorsa onu kullanın.',
      en: 'Enter the annual consumption amount for each energy type. GJ or MWh is preferred — use whichever appears on your invoice.',
    },
    options: [
      { value: 'heat', label: { tr: 'Isı / Merkezi ısıtma (district heating)', en: 'Heat / District heating' }, unit: ['GJ', 'MWh'] },
      { value: 'steam', label: { tr: 'Buhar', en: 'Steam' }, unit: ['GJ', 'MWh', 'tonnes'] },
      { value: 'cooling', label: { tr: 'Soğutma / Merkezi soğutma (district cooling)', en: 'Cooling / District cooling' }, unit: ['GJ', 'MWh'] },
      { value: 'compressed_air', label: { tr: 'Sıkıştırılmış hava', en: 'Compressed air' }, unit: ['GJ', 'm³'] },
    ],
    systemMessages: {
      steam: {
        tr: 'Buhar için basınç (bar) ve sıcaklık (°C) değerlerini biliyorsanız daha doğru emisyon faktörü uygulanabilir. Opsiyoneldir — bilmiyorsanız genel EF kullanılır.',
        en: 'If you know the pressure (bar) and temperature (°C) values for steam, a more accurate emission factor can be applied. This is optional — if unknown, a general EF will be used.',
      },
    },
    validate: {
      requiredMessage: { tr: 'En az bir enerji türü seçin.', en: 'Select at least one energy type.' },
    },
    next: '4B-EF',
  },
  {
    id: '4B-EF',
    number: 78,
    stage: 4,
    block: '4B',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.heat_supplier_ef_declaration',
    text: {
      tr: '[Enerji türü] için tedarikçinin emisyon beyanı var mı?',
      en: '[Energy type] — Does your supplier have an emission declaration?',
    },
    helper: {
      tr: 'Bölgesel ısı/buhar ağı işleticisi veya tedarikçi emisyon beyanı sağlıyorsa en doğru veridir. Yoksa sistem bölgesel ısıtma/buhar EF\'sini önerecek.',
      en: 'If the district heat/steam network operator or supplier provides an emission declaration, this is the most accurate data. Otherwise, the system will suggest the regional heating/steam EF.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — tedarikçi emisyon beyanı var', en: 'Yes — supplier has an emission declaration' } },
      { value: 'no', label: { tr: 'Hayır — beyan yok', en: 'No — no declaration available' } },
    ],
    systemMessages: {
      no_heat: {
        tr: 'DEFRA bölgesel ısıtma EF öneriliyor. Kaynak: DEFRA Greenhouse Gas Conversion Factors 2023. Tedarikçi beyanı pratikte nadir olduğundan Seviye 2 standart kabul görür.',
        en: 'DEFRA district heating EF suggested. Source: DEFRA Greenhouse Gas Conversion Factors 2023. Level 2 is the standard since supplier declarations are rare in practice.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '4C-1',
  },
  {
    id: '4C-1',
    number: 79,
    stage: 4,
    block: '4C',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.confirmed',
    text: {
      tr: 'Kapsam 2 özeti: Tespit edilen enerji kaynakları ve miktarlar doğru mu?',
      en: 'Scope 2 summary: Are the identified energy sources and quantities correct?',
    },
    helper: {
      tr: 'Tüm Kapsam 2 kaynaklarınız ve hesaplanan emisyonlar aşağıda. Yanlış veya eksik bir şey varsa düzenleyebilirsiniz.',
      en: 'All your Scope 2 sources and calculated emissions are shown below. You can edit if anything is incorrect or missing.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Onayla — Kapsam 2 tamamlandı', en: 'Confirm — Scope 2 complete' } },
      { value: 'edit', label: { tr: 'Düzenle — Bir tesisin verisini değiştirmek istiyorum', en: 'Edit — I want to change a site\'s data' } },
      { value: 'add_source', label: { tr: 'Kaynak ekle — Gözden kaçan bir enerji kaynağı var', en: 'Add source — I missed an energy source' } },
    ],
    systemMessages: {
      confirmed: {
        tr: 'Kapsam 2 tamamlandı! Toplam: [X tCO₂e] ([N] tesis, [enerji türleri]). Veri kalitesi: %[S1] Seviye 1 · %[S2] Seviye 2 · %[S3] Seviye 3. Şimdi Kapsam 3 — değer zinciri emisyonlarına geçiyoruz.',
        en: 'Scope 2 complete! Total: [X tCO₂e] ([N] sites, [energy types]). Data quality: [S1]% Level 1 · [S2]% Level 2 · [S3]% Level 3. Moving to Scope 3 — value chain emissions.',
      },
      scope3cat3: {
        tr: 'Not: Kapsam 2 verilerinizden Kapsam 3 Kategori 3 (enerji ilişkili emisyonlar) otomatik hesaplanacak. Ayrıca veri girmenize gerek yok.',
        en: 'Note: Scope 3 Category 3 (energy-related emissions) will be automatically calculated from your Scope 2 data. No additional data entry is required.',
      },
    },
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: {
      confirmed: 'K3C1-0',
      edit: '4A-0',
      add_source: '4A-0',
    },
  },

  // ── STAGE 5 ─ Scope 3 Emissions ───────────────────────────────────────────
  // 27 questions · #80–#106 · DOCX v3.0
  {
    id: 'K3C1-0',
    number: 80,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat1.applicable',
    text: {
      tr: 'Şirketiniz dışarıdan mal veya hizmet satın alıyor mu?',
      en: 'Does your company purchase goods or services from external suppliers?',
    },
    helper: {
      tr: 'Ofis malzemesi, BT ekipmanı, danışmanlık gibi her türlü dış satın alım bu kapsamda. Neredeyse her şirketin bu kategoride emisyonu vardır.',
      en: 'All external purchases such as office supplies, IT equipment and consulting fall in this scope. Almost every company has emissions in this category.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      no_warning: {
        tr: 'Neredeyse her şirketin satın aldığı mal ve hizmetleri vardır — ofis malzemesi, IT, temizlik, danışmanlık gibi. Gerçekten hiçbir dış satın alım yok mu?',
        en: 'Almost every company purchases goods and services — office supplies, IT, cleaning, consulting. Are you sure there are no external purchases?',
      },
    },
    nextByValue: { yes: 'K3C1-1', no: 'K3C2-0' },
  },
  {
    id: 'K3C1-1',
    number: 81,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'multi_select',
    required: true,
    reportField: 'scope3.cat1.categories',
    text: {
      tr: 'Satın aldığınız mal/hizmet kategorileri hangileri?',
      en: 'Which categories of goods and services do you purchase?',
    },
    helper: {
      tr: 'Sektörünüze göre en materyel kategoriler öne çıkarıldı. Her seçilen kategori için yıllık harcama tutarı soracağız — bu Seviye 3 varsayılan hesap için yeterli.',
      en: 'Most material categories for your sector are highlighted. We will ask for annual spend for each selected category — sufficient for a Level 3 default calculation.',
    },
    placeholder: { tr: 'Kategori arayın veya listeden seçin...', en: 'Search or select from list...' },
    options: [
      { value: 'SC-01', label: { tr: 'SC-01 — Hammadde ve ara mallar (NACE C öncelikli)', en: 'SC-01 — Raw materials and intermediate goods (NACE C priority)' } },
      { value: 'SC-02', label: { tr: 'SC-02 — Ambalaj malzemeleri', en: 'SC-02 — Packaging materials' } },
      { value: 'SC-03', label: { tr: 'SC-03 — BT ekipmanı ve elektronik', en: 'SC-03 — IT equipment and electronics' } },
      { value: 'SC-04', label: { tr: 'SC-04 — Ofis malzemeleri ve kırtasiye', en: 'SC-04 — Office supplies and stationery' } },
      { value: 'SC-05', label: { tr: 'SC-05 — Makine ve endüstriyel ekipman', en: 'SC-05 — Machinery and industrial equipment' } },
      { value: 'SC-06', label: { tr: 'SC-06 — İnşaat ve tesis hizmetleri', en: 'SC-06 — Construction and facility services' } },
      { value: 'SC-07', label: { tr: 'SC-07 — Profesyonel hizmetler (danışmanlık, hukuk, muhasebe)', en: 'SC-07 — Professional services (consulting, legal, accounting)' } },
      { value: 'SC-08', label: { tr: 'SC-08 — Lojistik ve taşımacılık hizmetleri (⚠ Kat.4 çakışma kontrolü)', en: 'SC-08 — Logistics and transport services (⚠ Cat.4 overlap check)' } },
      { value: 'SC-09', label: { tr: 'SC-09 — Gıda ve içecek (kurumsal yemekhane vb.)', en: 'SC-09 — Food and beverages (corporate canteen, etc.)' } },
      { value: 'SC-10', label: { tr: 'SC-10 — Enerji ilişkili ürünler (⚠ K1 çakışma kontrolü)', en: 'SC-10 — Energy-related products (⚠ K1 overlap check)' } },
      { value: 'SC-11', label: { tr: 'SC-11 — Su ve atık su hizmetleri', en: 'SC-11 — Water and wastewater services' } },
      { value: 'SC-12', label: { tr: 'SC-12 — Diğer mal ve hizmetler', en: 'SC-12 — Other goods and services' } },
    ],
    systemMessages: {
      sc08_warning: {
        tr: 'Lojistik hizmetleri satın alıyorsunuz. Aynı harcamayı Kategori 4\'e de girmeyin — bu çift sayıma yol açar.',
        en: 'You purchase logistics services. Do not enter the same spend in Category 4 — this causes double counting.',
      },
      sc10_warning: {
        tr: 'K1 girişlerinizle örtüşüyor mu? Çift sayımı önlemek için kontrol edin.',
        en: 'Does this overlap with your Scope 1 entries? Check to avoid double counting.',
      },
    },
    next: 'K3C1-2',
  },
  {
    id: 'K3C1-2',
    number: 82,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'text',
    subtype: 'numeric',
    required: true,
    loopType: 'per_category',
    loopSource: 'K3C1-1',
    loopNext: 'K3C1-3',
    reportField: 'scope3.cat1.spend',
    text: {
      tr: '[Kategori adı] — Yıllık harcama tutarı nedir?',
      en: '[Category] — What is the annual spend?',
    },
    helper: {
      tr: 'Yıllık toplam harcama. Kesin değer gerekmez — muhasebe verilerinizden yaklaşık tutar yeterli. Sistem bu tutardan Seviye 3 emisyon tahmini yapacak.',
      en: 'Total annual spend. Exact value not required — an approximate figure from accounting data is sufficient. The system will calculate a Level 3 emission estimate.',
    },
    placeholder: { tr: 'Örn: 450.000 TL', en: 'e.g. 450,000 TL' },
    units: ['TL', 'USD', 'EUR'],
    systemMessages: {
      estimate_preview: {
        tr: '[Kategori] için tahmini Seviye 3 emisyon: ≈ [X] tCO₂e. Bu tahmin EPA USEEIO sektör faktörüne dayanır. Daha doğru değer için tedarikçi verisi ekleyebilirsiniz.',
        en: 'Estimated Level 3 emission for [Category]: ≈ [X] tCO₂e. Based on EPA USEEIO sector factor. You can add supplier data for more accuracy.',
      },
      zero_warning: {
        tr: 'Bu kategoride hiç harcama yok mu?',
        en: 'Is there really no spend in this category?',
      },
    },
    next: 'K3C1-3',
  },
  {
    id: 'K3C1-3',
    number: 83,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat1.level2_upgrade',
    text: {
      tr: '[Kategori] — Miktar bazlı veri var mı? (Seviye 2\'ye yükselt)',
      en: '[Category] — Do you have quantity-based data? (Upgrade to Level 2)',
    },
    helper: {
      tr: 'Opsiyonel. Satın aldığınız miktarı biliyorsanız (kg, adet, m²) Seviye 2\'ye geçebilirsiniz — daha doğru bir sonuç verir.',
      en: 'Optional. If you know the quantity purchased (kg, units, m²) you can upgrade to Level 2 — gives a more accurate result.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — miktar biliyorum (Seviye 2)', en: 'Yes — I have quantity data (Level 2)' } },
      { value: 'no', label: { tr: 'Hayır — harcama yeterli (Seviye 3)', en: 'No — spend data is sufficient (Level 3)' } },
    ],
    next: 'K3C1-4',
  },
  {
    id: 'K3C1-4',
    number: 84,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat1.supplier_declaration',
    text: {
      tr: '[Kategori] — Tedarikçi emisyon beyanı olan tedarikçiniz var mı?',
      en: '[Category] — Do any suppliers have emission declarations?',
    },
    helper: {
      tr: 'PCF belgesi, EPD veya tedarikçi GHG raporu varsa girin. Sistem S3 tahminiyle karşılaştırır.',
      en: 'Enter if you have a PCF certificate, EPD or supplier GHG report. System will compare against the Level 3 estimate.',
    },
    placeholder: { tr: 'Tedarikçi adı | tCO₂e veya kg CO₂e/birim | Yıl', en: 'Supplier name | tCO₂e or kg CO₂e/unit | Year' },
    options: [
      { value: 'yes', label: { tr: 'Evet — tedarikçi beyanı var (Seviye 1)', en: 'Yes — supplier declaration available (Level 1)' } },
      { value: 'no', label: { tr: 'Hayır — Seviye 3/2 ile devam', en: 'No — continue with Level 3/2' } },
    ],
    systemMessages: {
      low_declaration: {
        tr: 'Bu tedarikçinin beyanı S3 tahmininden önemli ölçüde düşük. Bu tedarikçi daha yeşil bir tedarik zinciri anlamına gelebilir.',
        en: 'This supplier\'s declaration is significantly lower than the Level 3 estimate. This supplier may represent a greener supply chain.',
      },
      high_declaration: {
        tr: 'Bu tedarikçinin beyanı S3 tahmininden çok yüksek. Beyan değerini ve kaynağını kontrol etmenizi öneririz.',
        en: 'This supplier\'s declaration is much higher than the Level 3 estimate. We recommend verifying the declaration value and source.',
      },
    },
    next: 'K3C2-0',
  },
  {
    id: 'K3C2-0',
    number: 85,
    stage: 5,
    block: '5B',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat2.applicable',
    text: {
      tr: 'Bu raporlama yılında herhangi bir sermaye varlığı satın aldınız mı?',
      en: 'Did you purchase any capital goods during this reporting year?',
    },
    helper: {
      tr: 'Bina, makine, araç, BT altyapısı gibi birden fazla yıl kullanılan büyük yatırımlar bu kapsamda. Sarf malzemeleri Kat.1\'e girer.',
      en: 'Large investments used for more than one year — buildings, machinery, vehicles, IT infrastructure. Consumables go in Cat.1.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    nextByValue: { yes: 'K3C2-1', no: 'K3C3-INFO' },
  },
  {
    id: 'K3C2-1',
    number: 86,
    stage: 5,
    block: '5B',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'compound',
    required: true,
    reportField: 'scope3.cat2.items',
    text: {
      tr: 'Satın aldığınız sermaye malı kategorileri, yıl ve harcama tutarı?',
      en: 'Capital goods category, purchase year and spend amount?',
    },
    helper: {
      tr: 'Her varlık için kategori, satın alma yılı ve tutarı girin. Yıl bu raporlama yılıyla eşleşmiyorsa dışarıda bırakılır — GHG Protocol Kat.2 kuralı.',
      en: 'Enter category, purchase year and amount for each asset. If the year does not match this reporting year it is excluded — GHG Protocol Cat.2 rule.',
    },
    placeholder: { tr: 'Kategori: Bina | Yıl: 2025 | Tutar: 2.800.000 TL', en: 'Category: Building | Year: 2025 | Amount: 2,800,000 TL' },
    fields: [
      {
        id: 'category',
        type: 'select',
        required: true,
        options: [
          { value: 'CG-01', label: { tr: 'CG-01 — Bina ve inşaat', en: 'CG-01 — Buildings and construction' } },
          { value: 'CG-02', label: { tr: 'CG-02 — Makine ve üretim ekipmanı', en: 'CG-02 — Machinery and production equipment' } },
          { value: 'CG-03', label: { tr: 'CG-03 — Araç (üretim emisyonu — kullanım K1\'de)', en: 'CG-03 — Vehicle (production emission — use in K1)' } },
          { value: 'CG-04', label: { tr: 'CG-04 — BT altyapısı ve veri merkezi', en: 'CG-04 — IT infrastructure and data centre' } },
          { value: 'CG-05', label: { tr: 'CG-05 — Enerji üretim sistemleri (güneş, rüzgar vb.)', en: 'CG-05 — Energy generation systems (solar, wind, etc.)' } },
          { value: 'CG-06', label: { tr: 'CG-06 — Endüstriyel altyapı', en: 'CG-06 — Industrial infrastructure' } },
          { value: 'CG-07', label: { tr: 'CG-07 — Tıbbi ve laboratuvar ekipmanı', en: 'CG-07 — Medical and laboratory equipment' } },
          { value: 'CG-08', label: { tr: 'CG-08 — Diğer sermaye malları', en: 'CG-08 — Other capital goods' } },
        ],
      },
      { id: 'purchase_year', type: 'numeric', required: true },
      { id: 'spend_amount', type: 'numeric', required: true },
      { id: 'currency', type: 'select', required: true, options: [{ value: 'TL' }, { value: 'USD' }, { value: 'EUR' }] },
    ],
    systemMessages: {
      year_mismatch: {
        tr: 'GHG Protocol Kat.2\'ye göre bu varlık girilen yıl raporuna girer, bu raporlama döneminize dahil edilmeyecek.',
        en: 'Per GHG Protocol Cat.2, this asset belongs to the entered year\'s report and will not be included in this reporting period.',
      },
      large_investment: {
        tr: 'Bu yatırım tutarı dikkat çekici büyüklükte. Raporda \'olağandışı sermaye yatırımı\' notu eklemenizi öneririz.',
        en: 'This investment amount is notably large. We recommend adding an \'extraordinary capital investment\' note to the report.',
      },
    },
    next: 'K3C3-INFO',
  },
  {
    id: 'K3C3-INFO',
    number: 87,
    stage: 5,
    block: '5C',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat3.confirmed',
    text: {
      tr: 'Kategori 3 otomatik hesaplandı — onayınızı bekliyoruz.',
      en: 'Category 3 calculated automatically — please confirm.',
    },
    helper: {
      tr: 'Kapsam 1 yakıt verilerinizden DEFRA WTT faktörleri, Kapsam 2 elektrik verilerinizden IEA T&D kayıp oranları kullanılarak Kategori 3 otomatik hesaplandı.',
      en: 'Category 3 was automatically calculated using DEFRA WTT factors from your Scope 1 fuel data and IEA T&D loss rates from your Scope 2 electricity data.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet, doğru — onayla', en: 'Yes, correct — confirm' } },
      { value: 'custom', label: { tr: 'Hayır, farklı bir WTT/T&D faktörü kullanmak istiyorum', en: 'No, I want to use a different WTT/T&D factor' } },
    ],
    systemMessages: {
      onLoad: {
        tr: 'Kategori 3 hesabı: K1 yakıt tüketimi × DEFRA WTT faktörleri + K2 elektrik × IEA T&D kayıp oranı (Türkiye: %14.8). Kaynak: DEFRA 2023 + IEA 2023.',
        en: 'Cat.3 calculation: K1 fuel × DEFRA WTT factors + K2 electricity × IEA T&D loss rate (Turkey: 14.8%). Source: DEFRA 2023 + IEA 2023.',
      },
    },
    next: 'K3C4-0',
  },
  {
    id: 'K3C4-0',
    number: 88,
    stage: 5,
    block: '5D',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat4.applicable',
    text: {
      tr: 'Mal veya hammaddeleriniz dışarıdan taşınarak size ulaşıyor mu?',
      en: 'Are goods or raw materials transported to you from external suppliers?',
    },
    helper: {
      tr: 'Tedarikçiden şirkete gelen her türlü kargo, nakliye ve kurye bu kapsamda. Kendi araçlarınızla yaptığınız taşıma K1\'e girer.',
      en: 'All cargo, freight and courier from suppliers to your company falls in this scope. Transport with your own vehicles goes in K1.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    nextByValue: { yes: 'K3C4-1', no: 'K3C5-0' },
  },
  {
    id: 'K3C4-1',
    number: 89,
    stage: 5,
    block: '5D',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat4.data_level',
    text: {
      tr: 'Upstream taşımacılık verisi hakkında ne kadar bilginiz var?',
      en: 'What level of upstream transport data do you have?',
    },
    helper: {
      tr: 'Seviyenizi seçin — en fazla bilginize uygun olanı. Daha düşük seviyeyle başlayıp sonra güncelleyebilirsiniz.',
      en: 'Select your level — the one that best matches your available data. You can start with a lower level and update later.',
    },
    options: [
      { value: 'S1', label: { tr: 'Lojistik firma GLEC/ISO 14083 emisyon raporu var — Seviye 1', en: 'Logistics company has GLEC/ISO 14083 emission report — Level 1' } },
      { value: 'S2', label: { tr: 'Sevkiyat detayı var (ton, km, mod) — Seviye 2', en: 'Shipment details available (tonnes, km, mode) — Level 2' } },
      { value: 'S3', label: { tr: 'Sadece lojistik fatura tutarım var — Seviye 3', en: 'Only logistics invoice amount available — Level 3' } },
    ],
    systemMessages: {
      s3_cat1_overlap: {
        tr: 'Kategori 1\'de lojistik hizmet harcaması girdiniz. Aynı tutarı buraya da girmeyin — çift sayım olur.',
        en: 'You entered logistics service spend in Category 1. Do not enter the same amount here — this causes double counting.',
      },
    },
    next: 'K3C5-0',
  },
  {
    id: 'K3C5-0',
    number: 90,
    stage: 5,
    block: '5E',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat5.applicable',
    text: {
      tr: 'Faaliyetlerinizden kaynaklanan atık var mı?',
      en: 'Do your operations generate waste?',
    },
    helper: {
      tr: 'Ofis kağıdı, ambalaj atığı, elektronik atık dahil neredeyse her şirketin atığı vardır. Bertaraf yöntemi emisyon büyüklüğünü dramatik biçimde etkiler.',
      en: 'Almost every company generates waste including office paper, packaging and e-waste. Disposal method dramatically affects emission magnitude.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      no_warning: {
        tr: 'Ofis kağıdı ve elektronik atık da bu kapsama girer. Emin misiniz?',
        en: 'Office paper and e-waste also fall in this scope. Are you sure?',
      },
    },
    nextByValue: { yes: 'K3C5-1', no: 'K3C6-0' },
  },
  {
    id: 'K3C5-1',
    number: 91,
    stage: 5,
    block: '5E',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat5.data_level',
    text: {
      tr: 'Atık verisi hakkında bilgi düzeyiniz ve atık türleriniz?',
      en: 'What is your data level and waste types?',
    },
    helper: {
      tr: 'Veri düzeyinizi seçip ardından sahip olduğunuz atık türlerini işaretleyin. Her tür için miktar ve bertaraf yöntemi soracağız.',
      en: 'Select your data level then mark the waste types you have. We will ask for quantity and disposal method for each type.',
    },
    options: [
      { value: 'S1', label: { tr: 'Bertaraf firması emisyon beyanı var — Seviye 1', en: 'Disposal company emission declaration available — Level 1' } },
      { value: 'S2_type', label: { tr: 'Atık türü ve miktarı biliyorum — Seviye 2', en: 'I know waste type and quantity — Level 2' } },
      { value: 'S2_total', label: { tr: 'Genel toplam miktar biliyorum — Seviye 2 (karma EF)', en: 'I know total quantity only — Level 2 (blended EF)' } },
      { value: 'S3', label: { tr: 'Hiç bilgim yok — Seviye 3 (çalışan başına tahmin)', en: 'No data — Level 3 (per-employee estimate)' } },
    ],
    systemMessages: {
      metal_recycling: {
        tr: 'Metal geri dönüşümü negatif emisyon üretir (alüminyum: -9.100 kg CO₂e/ton). Bu değer toplam Kapsam 3 emisyonunuzu azaltır.',
        en: 'Metal recycling produces negative emissions (aluminium: -9,100 kg CO₂e/tonne). This value reduces your total Scope 3 emissions.',
      },
    },
    next: 'K3C6-0',
  },
  {
    id: 'K3C6-0',
    number: 92,
    stage: 5,
    block: '5F',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat6.applicable',
    text: {
      tr: 'Çalışanlarınız iş amaçlı seyahat ediyor mu?',
      en: 'Do your employees travel for business purposes?',
    },
    helper: {
      tr: 'Uçak, tren, kiralık araç, otel konaklaması hepsi bu kapsamda. Kurumsal seyahat kartı veya seyahat acentesi raporu varsa çok hızlı bitirirsiniz.',
      en: 'Flights, trains, rental cars, hotel stays all fall in this scope. If you have a corporate travel card or agency report, this will be quick.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    nextByValue: { yes: 'K3C6-1', no: 'K3C7-0' },
  },
  {
    id: 'K3C6-1',
    number: 93,
    stage: 5,
    block: '5F',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat6.data_level',
    text: {
      tr: 'Seyahat verisi düzeyi ve kullanılan modlar?',
      en: 'Travel data level and modes used?',
    },
    helper: {
      tr: 'Acente raporu varsa tıklayın ve bitirin. Yoksa hangi seyahat modlarını kullandığınızı işaretleyin.',
      en: 'If you have an agency report, click and finish. Otherwise mark which travel modes you used.',
    },
    options: [
      { value: 'S1', label: { tr: 'Seyahat acentesi / platform emisyon raporu (SAP Concur, TravelPerk vb.) — Seviye 1', en: 'Travel agency / platform emission report (SAP Concur, TravelPerk, etc.) — Level 1' } },
      { value: 'S2', label: { tr: 'Mod ve mesafe bazlı veri var — Seviye 2', en: 'Mode and distance-based data available — Level 2' } },
      { value: 'S3', label: { tr: 'Sadece harcama verisi var — Seviye 3', en: 'Only spend data available — Level 3' } },
    ],
    systemMessages: {
      aviation_cabin: {
        tr: 'Havayolunda kabin sınıfı emisyonu büyük etkiler: Economy 1x · Business 2.9x · First 4x (DEFRA 2023). Sınıf bilgisi bilinmiyorsa Economy varsayılanı uygulanır.',
        en: 'Aviation cabin class has a large emission impact: Economy 1x · Business 2.9x · First 4x (DEFRA 2023). If class unknown, Economy default is applied.',
      },
      rfi_info: {
        tr: 'Radyatif Zorlama Faktörü (RFI=1.9x): Yüksek irtifada uçuşların ek iklim etkisini kapsar. DEFRA öneriyor, GHG Protocol zorunlu tutmuyor. Tercihini raporda belgeliyoruz.',
        en: 'Radiative Forcing Index (RFI=1.9x): Covers the additional climate impact of high-altitude flights. DEFRA recommends, GHG Protocol does not require. Your choice is documented in the report.',
      },
    },
    next: 'K3C7-0',
  },
  {
    id: 'K3C7-0',
    number: 94,
    stage: 5,
    block: '5G',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat7.data_source',
    text: {
      tr: 'Çalışanlar işe nasıl geliyor? Commute anketi yapıldı mı?',
      en: 'How do employees commute? Has a commute survey been conducted?',
    },
    helper: {
      tr: 'Anket veriniz varsa daha doğru. Yoksa şehir ve sektör bazlı modal split tahmini uygularız. Elektrikli araç kullanım oranı da girebilirsiniz.',
      en: 'If you have survey data, results will be more accurate. Otherwise we apply a city and sector-based modal split estimate. You can also enter EV usage rate.',
    },
    options: [
      { value: 'survey', label: { tr: 'Evet — anket veya çalışan verisi var', en: 'Yes — survey or employee data available' } },
      { value: 'estimate', label: { tr: 'Hayır — tahmin kullanacağız', en: 'No — we will use an estimate' } },
    ],
    systemMessages: {
      istanbul_split: {
        tr: 'İstanbul modal split tahmini: Özel araç %45 · Toplu taşıma %40 · Diğer %15. Ortalama mesafe: 18 km. Bu değerleri düzenleyebilirsiniz.',
        en: 'Istanbul modal split estimate: Private car 45% · Public transport 40% · Other 15%. Average distance: 18 km. You can adjust these values.',
      },
      hybrid_work: {
        tr: 'Hybrid çalışma modeli varsa ofis günleri commute EF, uzaktan günler ise DEFRA ev ofis EF (2.49 kg CO₂e/gün) uygulanır. Yıllık ofis gün sayısını belirtin.',
        en: 'For hybrid models, commute EF applies on office days and DEFRA home office EF (2.49 kg CO₂e/day) on remote days. Specify annual office day count.',
      },
    },
    next: 'K3C8-0',
  },
  {
    id: 'K3C8-0',
    number: 95,
    stage: 5,
    block: '5H',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat8.applicable',
    text: {
      tr: 'Kiralık bina veya uzun dönem kiralık ekipmanınız var mı?',
      en: 'Do you lease any buildings or long-term equipment?',
    },
    helper: {
      tr: 'D3=Operasyonel Kontrol seçtiyseniz kiralık binalarınız zaten K1\'de raporlandı — bu kategori büyük olasılıkla boş kalacak.',
      en: 'If you selected D3=Operational Control, your leased buildings are already reported in K1 — this category will likely be empty.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      operational_control_note: {
        tr: 'Operasyonel Kontrol yaklaşımı seçtiğinizden kiralık binalarınız büyük olasılıkla K1\'de raporlandı. Bu kategori yalnızca K1\'e dahil edilemeyen kiralık varlıklar içindir.',
        en: 'Since you selected Operational Control, leased buildings are likely already in K1. This category is only for leased assets that could not be included in K1.',
      },
    },
    nextByValue: { yes: 'K3C8-1', no: 'K3C9-0' },
  },
  {
    id: 'K3C8-1',
    number: 96,
    stage: 5,
    block: '5H',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'compound',
    required: true,
    reportField: 'scope3.cat8.assets',
    text: {
      tr: 'Kiralık varlık türü, alanı ve bina sahibi enerji beyanı?',
      en: 'Leased asset type, area and building owner energy declaration?',
    },
    helper: {
      tr: 'Alan (m²) × REEB bina tipi EF = tCO₂e (Seviye 2). Bina sahibinden enerji tüketim belgesi alınabilirse Seviye 1\'e geçilir.',
      en: 'Area (m²) × REEB building type EF = tCO₂e (Level 2). If an energy certificate can be obtained from the building owner, upgrade to Level 1.',
    },
    placeholder: { tr: 'Tür: Ofis binası | Alan: 350 m² | Beyan: Hayır', en: 'Type: Office building | Area: 350 m² | Declaration: No' },
    fields: [
      {
        id: 'asset_type',
        type: 'select',
        required: true,
        options: [
          { value: 'KV-01', label: { tr: 'KV-01 — Kiralık ofis binası', en: 'KV-01 — Leased office building' } },
          { value: 'KV-02', label: { tr: 'KV-02 — Kiralık üretim/fabrika', en: 'KV-02 — Leased production/factory' } },
          { value: 'KV-03', label: { tr: 'KV-03 — Kiralık depo/lojistik', en: 'KV-03 — Leased warehouse/logistics' } },
          { value: 'KV-04', label: { tr: 'KV-04 — Kiralık ekipman (uzun dönem)', en: 'KV-04 — Leased equipment (long-term)' } },
          { value: 'KV-05', label: { tr: 'KV-05 — Kiralık veri merkezi/co-location', en: 'KV-05 — Leased data centre/co-location' } },
        ],
      },
      { id: 'area_m2', type: 'numeric', required: true },
      { id: 'owner_declaration', type: 'boolean', required: true },
      { id: 'declaration_kwh', type: 'numeric', required: false, conditionalOn: 'owner_declaration' },
    ],
    next: 'K3C9-0',
  },
  {
    id: 'K3C9-0',
    number: 97,
    stage: 5,
    block: '5I',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat9.applicable',
    text: {
      tr: 'Müşterilere veya dağıtım kanallarına mal gönderiliyor mu?',
      en: 'Are goods shipped to customers or distribution channels?',
    },
    helper: {
      tr: 'Şirketten müşteriye giden her türlü nakliye bu kapsamda. Kat.4 (upstream) ile fark: bu sefer siz gönderensiniz.',
      en: 'All freight from the company to customers falls in this scope. Difference from Cat.4 (upstream): this time you are the sender.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      glec_info: {
        tr: 'Kat.4 ile aynı yapıyı kullanacağız: GLEC Framework emisyon faktörleri, taşıma modu ve ton-km verisi.',
        en: 'We will use the same structure as Cat.4: GLEC Framework emission factors, transport mode and tonne-km data.',
      },
    },
    next: 'K3C10-0',
  },
  {
    id: 'K3C10-0',
    number: 98,
    stage: 5,
    block: '5J',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat10.applicable',
    text: {
      tr: 'Sattığınız ürünler müşteri tarafından daha fazla işleniyor mu?',
      en: 'Are your sold products further processed by customers?',
    },
    helper: {
      tr: 'Ara ürün satıyorsanız bu kategori geçerlidir. Müşteri firmanın proses emisyonu burada raporlanır. Hizmet sektörü (NACE G-N) için genellikle uygulanamaz.',
      en: 'This category applies if you sell intermediate products. Customer processing emissions are reported here. Usually not applicable for service sector (NACE G-N).',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — müşteri proses yapıyor', en: 'Yes — customer processes further' } },
      { value: 'no', label: { tr: 'Hayır — son ürün satıyoruz', en: 'No — we sell final products' } },
    ],
    next: 'K3C11-0',
  },
  {
    id: 'K3C11-0',
    number: 99,
    stage: 5,
    block: '5K',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat11.applicable',
    text: {
      tr: 'Sattığınız ürünler kullanım aşamasında emisyon üretiyor mu?',
      en: 'Do your sold products generate emissions during use?',
    },
    helper: {
      tr: 'Yakıt, araç, elektrikli cihaz, HVAC ekipmanı gibi kullanımda enerji tüketen ürünler bu kapsama girer. Enerji şirketleri için en büyük Kapsam 3 kalemi olabilir.',
      en: 'Products that consume energy during use — fuels, vehicles, electrical appliances, HVAC equipment — fall in this scope. Can be the largest Scope 3 item for energy companies.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      fuel_product_note: {
        tr: 'Yakıt veya enerji ürünü satıyorsanız bu genellikle Kapsam 3\'ün en büyük kalemidir. Satış hacmi × yakıt EF × müşteri kullanım oranı hesaplanır.',
        en: 'If you sell fuel or energy products, this is typically the largest Scope 3 item. Calculation: sales volume × fuel EF × customer usage rate.',
      },
    },
    nextByValue: { yes: 'K3C11-1', no: 'K3C12-0' },
  },
  {
    id: 'K3C11-1',
    number: 100,
    stage: 5,
    block: '5K',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'compound',
    required: true,
    reportField: 'scope3.cat11.products',
    text: {
      tr: 'Ürün tipi, satış hacmi ve ortalama kullanım ömrü?',
      en: 'Product type, sales volume and average use lifetime?',
    },
    helper: {
      tr: 'Kullanım ömrü bilinmiyorsa sektör standardı uygulanır. LCA belgesi varsa Seviye 1\'e geçilir.',
      en: 'If use lifetime is unknown, sector standard is applied. If an LCA certificate is available, upgrade to Level 1.',
    },
    placeholder: { tr: 'Ürün: Elektrikli ısıtıcı | Satış: 1.200 adet | Ömür: 10 yıl', en: 'Product: Electric heater | Sales: 1,200 units | Lifetime: 10 years' },
    fields: [
      {
        id: 'product_type',
        type: 'select',
        required: true,
        options: [
          { value: 'P-01', label: { tr: 'P-01 — Yakıt ve enerji ürünleri (doğrudan — en yüksek emisyon)', en: 'P-01 — Fuel and energy products (direct — highest emission)' } },
          { value: 'P-02', label: { tr: 'P-02 — Motorlu taşıtlar (kullanım yakıt emisyonu)', en: 'P-02 — Motor vehicles (use-phase fuel emission)' } },
          { value: 'P-03', label: { tr: 'P-03 — Elektrikli cihazlar ve ev aletleri', en: 'P-03 — Electrical appliances and household devices' } },
          { value: 'P-04', label: { tr: 'P-04 — Binalarda kullanılan ürünler (HVAC vb.)', en: 'P-04 — Products used in buildings (HVAC, etc.)' } },
          { value: 'P-05', label: { tr: 'P-05 — Diğer kullanımda enerji tüketen ürünler', en: 'P-05 — Other products consuming energy during use' } },
        ],
      },
      { id: 'sales_volume', type: 'numeric', required: true },
      { id: 'sales_unit', type: 'select', required: true, options: [{ value: 'units' }, { value: 'kg' }, { value: 'tonnes' }, { value: 'litres' }] },
      { id: 'use_lifetime_years', type: 'numeric', required: false },
      { id: 'lca_available', type: 'boolean', required: false },
    ],
    next: 'K3C12-0',
  },
  {
    id: 'K3C12-0',
    number: 101,
    stage: 5,
    block: '5L',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat12.applicable',
    text: {
      tr: 'Sattığınız ürünler fiziksel bir ürün mü?',
      en: 'Are your sold products physical goods (not services)?',
    },
    helper: {
      tr: 'Müşterinin ürünü bertaraf etmesi veya geri dönüştürmesinden kaynaklanan emisyonlar bu kapsamda. Hizmet şirketleri için genellikle uygulanamaz. Not: Kat.5 sizin sahanızdaki atık — bu ise müşterinin bertarafıdır.',
      en: 'Emissions from customers disposing of or recycling your products fall in this scope. Usually not applicable for service companies. Note: Cat.5 is waste at your site — this is customer disposal.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — fiziksel ürün satıyoruz', en: 'Yes — we sell physical products' } },
      { value: 'no', label: { tr: 'Hayır — hizmet satıyoruz', en: 'No — we sell services' } },
    ],
    next: 'K3C13-0',
  },
  {
    id: 'K3C13-0',
    number: 102,
    stage: 5,
    block: '5M',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat13.applicable',
    text: {
      tr: 'Herhangi bir varlığı başkasına kiraya veriyor musunuz?',
      en: 'Do you lease any assets to others?',
    },
    helper: {
      tr: 'Aşama 2\'de \'Kiracı yönetiyor\' seçilen tesisler bu kategoriye otomatik eklendi. Kiracıdan enerji tüketim verisi alınabiliyor mu?',
      en: 'Facilities where \'Tenant manages\' was selected in Stage 2 have been automatically added here. Can energy consumption data be obtained from the tenant?',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet / Otomatik tespit edildi', en: 'Yes / Automatically detected' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      auto_detect: {
        tr: 'Aşama 2\'de bu tesis için kiracı yönetiyor seçtiniz. Bu tesis Kategori 13 kapsamında. Kiracıdan enerji tüketim verisi alabilir misiniz?',
        en: 'In Stage 2 you selected \'tenant manages\' for this facility. It falls under Category 13. Can you obtain energy consumption data from the tenant?',
      },
    },
    next: 'K3C14-0',
  },
  {
    id: 'K3C14-0',
    number: 103,
    stage: 5,
    block: '5N',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat14.applicable',
    text: {
      tr: 'Franchise ağınızın emisyon verisi var mı?',
      en: 'Does your franchise network have emission data?',
    },
    helper: {
      tr: 'Franchise veren şirket olarak franchise işletmelerinin emisyonlarını raporlamalısınız. GHG raporu olan işletmelerde Seviye 1, yoksa sektörel ortalama uygulanır. Franchise modeliniz yoksa \'Uygulanamaz\'ı seçin.',
      en: 'As a franchisor you must report emissions from franchise operations. Level 1 for franchisees with GHG reports, otherwise sector average. If you have no franchise model, select Not applicable.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — franchise GHG raporları var (Seviye 1)', en: 'Yes — franchise GHG reports available (Level 1)' } },
      { value: 'no', label: { tr: 'Hayır — tahmin kullanacağız', en: 'No — we will use an estimate' } },
      { value: 'na', label: { tr: 'Uygulanamaz — franchise modelimiz yok', en: 'Not applicable — we have no franchise model' } },
    ],
    next: 'K3C15-0',
  },
  {
    id: 'K3C15-0',
    number: 104,
    stage: 5,
    block: '5O',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat15.applicable',
    text: {
      tr: 'Finansal yatırımlarınız var mı?',
      en: 'Do you have financial investments?',
    },
    helper: {
      tr: 'PCAF standardına göre hisse senedi, tahvil, gayrimenkul kredisi gibi finansal yatırımların emisyon payı hesaplanır. Finans sektörü için en kritik Kapsam 3 kategorisidir. NACE K dışındaki şirketler için opsiyoneldir.',
      en: 'Per PCAF standard, the emission share of financial investments (equities, bonds, real estate loans) is calculated. Most critical Scope 3 category for the finance sector. Optional for non-NACE K companies.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    systemMessages: {
      pcaf_info: {
        tr: 'PCAF (Partnership for Carbon Accounting Financials) standardı uygulanacak. Her varlık sınıfı için ayrı atıf formülü var. Yatırım tutarı ve portföy şirketlerin emisyon verisi soracağız.',
        en: 'PCAF (Partnership for Carbon Accounting Financials) standard will be applied. Each asset class has a separate attribution formula. We will ask for investment amount and portfolio company emission data.',
      },
    },
    nextByValue: { yes: 'K3C15-1', no: 'K3-TY' },
  },
  {
    id: 'K3C15-1',
    number: 105,
    stage: 5,
    block: '5O',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'compound',
    required: true,
    reportField: 'scope3.cat15.investments',
    text: {
      tr: 'Varlık sınıfı, yatırım tutarı ve şirket değeri?',
      en: 'Asset class, investment amount and company value?',
    },
    helper: {
      tr: 'PCAF Atıf Formülü: tCO₂e = (Yatırım / Şirket değeri + Borç) × Şirket toplam emisyonu. GHG raporu yoksa sektörel EF kullanılır.',
      en: 'PCAF Attribution Formula: tCO₂e = (Investment / Company value + Debt) × Company total emissions. If no GHG report, sector EF is used.',
    },
    placeholder: { tr: 'Sınıf: Hisse senedi | Tutar: 5M TL | Şirket değeri: 50M TL', en: 'Class: Equity | Amount: 5M TL | Company value: 50M TL' },
    fields: [
      {
        id: 'asset_class',
        type: 'select',
        required: true,
        options: [
          { value: 'VA-01', label: { tr: 'VA-01 — Halka açık hisse senetleri', en: 'VA-01 — Listed equities' } },
          { value: 'VA-02', label: { tr: 'VA-02 — Halka açık tahviller', en: 'VA-02 — Corporate bonds' } },
          { value: 'VA-03', label: { tr: 'VA-03 — Proje finansmanı', en: 'VA-03 — Project finance' } },
          { value: 'VA-04', label: { tr: 'VA-04 — Ticari gayrimenkul kredisi', en: 'VA-04 — Commercial real estate loan' } },
          { value: 'VA-05', label: { tr: 'VA-05 — İpotek / konut kredisi', en: 'VA-05 — Mortgage / home loan' } },
          { value: 'VA-06', label: { tr: 'VA-06 — Motorlu taşıt kredisi', en: 'VA-06 — Motor vehicle loan' } },
          { value: 'VA-07', label: { tr: 'VA-07 — Özel sermaye', en: 'VA-07 — Private equity' } },
        ],
      },
      { id: 'investment_amount', type: 'numeric', required: true },
      { id: 'company_value', type: 'numeric', required: true },
      { id: 'company_debt', type: 'numeric', required: false },
      { id: 'ghg_report_available', type: 'boolean', required: true },
      { id: 'company_emissions_tco2e', type: 'numeric', required: false, conditionalOn: 'ghg_report_available' },
    ],
    systemMessages: {
      pcaf_calc: {
        tr: 'PCAF atıf hesabı: ([Yatırım] / ([Şirket değeri] + [Borç])) × [Şirket emisyonu] = [tCO₂e]. PCAF veri kalitesi skoru: [1–5].',
        en: 'PCAF attribution: ([Investment] / ([Company value] + [Debt])) × [Company emissions] = [tCO₂e]. PCAF data quality score: [1–5].',
      },
    },
    next: 'K3-TY',
  },
  {
    id: 'K3-TY',
    number: 106,
    stage: 5,
    block: '5P',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.confirmed',
    text: {
      tr: 'Kapsam 3 özeti: Tüm kategoriler ve miktarlar doğru mu?',
      en: 'Scope 3 summary: Are all categories and quantities correct?',
    },
    helper: {
      tr: 'Tüm Kapsam 3 kategorileriniz özetlendi. Düzenleme yapabilir, atlanan kategorileri sonradan ekleyebilirsiniz.',
      en: 'All your Scope 3 categories are summarised. You can make edits or add skipped categories later.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Onayla — Kapsam 3 tamamlandı, Aşama 6\'ya geç', en: 'Confirm — Scope 3 complete, proceed to Stage 6' } },
      { value: 'edit', label: { tr: 'Düzenle — Bir kategoriyi değiştirmek istiyorum', en: 'Edit — I want to change a category' } },
      { value: 'add_category', label: { tr: 'Kategori ekle — Atladığım bir kategori var', en: 'Add category — I skipped a category' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    systemMessages: {
      success: {
        tr: 'Kapsam 3 tamamlandı! Toplam: [X tCO₂e] ([N] kategori aktif). Veri kalitesi: %[S1] Seviye 1 · %[S2] Seviye 2 · %[S3] Seviye 3. En büyük kategori: [Kat.N] — [tCO₂e].',
        en: 'Scope 3 complete! Total: [X tCO₂e] ([N] categories active). Data quality: [S1]% Level 1 · [S2]% Level 2 · [S3]% Level 3. Largest category: [Cat.N] — [tCO₂e].',
      },
      high_s3_ratio: {
        tr: 'Verilerinizin %[X]\'i Seviye 3 (harcama bazlı tahmin). Raporunuzu iyileştirmek için hangi kategorilerde tedarikçi verisi toplayabileceğinizi görmek ister misiniz?',
        en: '[X]% of your data is Level 3 (spend-based estimate). Would you like to see which categories you can improve by collecting supplier data?',
      },
    },
    nextByValue: { confirmed: '6-GİRİŞ', edit: 'K3C1-0', add_category: 'K3C1-0' },
  },

  // ── STAGE 6 ─ Exclusions, Assumptions, Exceptions ────────────────────────
  // 16 questions · #107–#122 · DOCX v3.0
  {
    id: '6-GİRİŞ',
    number: 107,
    stage: 6,
    block: '6-GİRİŞ',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 6 Giriş — Son adımlar: veri kalitesi, hariç tutmalar, istisnalar ve ISO uyum kontrolleri.',
      en: 'Stage 6 Introduction — Final steps: data quality, exclusions, exceptions and ISO compliance checks.',
    },
    helper: {
      tr: 'Aşama 6, tüm veri girişi bittikten sonra çalışır. 6 bölümden oluşur: (6A) Hariç tutulan varlıklar · (6B) Kabuller · (6C) İstisnalar · (6D) %5 materyal eşiği · (6E) Belirsizlik analizi · (6F) Baz yıl politikası. Bu aşama raporunuzun ISO 14064-1 uyumunu güvence altına alır.',
      en: 'Stage 6 runs after all data entry is complete. It consists of 6 sections: (6A) Excluded entities · (6B) Assumptions · (6C) Exceptions · (6D) 5% materiality threshold · (6E) Uncertainty analysis · (6F) Base year policy. This stage ensures your report\'s ISO 14064-1 compliance.',
    },
    options: [{ value: 'start', label: { tr: 'Başlayalım', en: "Let's Start" } }],
    next: '6A-1',
  },
  // ── Stage 6-A: System-Flagged Exclusions ─────────────────────────────────
  // #108
  {
    id: '6A-1',
    number: 108,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'exclusions.flagged',
    text: {
      tr: 'Sistem, envanter sınırınızın dışında kalan varlıklar veya tesisler tespit etti. Bu hariç tutmaları onaylamak ve belgelemek ister misiniz?',
      en: 'The system detected entities or facilities outside your inventory boundary. Would you like to confirm and document these exclusions?',
    },
    helper: {
      tr: 'ISO 14064-1 §5.1 uyarınca, önemli GHG kaynakları hariç tutuluyorsa bunların gerekçesiyle birlikte belgelenmesi zorunludur.',
      en: 'Under ISO 14064-1 §5.1, if significant GHG sources are excluded, they must be documented with justification.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — belgelemek istiyorum', en: 'Yes — I want to document them' } },
      { value: 'none_flagged', label: { tr: 'Hayır — hariç tutma yok', en: 'No — no exclusions' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: { yes: '6A-2', none_flagged: '6B-OV' },
  },
  // #109
  {
    id: '6A-2',
    number: 109,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'exclusions.reason_type',
    text: {
      tr: 'Hariç tutmanın temel gerekçesi nedir?',
      en: 'What is the main reason for the exclusion?',
    },
    helper: {
      tr: 'ISO 14064-1, hariç tutma gerekçelerini şu kategorilerde belgeler: operasyonel kontrol dışı, veri erişilemez, materyalite eşiği altında, yasal engel, teknik sınırlama veya diğer.',
      en: 'ISO 14064-1 documents exclusion reasons in the following categories: outside operational control, data inaccessible, below materiality threshold, legal barrier, technical limitation, or other.',
    },
    options: [
      { value: 'not_controlled', label: { tr: 'Operasyonel kontrol dışında', en: 'Outside operational control' }, isoRef: '§5.1a' },
      { value: 'no_data', label: { tr: 'Veri erişilemez', en: 'Data inaccessible' }, isoRef: '§5.1b' },
      { value: 'materiality', label: { tr: 'Materyalite eşiği altında (<%5)', en: 'Below materiality threshold (<5%)' }, isoRef: '§5.1c' },
      { value: 'legal', label: { tr: 'Yasal veya idari engel', en: 'Legal or regulatory barrier' }, isoRef: '§5.1d' },
      { value: 'technical', label: { tr: 'Teknik sınırlama', en: 'Technical limitation' }, isoRef: '§5.1e' },
      { value: 'other', label: { tr: 'Diğer', en: 'Other' }, isoRef: '§5.1f' },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir gerekçe seçin.', en: 'Please select a reason.' },
    },
    next: '6A-3',
  },
  // #110
  {
    id: '6A-3',
    number: 110,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: true,
    maxLength: 500,
    reportField: 'exclusions.justification',
    text: {
      tr: 'Hariç tutma gerekçenizi açıklayın (işletme gerekçesi).',
      en: 'Describe your exclusion justification (business justification).',
    },
    placeholder: {
      tr: 'Örn: İlgili tesis kiralamalı ve operasyonel kontrolümüz yoktur; bağımsız denetimden geçirilmiş veri temin edilememektedir.',
      en: 'Example: The facility is leased and we have no operational control; independently audited data cannot be obtained.',
    },
    helper: {
      tr: 'ISO 14064-1 §5.1 uyarınca işletme gerekçesi açık, ölçülebilir ve doğrulanabilir olmalıdır.',
      en: 'Under ISO 14064-1 §5.1, the business justification must be clear, measurable, and verifiable.',
    },
    validate: {
      requiredMessage: { tr: 'Lütfen gerekçeyi açıklayın.', en: 'Please describe the justification.' },
    },
    next: '6A-4',
  },
  // #111
  {
    id: '6A-4',
    number: 111,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'exclusions.emission_band',
    text: {
      tr: 'Hariç tutulan kaynağın tahmini emisyon payı nedir?',
      en: 'What is the estimated emission share of the excluded source?',
    },
    helper: {
      tr: 'ISO 14064-1, hariç tutmaların toplam envanter üzerindeki kümülatif etkisini değerlendirmenizi zorunlu kılar.',
      en: 'ISO 14064-1 requires you to assess the cumulative impact of exclusions on the total inventory.',
    },
    options: [
      { value: 'lt1', label: { tr: '<%1 — ihmal edilebilir düzeyde', en: '<1% — negligible' } },
      { value: '1_5', label: { tr: '%1–5 — düşük etki', en: '1–5% — low impact' } },
      { value: '5_10', label: { tr: '%5–10 — orta etki', en: '5–10% — medium impact' } },
      { value: '10_20', label: { tr: '%10–20 — yüksek etki', en: '10–20% — high impact' } },
      { value: 'gt20', label: { tr: '>%20 — kritik düzeyde', en: '>20% — critical level' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir emisyon bandı seçin.', en: 'Please select an emission band.' },
    },
    next: '6A-5',
  },
  // #112
  {
    id: '6A-5',
    number: 112,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'exclusions.future_plan',
    text: {
      tr: 'Bu kaynağı gelecekte envanterinize dahil etmeyi planlıyor musunuz? (İsteğe bağlı)',
      en: 'Do you plan to include this source in future inventories? (Optional)',
    },
    placeholder: {
      tr: 'Örn: 2025 raporunda dahil edilmesi hedeflenmektedir; tedarikçi veri paylaşımı protokolü müzakeresindedir.',
      en: 'Example: Planned for inclusion in 2025 report; supplier data sharing protocol is under negotiation.',
    },
    helper: {
      tr: 'Gelecek dahil etme planı, hariç tutmaların geçici niteliğini belgeler ve iyileştirme taahhüdünü gösterir.',
      en: 'A future inclusion plan documents the temporary nature of exclusions and demonstrates an improvement commitment.',
    },
    next: '6A-6',
  },
  // #113
  {
    id: '6A-6',
    number: 113,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'exclusions.cumulative_check',
    text: {
      tr: 'Tüm hariç tutmaların kümülatif emisyon payı ISO 14064-1 §5.1 eşiğinin altında mı?',
      en: 'Is the cumulative emission share of all exclusions below the ISO 14064-1 §5.1 threshold?',
    },
    helper: {
      tr: 'ISO 14064-1 §5.1, kümülatif hariç tutma payının toplam Kapsam 1+2 emisyonlarının %5\'ini geçmemesi gerektiğini belirtir. Bu oran aşılırsa ek belgeleme gerekebilir.',
      en: 'ISO 14064-1 §5.1 states that the cumulative exclusion share must not exceed 5% of total Scope 1+2 emissions. Additional documentation may be required if this threshold is exceeded.',
    },
    options: [
      { value: 'ok', label: { tr: 'Evet — kümülatif pay <%5 (eşik altında)', en: 'Yes — cumulative share <5% (below threshold)' } },
      { value: 'go_back', label: { tr: 'Hayır — eşik aşılıyor, gözden geçirmem gerekiyor', en: 'No — threshold exceeded, I need to review' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen eşik durumunu belirtin.', en: 'Please specify the threshold status.' },
    },
    nextByValue: { ok: '6B-OV', go_back: '6A-1' },
  },

  // ── Stage 6-B: Assumptions Overview ──────────────────────────────────────
  // #114
  {
    id: '6B-OV',
    number: 114,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'assumptions.overview_decision',
    text: {
      tr: 'Sistem hesaplamalarınızda kullandığı metodolojik kabulleri otomatik olarak belgeledi. Kabulleri onaylıyor musunuz?',
      en: 'The system automatically documented the methodological assumptions used in your calculations. Do you approve the assumptions?',
    },
    helper: {
      tr: 'ISO 14064-1 §7.3, tüm önemli metodolojik kabullerin raporlanmasını zorunlu kılar. "Detay İncele" seçeneği her kabul için ayrıntılı inceleme ve düzenleme imkânı sunar.',
      en: 'ISO 14064-1 §7.3 requires all significant methodological assumptions to be reported. The "Review Details" option provides detailed review and editing for each assumption.',
    },
    options: [
      { value: 'approve_all', label: { tr: 'Tümünü Onayla — sistem kabullerini kabul ediyorum', en: 'Approve All — I accept system assumptions' } },
      { value: 'review_detail', label: { tr: 'Detay İncele — her kabulu tek tek gözden geçirim', en: 'Review Details — I\'ll review each assumption individually' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: { approve_all: '6C-1', review_detail: '6B-0' },
    next: '6C-1', // safe fallback for skip-loop (conditionalShow hidden path)
  },

  // ── Stage 6-C: Exceptions ─────────────────────────────────────────────────
  // #115
  {
    id: '6C-1',
    number: 115,
    stage: 6,
    block: '6C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'exceptions.type',
    text: {
      tr: 'Envanter kapsamınızda standart metodolojiden sapma (istisna) uyguladığınız bir alan var mı?',
      en: 'Are there any areas in your inventory scope where you applied a deviation (exception) from the standard methodology?',
    },
    helper: {
      tr: 'İstisna; belirlenen sınır, metodoloji veya emisyon faktörünün yerine farklı bir yaklaşım kullanılmasıdır. ISO 14064-1 §5.2, istisnalar için gerekçe ve materyal eşiği değerlendirmesini zorunlu kılar.',
      en: 'An exception is the use of a different approach instead of the established boundary, methodology, or emission factor. ISO 14064-1 §5.2 requires justification and materiality threshold assessment for exceptions.',
    },
    options: [
      { value: 'none', label: { tr: 'Hayır — standart metodoloji kullanıldı', en: 'No — standard methodology applied' } },
      { value: 'ef_deviation', label: { tr: 'Evet — farklı emisyon faktörü kullanıldı', en: 'Yes — different emission factor used' } },
      { value: 'boundary_deviation', label: { tr: 'Evet — sınır kararında sapma var', en: 'Yes — deviation in boundary decision' } },
      { value: 'methodology_deviation', label: { tr: 'Evet — metodolojik sapma var', en: 'Yes — methodological deviation' } },
      { value: 'multiple', label: { tr: 'Evet — birden fazla istisna var', en: 'Yes — multiple exceptions exist' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: { none: '6D-1', ef_deviation: '6C-2', boundary_deviation: '6C-2', methodology_deviation: '6C-2', multiple: '6C-2' },
  },
  // #116
  {
    id: '6C-2',
    number: 116,
    stage: 6,
    block: '6C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'compound',
    required: true,
    reportField: 'exceptions.detail',
    text: {
      tr: 'İstisnanın ayrıntılarını ve materyalite değerlendirmesini girin.',
      en: 'Enter the details of the exception and the materiality assessment.',
    },
    helper: {
      tr: 'ISO 14064-1 §5.2, her istisna için: (a) gerekçe, (b) kullanılan alternatif yaklaşım ve (c) sonuçlara etkisinin değerlendirilmesini zorunlu kılar.',
      en: 'ISO 14064-1 §5.2 requires for each exception: (a) justification, (b) alternative approach used, and (c) assessment of impact on results.',
    },
    fields: [
      {
        id: 'exception_description',
        type: 'text',
        subtype: 'multi_line',
        required: true,
        maxLength: 400,
        label: { tr: 'İstisnanın açıklaması', en: 'Exception description' },
        placeholder: { tr: 'Hangi kaynakta, hangi metodoloji yerine hangisi kullanıldı?', en: 'Which source, which methodology was replaced by which alternative?' },
      },
      {
        id: 'materiality_pct',
        type: 'text',
        subtype: 'numeric',
        required: true,
        maxLength: 5,
        label: { tr: 'Toplam emisyonlara tahmini etki (%)', en: 'Estimated impact on total emissions (%)' },
        placeholder: { tr: 'Örn: 2.5', en: 'Example: 2.5' },
      },
      {
        id: 'justification',
        type: 'text',
        subtype: 'multi_line',
        required: true,
        maxLength: 400,
        label: { tr: 'Gerekçe / işletme gerekçesi', en: 'Justification / business justification' },
        placeholder: { tr: 'Neden standart metodoloji yerine bu yaklaşım benimsendi?', en: 'Why was this approach adopted instead of the standard methodology?' },
      },
    ],
    next: '6C-3',
  },
  // #117
  {
    id: '6C-3',
    number: 117,
    stage: 6,
    block: '6C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'exceptions.improvement_commitment',
    text: {
      tr: 'Bu istisna için gelecek dönemde iyileştirme taahhüdünüz var mı? (İsteğe bağlı)',
      en: 'Do you have an improvement commitment for this exception in the future period? (Optional)',
    },
    placeholder: {
      tr: 'Örn: 2025 döneminde tedarikçiden birincil veri toplanacak; istisna kaldırılacak.',
      en: 'Example: Primary data will be collected from the supplier in the 2025 period; the exception will be removed.',
    },
    helper: {
      tr: 'İyileştirme taahhüdü, raporunuzu doğrulayacak üçüncü taraf denetçilere olumlu bir sinyal verir.',
      en: 'An improvement commitment sends a positive signal to third-party auditors who will verify your report.',
    },
    next: '6D-1',
  },

  // ── Stage 6-D: 5% Materiality Final Check ────────────────────────────────
  // #118
  {
    id: '6D-1',
    number: 118,
    stage: 6,
    block: '6D',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'materiality.final_check',
    text: {
      tr: 'Tüm hariç tutmalar ve istisnalar dahil edildiğinde, toplam belirsizlik ve veri boşluğu envanterinizin %5\'inin altında mı kalıyor?',
      en: 'Including all exclusions and exceptions, does the total uncertainty and data gap remain below 5% of your inventory?',
    },
    helper: {
      tr: 'ISO 14064-1, kümülatif materyal eşiğini %5 olarak belirler. Bu eşiğin aşılması durumunda ek veri toplama veya metodoloji revizyonu önerilir.',
      en: 'ISO 14064-1 sets the cumulative materiality threshold at 5%. If this threshold is exceeded, additional data collection or methodology revision is recommended.',
    },
    options: [
      { value: 'ok', label: { tr: 'Evet — kümülatif belirsizlik <%5 (eşik altında)', en: 'Yes — cumulative uncertainty <5% (below threshold)' } },
      { value: 'go_back', label: { tr: 'Hayır — gözden geçirmem ve düzeltmem gerekiyor', en: 'No — I need to review and correct' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen eşik durumunu onaylayın.', en: 'Please confirm the threshold status.' },
    },
    nextByValue: { ok: '6E-1', go_back: '6A-1' },
  },

  // ── Stage 6-E: Uncertainty Analysis ──────────────────────────────────────
  // #119
  {
    id: '6E-1',
    number: 119,
    stage: 6,
    block: '6E',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 600,
    reportField: 'uncertainty.improvement_plan',
    text: {
      tr: 'Veri kalitesi ve belirsizliği azaltmak için planlanan iyileştirmeleriniz var mı? (İsteğe bağlı)',
      en: 'Are there any planned improvements to reduce data quality and uncertainty? (Optional)',
    },
    placeholder: {
      tr: 'Örn: Kapsam 3 Kat.1 için tedarikçi anket sistemi 2025\'te devreye alınacak; doğal gaz sayaçları akıllı sisteme geçirilecek.',
      en: 'Example: Supplier survey system for Scope 3 Cat.1 will go live in 2025; natural gas meters will be upgraded to smart system.',
    },
    helper: {
      tr: 'ISO 14064-1 §7.3, belirsizlik değerlendirmesi ve sürekli iyileştirme taahhüdünü raporlamanızı teşvik eder.',
      en: 'ISO 14064-1 §7.3 encourages you to report uncertainty assessment and continuous improvement commitments.',
    },
    next: '6F-1',
  },

  // ── Stage 6-F: Base Year & Structural Changes ─────────────────────────────
  // #120
  {
    id: '6F-1',
    number: 120,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'multi_select',
    required: true,
    reportField: 'base_year.structural_changes',
    text: {
      tr: 'Raporlama döneminde organizasyon yapınızda önemli değişiklikler oldu mu?',
      en: 'Were there any significant changes in your organizational structure during the reporting period?',
    },
    helper: {
      tr: 'ISO 14064-1 §5.4, baz yıl yeniden hesaplamasını tetikleyen yapısal değişiklikleri tanımlar: birleşme/satın alma, tesis açma/kapama, dış kaynak kullanımı değişikliği, kontrol metodolojisi değişikliği.',
      en: 'ISO 14064-1 §5.4 identifies structural changes that trigger base year recalculation: mergers/acquisitions, facility opening/closing, outsourcing changes, control methodology changes.',
    },
    options: [
      { value: 'none', exclusive: true, label: { tr: 'Hayır — önemli değişiklik yok', en: 'No — no significant changes' } },
      { value: 'merger', label: { tr: 'Birleşme veya satın alma', en: 'Merger or acquisition' } },
      { value: 'divestiture', label: { tr: 'Satış veya elden çıkarma (divest)', en: 'Sale or divestiture' } },
      { value: 'facility_open', label: { tr: 'Yeni tesis açıldı', en: 'New facility opened' } },
      { value: 'facility_close', label: { tr: 'Tesis kapatıldı', en: 'Facility closed' } },
      { value: 'outsource_change', label: { tr: 'Dış kaynak kullanımı değişti', en: 'Outsourcing changed' } },
      { value: 'control_method', label: { tr: 'Kontrol metodolojisi değişti', en: 'Control methodology changed' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen en az bir seçenek belirtin.', en: 'Please specify at least one option.' },
    },
    nextByValue: { none: '7-GİRİŞ' },
    next: '6F-2',
  },
  // #121
  {
    id: '6F-2',
    number: 121,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'base_year.materiality_test',
    text: {
      tr: 'Yapısal değişikliklerin toplam emisyonlar üzerindeki etkisi %5\'i aşıyor mu?',
      en: 'Does the impact of structural changes on total emissions exceed 5%?',
    },
    helper: {
      tr: 'ISO 14064-1 §5.4, yapısal değişikliğin emisyon etkisi %5\'i geçiyorsa baz yıl yeniden hesaplanmalıdır. %5\'in altındaysa yeniden hesaplama isteğe bağlıdır.',
      en: 'ISO 14064-1 §5.4 requires base year recalculation if the emission impact of the structural change exceeds 5%. If below 5%, recalculation is optional.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — etki >%5, baz yıl yeniden hesaplanmalı', en: 'Yes — impact >5%, base year must be recalculated' } },
      { value: 'no', label: { tr: 'Hayır — etki <%5, yeniden hesaplama gerekmiyor', en: 'No — impact <5%, no recalculation required' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: { yes: '6F-3', no: '7-GİRİŞ' },
  },
  // #122
  {
    id: '6F-3',
    number: 122,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'base_year.recalculation_decision',
    text: {
      tr: 'Baz yıl yeniden hesaplama kararınız nedir?',
      en: 'What is your base year recalculation decision?',
    },
    helper: {
      tr: 'Baz yıl yeniden hesaplaması, raporunuzun yıllık karşılaştırılabilirliğini sağlar. Yeniden hesaplama politikanız ve yönteminiz ISO 14064-1 uyarınca raporlanacaktır.',
      en: 'Base year recalculation ensures the annual comparability of your report. Your recalculation policy and method will be reported in accordance with ISO 14064-1.',
    },
    options: [
      { value: 'recalculate_full', label: { tr: 'Tam yeniden hesaplama — tüm yıllar revize edilecek', en: 'Full recalculation — all years will be revised' } },
      { value: 'recalculate_partial', label: { tr: 'Kısmi yeniden hesaplama — yalnızca etkilenen yıllar', en: 'Partial recalculation — affected years only' } },
      { value: 'defer', label: { tr: 'Ertele — sonraki raporlama döneminde ele alınacak', en: 'Defer — to be addressed in the next reporting period' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir karar belirtin.', en: 'Please specify a decision.' },
    },
    next: '7-GİRİŞ',
  },

  // ── STAGE 7 ─ Report Generation & Sign-Off ────────────────────────────────
  // 5 questions · #123–#127 · DOCX v3.0
  // #123
  {
    id: '7-GİRİŞ',
    number: 123,
    stage: 7,
    block: '7-GİRİŞ',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 7 Giriş — Rapor Oluşturma ve İmzalama',
      en: 'Stage 7 Introduction — Report Generation and Sign-Off',
    },
    helper: {
      tr: 'Tebrikler! Tüm veri girişi ve uyum kontrolleri tamamlandı. Bu son aşamada: (7C-1) son alan kontrolü yapılacak, (7C-2) raporunuz imzalanacak ve (7A-INFO + 7B-INFO) raporunuz teslim edilecek.',
      en: 'Congratulations! All data entry and compliance checks are complete. In this final stage: (7C-1) a final field check will be performed, (7C-2) your report will be signed, and (7A-INFO + 7B-INFO) your report will be delivered.',
    },
    options: [{ value: 'start', label: { tr: 'Devam Et', en: 'Continue' } }],
    next: '7C-1',
  },
  // #124
  {
    id: '7C-1',
    number: 124,
    stage: 7,
    block: '7C',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'single_select',
    required: true,
    reportField: 'report.field_check',
    text: {
      tr: 'Sistem son alan kontrolünü tamamladı. Tüm zorunlu alanlar dolduruldu mu?',
      en: 'The system has completed the final field check. Have all required fields been filled in?',
    },
    helper: {
      tr: 'Sistem, zorunlu alanları otomatik olarak kontrol eder. Eksik alan varsa size hangi aşamaya döneceğinizi gösterir. Tüm alanlar tamamsa imzalama adımına geçebilirsiniz.',
      en: 'The system automatically checks required fields. If there are missing fields, it will show you which stage to return to. If all fields are complete, you can proceed to the signing step.',
    },
    options: [
      { value: 'all_complete', label: { tr: 'Evet — tüm alanlar tamamlandı, imzalamaya geç', en: 'Yes — all fields complete, proceed to signing' } },
      { value: 'fix_missing', label: { tr: 'Hayır — eksik alanlar var, düzeltmem gerekiyor', en: 'No — missing fields exist, I need to correct' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    nextByValue: { all_complete: '7C-2', fix_missing: '7C-1' },
  },
  // #125
  {
    id: '7C-2',
    number: 125,
    stage: 7,
    block: '7C',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'compound',
    required: true,
    reportField: 'report.sign_off',
    text: {
      tr: 'Rapor İmzalama — Yetkili imzanızı ve beyanınızı girin.',
      en: 'Report Sign-Off — Enter your authorized signature and declaration.',
    },
    helper: {
      tr: 'ISO 14064-1 §7.5, GHG envanter raporunun yetkili bir temsilci tarafından imzalanmasını zorunlu kılar. İmzalayan kişinin adı, unvanı ve tarih raporunuzda yer alacaktır.',
      en: 'ISO 14064-1 §7.5 requires the GHG inventory report to be signed by an authorized representative. The name, title, and date of the signatory will appear in your report.',
    },
    fields: [
      {
        id: 'signatory_name',
        type: 'text',
        subtype: 'single_line',
        required: true,
        maxLength: 100,
        label: { tr: 'Yetkili adı soyadı', en: 'Authorized name and surname' },
        placeholder: { tr: 'Örn: Ahmet Yılmaz', en: 'Example: John Smith' },
      },
      {
        id: 'signatory_title',
        type: 'text',
        subtype: 'single_line',
        required: true,
        maxLength: 100,
        label: { tr: 'Unvan / pozisyon', en: 'Title / position' },
        placeholder: { tr: 'Örn: Sürdürülebilirlik Müdürü', en: 'Example: Sustainability Manager' },
      },
      {
        id: 'declaration_accepted',
        type: 'single_select',
        required: true,
        label: { tr: 'Beyan onayı', en: 'Declaration acceptance' },
        options: [
          { value: 'accepted', label: { tr: 'Yukarıdaki bilgilerin doğru ve eksiksiz olduğunu beyan ederim', en: 'I declare that the above information is accurate and complete' } },
        ],
      },
    ],
    next: '7A-INFO',
  },
  // #126
  {
    id: '7A-INFO',
    number: 126,
    stage: 7,
    block: '7A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'info',
    required: false,
    text: {
      tr: 'Raporunuz Hazırlandı',
      en: 'Your Report is Ready',
    },
    helper: {
      tr: 'ISO 14064-1 uyumlu GHG envanter raporunuz başarıyla oluşturuldu. Raporu indirebilir, dashboard\'da görüntüleyebilir, doğrulama için gönderebilir veya bir sonraki döneme hazırlık başlatabilirsiniz.',
      en: 'Your ISO 14064-1 compliant GHG inventory report has been successfully generated. You can download the report, view it in the dashboard, send it for verification, or start preparing for the next period.',
    },
    options: [
      { value: 'download_pdf', label: { tr: 'PDF Raporu İndir', en: 'Download PDF Report' } },
      { value: 'view_dashboard', label: { tr: 'Dashboard\'da Görüntüle', en: 'View in Dashboard' } },
      { value: 'send_verification', label: { tr: 'Doğrulama İçin Gönder', en: 'Send for Verification' } },
      { value: 'next_period', label: { tr: 'Sonraki Döneme Hazırlık', en: 'Prepare for Next Period' } },
    ],
    next: '7B-INFO',
  },
  // #127
  {
    id: '7B-INFO',
    number: 127,
    stage: 7,
    block: '7B',
    isoRef: 'ISO 14064-1 §7.5',
    // single_select so user can choose to review assumptions or finish
    type: 'single_select',
    required: true,
    text: {
      tr: 'GHG Envanteri Tamamlandı',
      en: 'GHG Inventory Complete',
    },
    helper: {
      tr: 'Tüm aşamalar başarıyla tamamlandı. GHG envanter süreciniz ISO 14064-1 standardına uygun biçimde yürütüldü. Sistem kabullerinizi gözden geçirmek isterseniz Kabuller Detay ekranına gidebilirsiniz.',
      en: 'All stages have been successfully completed. Your GHG inventory process was conducted in compliance with ISO 14064-1. If you wish to review the system assumptions, you can go to the Assumptions Detail screen.',
    },
    options: [
      { value: 'view_assumptions', label: { tr: 'Kabulleri Gözden Geçir', en: 'Review Assumptions' } },
      { value: 'done', label: { tr: 'Tamamlandı — kapat', en: 'Done — close' } },
    ],
    nextByValue: { view_assumptions: '6B-0' },
  },

  // ── STAGE 6B-DETAILED ─ Assumptions Detail Review ────────────────────────
  // 6 questions · #128–#133 · DOCX v3.0
  // #128
  {
    id: '6B-0',
    number: 128,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'info',
    required: false,
    text: {
      tr: 'Kabuller Detay — Metodolojik Kabuller İncelemesi',
      en: 'Assumptions Detail — Methodological Assumptions Review',
    },
    helper: {
      tr: 'Bu ekran, sistemin hesaplamalarınızda kullandığı tüm metodolojik kabulleri listeler. Kabuller üç tipte gruplanır: (A) Etki yönü, (B) Metodoloji kabulü, (C) Sınır kararı.',
      en: 'This screen lists all methodological assumptions the system used in your calculations. Assumptions are grouped in three types: (A) Impact direction, (B) Methodology assumption, (C) Boundary decision.',
    },
    options: [{ value: 'continue', label: { tr: 'İncele', en: 'Review' } }],
    next: '6B-1',
  },
  // #129
  {
    id: '6B-1',
    number: 129,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'assumptions.review_mode',
    text: {
      tr: 'Sistem kabullerini nasıl incelemek istersiniz?',
      en: 'How would you like to review the system assumptions?',
    },
    helper: {
      tr: '"Tümünü Onayla" seçeneği tüm sistem kabullerini olduğu gibi kabul eder. "Her Birini İncele" seçeneği her kabul tipini tek tek gözden geçirmenizi sağlar.',
      en: '"Approve All" accepts all system assumptions as-is. "Review Each" allows you to review each assumption type individually.',
    },
    options: [
      { value: 'approve_all', label: { tr: 'Tümünü Onayla — sistem kabullerini kabul ediyorum', en: 'Approve All — I accept all system assumptions' } },
      { value: 'review_each', label: { tr: 'Her Birini İncele — tip bazında gözden geçireyim', en: 'Review Each — let me review by type' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '6B-2',
  },
  // #130
  {
    id: '6B-2',
    number: 130,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'assumptions.type_a_direction',
    text: {
      tr: 'Tip A — Etki Yönü: Kullanılan emisyon faktörleri gerçek emisyonlarınızı nasıl etkiliyor?',
      en: 'Type A — Impact Direction: How do the emission factors used affect your actual emissions?',
    },
    helper: {
      tr: 'Tip A kabulü, seçilen emisyon faktörünün gerçek değere göre konumunu değerlendirir. "Fazla tahmin" durumunda rapor edilen emisyon gerçekten yüksektir; "Az tahmin" durumunda düşüktür.',
      en: 'Type A assumption assesses the position of the selected emission factor relative to the actual value. In "overestimate" cases, reported emissions are higher than actual; in "underestimate" cases, lower.',
    },
    options: [
      { value: 'overestimate', label: { tr: 'Fazla tahmin — gerçekten yüksek raporlanıyor olabilir', en: 'Overestimate — may be reported higher than actual' } },
      { value: 'underestimate', label: { tr: 'Az tahmin — gerçekten düşük raporlanıyor olabilir', en: 'Underestimate — may be reported lower than actual' } },
      { value: 'uncertain', label: { tr: 'Belirsiz — yön belirlenemiyor', en: 'Uncertain — direction cannot be determined' } },
      { value: 'neutral', label: { tr: 'Nötr — önemli bir etki beklenmez', en: 'Neutral — no significant impact expected' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen etki yönünü belirtin.', en: 'Please specify the impact direction.' },
    },
    next: '6B-3',
  },
  // #131
  {
    id: '6B-3',
    number: 131,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'assumptions.type_b_methodology',
    text: {
      tr: 'Tip B — Metodoloji Kabulü: Hesaplamada kullanılan metodolojik yaklaşımı onaylayın veya açıklayın. (İsteğe bağlı)',
      en: 'Type B — Methodology Assumption: Confirm or describe the methodological approach used in the calculation. (Optional)',
    },
    placeholder: {
      tr: 'Örn: Doğal gaz için IPCC AR5 GWP değerleri kullanıldı; yerelden ulusal EF\'e geçiş yapıldı.',
      en: 'Example: IPCC AR5 GWP values used for natural gas; transitioned from local to national EF.',
    },
    helper: {
      tr: 'Metodoloji kabulü, hesaplamanın temelindeki yaklaşımı (GWP seti, EF kaynağı, hesaplama yöntemi vb.) belgeler.',
      en: 'The methodology assumption documents the underlying approach (GWP set, EF source, calculation method, etc.) of the calculation.',
    },
    next: '6B-4',
  },
  // #132
  {
    id: '6B-4',
    number: 132,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'assumptions.type_c_boundary',
    text: {
      tr: 'Tip C — Sınır Kararı: Envanter sınırında alınan kararları onaylayın veya açıklayın. (İsteğe bağlı)',
      en: 'Type C — Boundary Decision: Confirm or describe the decisions made regarding inventory boundary. (Optional)',
    },
    placeholder: {
      tr: 'Örn: Kiralık araç filosu operasyonel kontrol kapsamına alındı; yurt dışı satış ofisi kapsam dışı bırakıldı.',
      en: 'Example: Leased vehicle fleet included under operational control; overseas sales office excluded from scope.',
    },
    helper: {
      tr: 'Sınır kararı kabulü, hangi varlıkların envanterinize dahil edildiğini veya dışlandığını ve bunların gerekçelerini belgeler.',
      en: 'The boundary decision assumption documents which entities are included in or excluded from your inventory and their justifications.',
    },
    next: '6B-5',
  },
  // #133
  {
    id: '6B-5',
    number: 133,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'assumptions.final_confirmation',
    text: {
      tr: 'Tüm kabuller gözden geçirildi. Metodolojik kabulleri onaylıyor musunuz?',
      en: 'All assumptions have been reviewed. Do you confirm the methodological assumptions?',
    },
    helper: {
      tr: 'Kabuller onaylandıktan sonra ISO 14064-1 uyumlu raporunuza dahil edilecektir. Düzenleme isterseniz kabul listesine geri dönebilirsiniz.',
      en: 'After confirmation, the assumptions will be included in your ISO 14064-1 compliant report. If you wish to edit, you can return to the assumption list.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet — kabulleri onaylıyorum', en: 'Yes — I confirm the assumptions' } },
      { value: 'edit', label: { tr: 'Hayır — düzenlemek istiyorum', en: 'No — I want to edit' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen kabullerinizi onaylayın.', en: 'Please confirm your assumptions.' },
    },
    nextByValue: { confirmed: null, edit: '6B-1' },
  },
];

/** Total number of questions in the inventory flow. Used for progress display. */
export const TOTAL_QUESTIONS = CARBONIQ_QUESTIONS.length;

export function getQuestionById(id) {
  return CARBONIQ_QUESTIONS.find((question) => question.id === id);
}

export function getInitialQuestionId() {
  return 'A1';
}

export function getNextQuestionId(question, answer) {
  if (!question) return null;
  if (question.nextByValue) {
    if (typeof answer === 'string') {
      return question.nextByValue[answer] ?? question.next ?? null;
    }
    // multi_select returns an array.
    // Strategy: check exclusive/sentinel values first (they have definitive routing),
    // then check the remaining selected values.  This prevents the routing from
    // depending on the arbitrary order items were selected by the user.
    if (Array.isArray(answer)) {
      const exclusiveOpts = new Set(
        (question.options || [])
          .filter(o => o.exclusive || o.value === 'none' || o.value === 'skip')
          .map(o => o.value)
      );
      // First pass: check exclusive/priority values
      for (const v of answer) {
        if (exclusiveOpts.has(v) && question.nextByValue[v] != null) return question.nextByValue[v];
      }
      // Second pass: check all other values
      for (const v of answer) {
        if (!exclusiveOpts.has(v) && question.nextByValue[v] != null) return question.nextByValue[v];
      }
    }
  }
  return question.next ?? null;
}

export function validateCarbonIQAnswer(question, value, answers = {}, lang = 'en') {
  if (!question) return { ok: false, message: 'Question not found.' };

  // Info screens never need validation
  if (question.type === 'info') return { ok: true };

  // compound — validate each sub-field individually
  if (question.type === 'compound') {
    const obj = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
    for (const field of (question.fields || [])) {
      if (field.required === false) continue; // explicitly optional
      const fv = obj[field.id];
      const fempty = fv === undefined || fv === null || String(fv).trim() === '';
      if (fempty) {
        const flabel = field.label?.[lang] || field.label?.en || field.id;
        return {
          ok: false,
          message: field.validate?.requiredMessage?.[lang]
            || (lang === 'tr'
              ? `"${flabel}" alanı zorunludur.`
              : `"${flabel}" is required.`),
        };
      }
      if (field.maxLength && String(fv).length > field.maxLength) {
        const flabel = field.label?.[lang] || field.label?.en || field.id;
        return {
          ok: false,
          message: lang === 'tr'
            ? `"${flabel}" en fazla ${field.maxLength} karakter olabilir.`
            : `"${flabel}" must be at most ${field.maxLength} characters.`,
        };
      }
    }
    return { ok: true };
  }

  // country_city requires both fields to be non-empty
  if (question.type === 'country_city') {
    const isRequired =
      question.required ||
      (question.conditionalRequired &&
        answers[question.conditionalRequired.questionId] === question.conditionalRequired.equals);
    if (isRequired && (!value?.country || !value?.city)) {
      return {
        ok: false,
        message:
          question.validate?.requiredMessage?.[lang] ||
          (lang === 'tr' ? 'Lütfen ülke ve şehri girin.' : 'Please enter both country and city.'),
      };
    }
    return { ok: true };
  }

  const empty = Array.isArray(value)
    ? value.length === 0
    : value === undefined || value === null || String(value).trim() === '';

  const required =
    question.required ||
    (question.conditionalRequired &&
      answers[question.conditionalRequired.questionId] === question.conditionalRequired.equals);

  if (required && empty) {
    return {
      ok: false,
      message:
        question.validate?.requiredMessage?.[lang] ||
        (lang === 'tr' ? 'Bu alan zorunludur.' : 'This field is required.'),
    };
  }

  if (!required && empty) return { ok: true };

  if (question.numericOnly && !/^\d+$/.test(String(value))) {
    return {
      ok: false,
      message:
        question.validate?.formatMessage?.[lang] ||
        (lang === 'tr' ? 'Yalnızca rakam girin.' : 'Please enter digits only.'),
    };
  }

  if (question.exactLength && String(value).length !== question.exactLength) {
    return {
      ok: false,
      message:
        question.validate?.formatMessage?.[lang] ||
        (lang === 'tr'
          ? `Tam ${question.exactLength} karakter girin.`
          : `Please enter exactly ${question.exactLength} characters.`),
    };
  }

  if (question.maxLength && String(value).length > question.maxLength) {
    return {
      ok: false,
      message:
        question.validate?.maxLengthMessage?.[lang] ||
        (lang === 'tr'
          ? `En fazla ${question.maxLength} karakter olabilir.`
          : `Maximum ${question.maxLength} characters allowed.`),
    };
  }

  if (question.validateAgainst?.rule === 'less_than') {
    const compareValue = Number(answers[question.validateAgainst.questionId]);
    const currentValue = Number(value);
    if (Number.isFinite(compareValue) && Number.isFinite(currentValue)) {
      if (currentValue === compareValue) {
        return { ok: false, message: question.validateAgainst.messageSame?.[lang] };
      }
      if (currentValue > compareValue) {
        return { ok: false, message: question.validateAgainst.messageAfter?.[lang] };
      }
    }
  }

  return { ok: true };
}

export function getQuestionWarning(question, value, lang = 'en') {
  if (!question?.warning?.when) return null;
  if (question.warning.when.equals === value) return question.warning.text?.[lang] || null;
  return null;
}

export function getTriggeredAssumptions(question, value) {
  if (!question?.assumptions) return [];
  return question.assumptions
    .filter((assumption) => assumption.when?.equals === value)
    .map((assumption) => ({
      questionId: question.id,
      type: assumption.type,
      trigger: assumption.trigger,
      // Store full bilingual object so the display layer resolves the right language
      // at render time — a language switch after submission shows the correct text.
      text: assumption.text,
      impact: assumption.impact,
    }));
}
