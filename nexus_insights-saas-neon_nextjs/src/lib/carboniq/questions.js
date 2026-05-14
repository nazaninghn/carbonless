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
    blocks: ['4A', '4B'],
  },
  {
    id: 5,
    title: { tr: 'Kapsam 3', en: 'Scope 3' },
    blocks: ['5A'],
  },
  {
    id: 6,
    title: { tr: 'Hariç Tutmalar ve Kabuller', en: 'Exclusions and Assumptions' },
    blocks: ['6A', '6B', '6C', '6D', '6E', '6F'],
  },
  {
    id: 7,
    title: { tr: 'Rapor Üretimi', en: 'Report Generation' },
    blocks: ['7A'],
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
    options: [2020, 2021, 2022, 2023, 2024, 2025].map((year) => ({
      value: String(year),
      label: {
        tr: year === 2025 ? '2025 (cari yıl — veri eksik olabilir)' : String(year),
        en: year === 2025 ? '2025 (current year — data may be incomplete)' : String(year),
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
        when: { equals: '2025' },
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
      when: { equals: '2025' },
      text: {
        tr: '2025 henüz tamamlanmadı. Yıl sonu verileriniz eksik olabilir — bazı kalemlerde tahmini veri kullanmak gerekebilir. Bu durum raporunuzda belgelenecek.',
        en: '2025 is not complete yet. Year-end data may be incomplete — some items may require estimated data. This will be documented in your report.',
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
      no: 'B3',
      skip: 'B3',
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
    options: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((year) => ({
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
    next: 'B3',
  },

  // ── BLOCK B ─ Activity Profile ─────────────────────────────────────────────
  {
    id: 'B1',
    number: 9,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.employee_range',
    text: {
      tr: 'Şirketinizin toplam çalışan sayısı aralığı nedir?',
      en: 'What is the total number of employees at your company?',
    },
    helper: {
      tr: 'Raporlama yılı sonu itibarıyla tam zamanlı eşdeğer (FTE) çalışan sayısını seçin.',
      en: 'Select the full-time equivalent (FTE) employee count as of the end of the reporting year.',
    },
    options: [
      { value: '1_50', label: { tr: '1 – 50 çalışan', en: '1 – 50 employees' } },
      { value: '51_250', label: { tr: '51 – 250 çalışan', en: '51 – 250 employees' } },
      { value: '251_1000', label: { tr: '251 – 1.000 çalışan', en: '251 – 1,000 employees' } },
      { value: '1001_5000', label: { tr: '1.001 – 5.000 çalışan', en: '1,001 – 5,000 employees' } },
      { value: 'over_5000', label: { tr: '5.000+ çalışan', en: '5,000+ employees' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen çalışan sayısı aralığını seçin.', en: 'Please select the employee count range.' },
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
    reportField: 'company.activities_description',
    text: {
      tr: 'Şirketinizin ana faaliyetlerini kısaca açıklayın.',
      en: 'Briefly describe your company\'s main business activities.',
    },
    placeholder: {
      tr: 'Örn: Otomotiv parçaları üretimi ve dağıtımı, Türkiye ve Almanya\'da 3 fabrika ile faaliyet göstermektedir.',
      en: 'Example: Automotive parts manufacturing and distribution, operating in 3 factories in Turkey and Germany.',
    },
    helper: {
      tr: 'Bu açıklama raporun "Şirket Profili" bölümünde kullanılacak. En fazla 200 karakter.',
      en: 'This description will appear in the "Company Profile" section of the report. Maximum 200 characters.',
    },
    validate: {
      requiredMessage: { tr: 'Faaliyet açıklaması zorunludur.', en: 'Business activities description is required.' },
      maxLengthMessage: { tr: 'En fazla 200 karakter olabilir.', en: 'Maximum 200 characters allowed.' },
    },
    next: 'B4',
  },
  {
    id: 'B3',
    number: 11,
    stage: 1,
    block: 'B',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'company.sector',
    text: {
      tr: 'Şirketinizin ana faaliyet sektörü nedir?',
      en: 'What is the primary business sector of your company?',
    },
    helper: {
      tr: 'Emisyon faktörü seçimi ve sektörel kıyaslama için kullanılır.',
      en: 'Used for emission factor selection and sector benchmarking.',
    },
    options: [
      { value: 'NACE_A', label: { tr: 'NACE A – Tarım, Ormancılık ve Balıkçılık', en: 'NACE A – Agriculture, Forestry and Fishing' } },
      { value: 'NACE_B', label: { tr: 'NACE B – Madencilik ve Taş Ocakçılığı', en: 'NACE B – Mining and Quarrying' } },
      { value: 'NACE_C', label: { tr: 'NACE C – İmalat / Üretim', en: 'NACE C – Manufacturing' } },
      { value: 'NACE_D', label: { tr: 'NACE D – Elektrik, Gaz, Buhar ve Klima Üretimi', en: 'NACE D – Electricity, Gas, Steam and Air Conditioning Supply' } },
      { value: 'NACE_E', label: { tr: 'NACE E – Su Temini; Kanalizasyon, Atık Yönetimi', en: 'NACE E – Water Supply; Sewerage, Waste Management' } },
      { value: 'NACE_F', label: { tr: 'NACE F – İnşaat', en: 'NACE F – Construction' } },
      { value: 'NACE_G', label: { tr: 'NACE G – Toptan ve Perakende Ticaret', en: 'NACE G – Wholesale and Retail Trade' } },
      { value: 'NACE_H', label: { tr: 'NACE H – Ulaştırma ve Depolama', en: 'NACE H – Transportation and Storage' } },
      { value: 'NACE_I', label: { tr: 'NACE I – Konaklama ve Yiyecek Hizmetleri', en: 'NACE I – Accommodation and Food Service Activities' } },
      { value: 'NACE_J', label: { tr: 'NACE J – Bilgi ve İletişim', en: 'NACE J – Information and Communication' } },
      { value: 'NACE_K', label: { tr: 'NACE K – Finans ve Sigortacılık', en: 'NACE K – Financial and Insurance Activities' } },
      { value: 'NACE_L', label: { tr: 'NACE L – Gayrimenkul Faaliyetleri', en: 'NACE L – Real Estate Activities' } },
      { value: 'NACE_M', label: { tr: 'NACE M – Mesleki, Bilimsel ve Teknik Faaliyetler', en: 'NACE M – Professional, Scientific and Technical Activities' } },
      { value: 'NACE_N', label: { tr: 'NACE N – İdari ve Destek Hizmeti Faaliyetleri', en: 'NACE N – Administrative and Support Service Activities' } },
      { value: 'NACE_O', label: { tr: 'NACE O – Kamu Yönetimi ve Savunma', en: 'NACE O – Public Administration and Defence' } },
      { value: 'NACE_P', label: { tr: 'NACE P – Eğitim', en: 'NACE P – Education' } },
      { value: 'NACE_Q', label: { tr: 'NACE Q – İnsan Sağlığı ve Sosyal Hizmet Faaliyetleri', en: 'NACE Q – Human Health and Social Work Activities' } },
      { value: 'NACE_R', label: { tr: 'NACE R – Kültür, Sanat, Eğlence ve Dinlence', en: 'NACE R – Arts, Entertainment and Recreation' } },
      { value: 'NACE_S', label: { tr: 'NACE S – Diğer Hizmet Faaliyetleri', en: 'NACE S – Other Service Activities' } },
      { value: 'NACE_T', label: { tr: 'NACE T – Hanehalkı İşverenlerinin Faaliyetleri', en: 'NACE T – Activities of Households as Employers' } },
      { value: 'NACE_U', label: { tr: 'NACE U – Uluslararası Örgütler ve Kuruluşlar', en: 'NACE U – Activities of Extraterritorial Organisations' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir sektör seçin.', en: 'Please select a sector.' },
    },
    next: 'B1',
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
      tr: 'Kaç adet tesis / işletme yeri bulunmaktadır?',
      en: 'How many facilities / sites does your company operate?',
    },
    placeholder: { tr: 'Örn: 3', en: 'Example: 3' },
    helper: {
      tr: 'Fabrika, ofis, depo ve şube dahil tüm fiziksel konumları sayın.',
      en: 'Count all physical locations including factories, offices, warehouses and branches.',
    },
    validate: {
      requiredMessage: { tr: 'Tesis sayısı zorunludur.', en: 'Facility count is required.' },
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
      tr: 'Şirketinizde hangi tür tesis/konum türleri bulunmaktadır?',
      en: 'What types of facilities / locations does your company operate?',
    },
    helper: {
      tr: 'Birden fazla seçebilirsiniz. Her tesis türü farklı emisyon kaynakları içerebilir.',
      en: 'You may select multiple. Each facility type may contain different emission sources.',
    },
    options: [
      { value: 'office', label: { tr: 'Ofis / Büro', en: 'Office' } },
      { value: 'factory', label: { tr: 'Fabrika / Üretim Tesisi', en: 'Factory / Production Facility' } },
      { value: 'warehouse', label: { tr: 'Depo / Lojistik Merkezi', en: 'Warehouse / Logistics Centre' } },
      { value: 'field', label: { tr: 'Saha / Açık Alan', en: 'Field / Open Site' } },
      { value: 'data_center', label: { tr: 'Veri Merkezi', en: 'Data Centre' } },
      { value: 'retail', label: { tr: 'Perakende Mağaza / Showroom', en: 'Retail Store / Showroom' } },
      { value: 'other', label: { tr: 'Diğer', en: 'Other' } },
    ],
    validate: {
      requiredMessage: { tr: 'En az bir tesis türü seçin.', en: 'Please select at least one facility type.' },
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
    reportField: 'company.revenue_range',
    text: {
      tr: 'Şirketinizin yıllık cirosunu belirtiniz. (İsteğe bağlı)',
      en: 'What is your company\'s annual revenue? (Optional)',
    },
    helper: {
      tr: 'Emisyon yoğunluğu hesabında kullanılır. Paylaşmak istemiyorsanız atlayabilirsiniz.',
      en: 'Used for emission intensity calculations. You may skip if you prefer not to share.',
    },
    options: [
      { value: 'under_1m', label: { tr: '1 Milyon TL altı', en: 'Under 1M TRY' } },
      { value: '1m_10m', label: { tr: '1 – 10 Milyon TL', en: '1–10M TRY' } },
      { value: '10m_100m', label: { tr: '10 – 100 Milyon TL', en: '10–100M TRY' } },
      { value: '100m_1b', label: { tr: '100 Milyon – 1 Milyar TL', en: '100M–1B TRY' } },
      { value: 'over_1b', label: { tr: '1 Milyar TL üzeri', en: 'Over 1B TRY' } },
      { value: 'skip', label: { tr: 'Atlamak istiyorum', en: 'I prefer not to say' } },
    ],
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
      tr: 'Bağlı şirketiniz veya iştirakiniz var mı?',
      en: 'Do you have any subsidiaries or affiliates?',
    },
    helper: {
      tr: 'Bağlı ortaklıklar veya iştiraklerin varlığı organizasyon sınırını doğrudan etkiler.',
      en: 'The existence of subsidiaries or affiliates directly affects the organizational boundary definition.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
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
      en: 'Do you have operations outside your home country?',
    },
    helper: {
      tr: 'Yurt dışı operasyonlar farklı ülkelere özgü emisyon faktörlerinin uygulanmasını gerektirir.',
      en: 'International operations require applying country-specific emission factors for each location.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
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
    reportField: 'company.has_franchise_or_jv',
    text: {
      tr: 'Franchise veya ortak girişim (joint venture) faaliyetiniz var mı?',
      en: 'Do you have any franchise or joint venture (JV) operations?',
    },
    helper: {
      tr: 'Franchise ve ortak girişimler, seçilecek konsolidasyon yaklaşımına göre kısmen veya tamamen envantere dahil edilir.',
      en: 'Franchise and joint venture operations are included partially or fully in the inventory depending on the consolidation approach.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
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
    required: true,
    reportField: 'report.ef_database',
    text: {
      tr: 'Emisyon faktörü hesabı için hangi veritabanını kullanmak istersiniz?',
      en: 'Which emission factor database do you want to use for calculations?',
    },
    helper: {
      tr: 'Seçtiğiniz ülkeye göre bir öneri yapıldı. Uzman değilseniz varsayılan öneriyi kullanmanızı tavsiye ederiz.',
      en: 'A suggestion was made based on your country. If you\'re not an expert, we recommend using the default suggestion.',
    },
    options: [
      { value: 'DEFRA_TUIK', label: { tr: 'DEFRA + TÜİK (Türkiye için önerilen)', en: 'DEFRA + TUIK (recommended for Turkey)' } },
      { value: 'DEFRA', label: { tr: 'DEFRA (UK)', en: 'DEFRA (UK)' } },
      { value: 'EPA', label: { tr: 'EPA (ABD)', en: 'EPA (US)' } },
      { value: 'IPCC_AR6', label: { tr: 'IPCC AR6', en: 'IPCC AR6' } },
      { value: 'ecoinvent', label: { tr: 'ecoinvent', en: 'ecoinvent' } },
      { value: 'other', label: { tr: 'Diğer / Ülke özel', en: 'Other / Country-specific' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir emisyon faktörü veritabanı seçin.', en: 'Please select an emission factor database.' },
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
    text: {
      tr: 'Kapsam 2 Metodolojisi Hakkında Bilgi',
      en: 'About Scope 2 Methodology',
    },
    helper: {
      tr: 'Bir sonraki adımda organizasyon sınırı yaklaşımını belirleyeceğiz. ISO 14064-1, üç temel yaklaşım tanımlar: Operasyonel Kontrol (en yaygın), Finansal Kontrol ve Hisse Oranı. Seçtiğiniz yaklaşım, envantere dahil edilecek emisyon kaynaklarını belirler. Kapsam 2 emisyonları (satın alınan elektrik, ısı ve buhar) her üç yaklaşımda da yer bulmakla birlikte hesaplama yöntemi farklılık gösterebilir.',
      en: 'In the next step, we will determine your organizational boundary approach. ISO 14064-1 defines three approaches: Operational Control (most common), Financial Control, and Equity Share. The approach you choose determines which emission sources are included in your inventory. Scope 2 emissions (purchased electricity, heat and steam) are relevant under all three approaches, though the calculation methodology may differ.',
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
    reportField: 'report.consolidation_approach',
    text: {
      tr: 'GHG envanter sınırı için hangi organizasyon sınırı yaklaşımını kullanacaksınız?',
      en: 'Which organizational boundary approach will you use for your GHG inventory?',
    },
    helper: {
      tr: 'ISO 14064-1 üç yaklaşım tanımlar. Operasyonel kontrol en yaygın kullanılan yöntemdir.',
      en: 'ISO 14064-1 defines three approaches. Operational control is the most commonly used method.',
    },
    options: [
      { value: 'operational_control', label: { tr: 'Operasyonel Kontrol — Şirketin operasyonel politikalarını yönettiği tüm birimler dahil edilir (önerilen)', en: 'Operational Control — All units where the company manages operational policies are included (recommended)' } },
      { value: 'financial_control', label: { tr: 'Finansal Kontrol — Şirketin finansal ve operasyonel politikaları yönettiği birimler dahil edilir', en: 'Financial Control — Units where the company directs financial and operational policies are included' } },
      { value: 'equity_share', label: { tr: 'Hisse Oranı — Emisyonlar şirketin sahiplik payıyla orantılı olarak hesaplanır', en: 'Equity Share — Emissions are accounted for proportional to the company\'s ownership share' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir organizasyon sınırı yaklaşımı seçin.', en: 'Please select an organizational boundary approach.' },
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
        tr: 'Hisse oranı: Emisyonlar, şirketin işletmedeki hisse oranıyla orantılı olarak hesaplanır.',
        en: 'Equity share: Emissions are accounted for in proportion to the company\'s ownership share in the operation.',
      },
    },
    next: 'D4',
  },
  {
    id: 'D4',
    number: 21,
    stage: 1,
    block: 'D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'report.scope3_approach',
    text: {
      tr: 'Kapsam 3 emisyonlarını envantere nasıl dahil etmek istiyorsunuz?',
      en: 'How do you want to include Scope 3 emissions in your inventory?',
    },
    helper: {
      tr: 'Kapsam 3, tedarik zinciri ve değer zinciri boyunca gerçekleşen dolaylı emisyonları kapsar. ISO 14064-1\'e göre önemlilik analizi yaparak seçim yapabilirsiniz.',
      en: 'Scope 3 covers indirect emissions across the supply chain and value chain. ISO 14064-1 allows selection based on a materiality analysis.',
    },
    options: [
      { value: 'materiality', label: { tr: 'Önemlilik bazlı — yalnızca önemli Kapsam 3 kategorileri dahil edilsin (önerilen)', en: 'Materiality-based — include only material Scope 3 categories (recommended)' } },
      { value: 'full_15', label: { tr: 'Tam kapsam — GHG Protokolü\'nün tüm 15 Kapsam 3 kategorisi dahil edilsin', en: 'Full scope — include all 15 Scope 3 categories per GHG Protocol' } },
      { value: 'exclude', label: { tr: 'Kapsam 3 dahil edilmesin — yalnızca Kapsam 1 ve 2', en: 'Exclude Scope 3 — Scope 1 and 2 only' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen Kapsam 3 yaklaşımını seçin.', en: 'Please select a Scope 3 approach.' },
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
    next: '3A-0',
  },

  // ── STAGE 3 ─ Scope 1 Emissions ───────────────────────────────────────────
  {
    id: '3A-0',
    number: 36,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 3: Kapsam 1 — Doğrudan GHG Emisyonları',
      en: 'Stage 3: Scope 1 — Direct GHG Emissions',
    },
    helper: {
      tr: 'Kapsam 1, organizasyon sınırındaki kaynaklardan doğrudan salınan GHG emisyonlarını kapsar. Sabit yakma, mobil yakma, proses emisyonları ve kaçak emisyonlar bu kapsamda değerlendirilir.',
      en: 'Scope 1 covers direct GHG emissions from sources within the organizational boundary. Stationary combustion, mobile combustion, process emissions, and fugitive emissions fall under this scope.',
    },
    next: '3A-1',
  },
  {
    id: '3A-1',
    number: 37,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.stationary_combustion.exists',
    text: {
      tr: 'Sabit yakma tesisi (kazan, fırın, ısıtma sistemi vb.) kullanıyor musunuz?',
      en: 'Do you use stationary combustion sources (boilers, furnaces, heating systems, etc.)?',
    },
    helper: {
      tr: 'Binanızda veya tesisinizdeki ısıtma, buhar üretimi veya elektrik üretim kazanları sabit yakma kaynağı sayılır.',
      en: 'Heating, steam, or power generation boilers in your building or facility are considered stationary combustion sources.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3A-2',
  },
  {
    id: '3A-2',
    number: 38,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope1.stationary_combustion.natural_gas_m3',
    text: {
      tr: 'Raporlama yılında tüketilen doğalgaz miktarı nedir? (m³)',
      en: 'How much natural gas was consumed in the reporting year? (m³)',
    },
    placeholder: { tr: 'Örn: 50000', en: 'Example: 50000' },
    helper: {
      tr: 'Doğalgaz tüketimi yoksa 0 girin veya boş bırakın.',
      en: 'Enter 0 or leave blank if no natural gas is consumed.',
    },
    next: '3A-3',
  },
  {
    id: '3A-3',
    number: 39,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope1.stationary_combustion.fuel_oil_litre',
    text: {
      tr: 'Raporlama yılında tüketilen fuel oil / motorin miktarı nedir? (litre)',
      en: 'How much fuel oil / diesel was consumed in the reporting year? (litres)',
    },
    placeholder: { tr: 'Örn: 10000', en: 'Example: 10000' },
    helper: {
      tr: 'Kazan veya jeneratör için kullanılan fuel oil, motorin, gazyağı miktarını girin. Yoksa 0 girin.',
      en: 'Enter the amount of fuel oil, diesel, or kerosene used for boilers or generators. Enter 0 if none.',
    },
    next: '3A-4',
  },
  {
    id: '3A-4',
    number: 40,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope1.stationary_combustion.lpg_kg',
    text: {
      tr: 'Raporlama yılında tüketilen LPG miktarı nedir? (kg)',
      en: 'How much LPG was consumed in the reporting year? (kg)',
    },
    placeholder: { tr: 'Örn: 2000', en: 'Example: 2000' },
    helper: {
      tr: 'Tüpgaz veya LPG sistemleri için. Yoksa 0 girin veya boş bırakın.',
      en: 'For bottled gas or LPG systems. Enter 0 or leave blank if none.',
    },
    next: '3A-5',
  },
  {
    id: '3A-5',
    number: 41,
    stage: 3,
    block: '3A',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope1.stationary_combustion.coal_ton',
    text: {
      tr: 'Raporlama yılında tüketilen kömür / kok miktarı nedir? (ton)',
      en: 'How much coal / coke was consumed in the reporting year? (tonnes)',
    },
    placeholder: { tr: 'Örn: 150', en: 'Example: 150' },
    helper: {
      tr: 'Taş kömürü, linyit, kok kömürü dahil. Yoksa 0 girin veya boş bırakın.',
      en: 'Includes hard coal, lignite, coke. Enter 0 or leave blank if none.',
    },
    next: '3B-0',
  },
  {
    id: '3B-0',
    number: 42,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Mobil Yakma — Şirkete Ait Araçlar',
      en: 'Mobile Combustion — Company-Owned Vehicles',
    },
    helper: {
      tr: 'Şirkete ait veya şirket tarafından kontrol edilen araçların (otomobil, kamyon, iş makinesi vb.) yakıt tüketiminden kaynaklanan emisyonlar Kapsam 1\'e girer.',
      en: 'Emissions from fuel consumption of company-owned or company-controlled vehicles (cars, trucks, machinery, etc.) fall under Scope 1.',
    },
    next: '3B-1',
  },
  {
    id: '3B-1',
    number: 43,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.mobile_combustion.vehicles_exist',
    text: {
      tr: 'Şirkete ait veya kiralanmış araç filoları var mı?',
      en: 'Does the company own or lease any vehicle fleet?',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3B-2',
  },
  {
    id: '3B-2',
    number: 44,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope1.mobile_combustion.petrol_diesel_litre',
    text: {
      tr: 'Şirkete ait araçların yıllık toplam benzin + motorin tüketimi nedir? (litre)',
      en: 'What is the annual total petrol + diesel consumption of company vehicles? (litres)',
    },
    placeholder: { tr: 'Örn: 30000', en: 'Example: 30000' },
    helper: {
      tr: 'Tüm araçların yıllık toplam yakıt tüketimini girin. Araç başına değil toplam.',
      en: 'Enter total annual fuel consumption across all vehicles. Total, not per vehicle.',
    },
    next: '3B-3',
  },
  {
    id: '3B-3',
    number: 45,
    stage: 3,
    block: '3B',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: false,
    reportField: 'scope1.mobile_combustion.air_sea_vehicles',
    text: {
      tr: 'Şirkete ait uçak veya gemi gibi hava/deniz araçları var mı?',
      en: 'Does the company own any aircraft or marine vessels?',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '3C-0',
  },
  {
    id: '3C-0',
    number: 46,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Proses Emisyonları',
      en: 'Process Emissions',
    },
    helper: {
      tr: 'Proses emisyonları, yakma dışı endüstriyel faaliyetlerden kaynaklanır. Çimento, cam, çelik, kimya üretimi gibi sektörler için geçerlidir.',
      en: 'Process emissions arise from industrial activities other than combustion. Relevant for sectors such as cement, glass, steel, and chemical production.',
    },
    next: '3C-1',
  },
  {
    id: '3C-1',
    number: 47,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.process_emissions.exists',
    text: {
      tr: 'Endüstriyel proses kaynaklı GHG emisyonunuz var mı?',
      en: 'Do you have GHG emissions from industrial processes (non-combustion)?',
    },
    helper: {
      tr: 'Kimyasal reaksiyonlar, karbonatlama, fermentasyon gibi proses kaynaklı emisyonlar bu gruba girer.',
      en: 'Emissions from chemical reactions, carbonation, fermentation, etc. fall into this group.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır — proses emisyonum yok', en: 'No — no process emissions' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3C-2',
  },
  {
    id: '3C-2',
    number: 48,
    stage: 3,
    block: '3C',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 400,
    reportField: 'scope1.process_emissions.description',
    text: {
      tr: 'Proses emisyonlarınızı ve tahmini CO₂e miktarını açıklayın.',
      en: 'Describe your process emissions and estimated CO₂e amount.',
    },
    placeholder: {
      tr: 'Örn: Kireç taşı karbonatlama sürecinden ~500 tCO₂e/yıl',
      en: 'Example: ~500 tCO₂e/year from limestone carbonation process',
    },
    helper: {
      tr: 'Yoksa boş bırakın. Detaylı veri gerektiren prosesler için uzman desteği alabilirsiniz.',
      en: 'Leave blank if none. For complex processes, expert support is recommended.',
    },
    next: '3D-0',
  },
  {
    id: '3D-0',
    number: 49,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Kaçak Emisyonlar (Fugitive Emissions)',
      en: 'Fugitive Emissions',
    },
    helper: {
      tr: 'Kaçak emisyonlar; soğutucu gazlar, SF₆, CH₄ sızıntıları ve diğer kasıtsız sızmalardan oluşur. Klima, soğutma sistemleri ve elektrik ekipmanları bu kaynakların başında gelir.',
      en: 'Fugitive emissions include refrigerant gases, SF₆, CH₄ leaks, and other unintentional releases. Air conditioning, refrigeration systems, and electrical equipment are the main sources.',
    },
    next: '3D-1',
  },
  {
    id: '3D-1',
    number: 50,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.fugitive.refrigerants_exist',
    text: {
      tr: 'Klima veya soğutma sisteminizde soğutucu gaz (HFC, R-410A vb.) kullanılıyor mu?',
      en: 'Do your air conditioning or refrigeration systems use refrigerant gases (HFCs, R-410A, etc.)?',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '3D-2',
  },
  {
    id: '3D-2',
    number: 51,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 10,
    reportField: 'scope1.fugitive.refrigerant_charge_kg',
    text: {
      tr: 'Yıl içinde soğutucu gaz dolumu yapılan toplam miktar nedir? (kg)',
      en: 'What is the total amount of refrigerant charged during the year? (kg)',
    },
    placeholder: { tr: 'Örn: 15', en: 'Example: 15' },
    helper: {
      tr: 'Bakım kayıtlarınızdan veya servis fişlerinizden bu bilgiye ulaşabilirsiniz. Yoksa 0 girin.',
      en: 'You can find this in your maintenance records or service receipts. Enter 0 if none.',
    },
    next: '3D-3',
  },
  {
    id: '3D-3',
    number: 52,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: false,
    reportField: 'scope1.fugitive.sf6_exists',
    text: {
      tr: 'SF₆ veya diğer florlu gazlar (PFC, NF₃) kullanan elektrik ekipmanınız var mı?',
      en: 'Do you have electrical equipment using SF₆ or other fluorinated gases (PFC, NF₃)?',
    },
    helper: {
      tr: 'Yüksek gerilim kesicileri, transformatörler bu gazları kullanabilir. Küçük ofisler için genellikle geçerli değildir.',
      en: 'High-voltage circuit breakers and transformers may use these gases. Usually not applicable for small offices.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '3D-4',
  },
  {
    id: '3D-4',
    number: 53,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 10,
    reportField: 'scope1.fugitive.sf6_kg',
    text: {
      tr: 'Yıl içinde gerçekleşen SF₆ ve diğer florlu gaz sızıntısı/dolumu miktarı nedir? (kg)',
      en: 'What is the total SF₆ and other fluorinated gas leakage/charge during the year? (kg)',
    },
    placeholder: { tr: 'Örn: 2', en: 'Example: 2' },
    helper: {
      tr: 'Ekipman bakım kayıtlarından edinilebilir. Yoksa 0 girin.',
      en: 'Available from equipment maintenance records. Enter 0 if none.',
    },
    next: 'TY-0',
  },
  {
    id: 'TY-0',
    number: 54,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'info',
    required: false,
    text: {
      tr: 'Kapsam 1 verileri tamamlandı',
      en: 'Scope 1 data complete',
    },
    helper: {
      tr: 'Kapsam 1 (Doğrudan Emisyonlar) verilerini girdiniz. Sistem şimdi bu verileri hesaplayarak CO₂e miktarını belirleyecek. Şimdi Kapsam 2\'ye (Satın Alınan Enerji) geçiyoruz.',
      en: 'You have entered Scope 1 (Direct Emissions) data. The system will now calculate CO₂e amounts from this data. We are now moving to Scope 2 (Purchased Energy).',
    },
    next: 'TY-1',
  },
  {
    id: 'TY-1',
    number: 55,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.data_accuracy',
    text: {
      tr: 'Kapsam 1 için girdiğiniz veriler ne kadar doğrudur?',
      en: 'How accurate are the Scope 1 data you entered?',
    },
    helper: {
      tr: 'Veri kalitesi raporunuzun belirsizlik değerlendirmesinde kullanılır.',
      en: 'Data quality is used in the uncertainty assessment of your report.',
    },
    options: [
      { value: 'measured', label: { tr: 'Ölçüm verileri — çok doğru', en: 'Measured data — very accurate' } },
      { value: 'invoices', label: { tr: 'Fatura/satın alma kayıtları — güvenilir', en: 'Invoices/purchase records — reliable' } },
      { value: 'estimates', label: { tr: 'Tahmin — yaklaşık değerler', en: 'Estimates — approximate values' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'TY-2',
  },
  {
    id: 'TY-2',
    number: 56,
    stage: 3,
    block: '3D',
    isoRef: 'ISO 14064-1 §5.2',
    type: 'single_select',
    required: true,
    reportField: 'scope1.confirmed',
    text: {
      tr: 'Kapsam 1 verilerini onaylıyor musunuz?',
      en: 'Do you confirm the Scope 1 data?',
    },
    helper: {
      tr: 'Onayladıktan sonra Kapsam 2 verilerine geçeceğiz. Değişiklik yapmak isterseniz rapor oluşturulmadan önce geri dönebilirsiniz.',
      en: 'After confirmation, we will move to Scope 2 data. You can return to make changes before the report is generated.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet, verileri onaylıyorum', en: 'Yes, I confirm the data' } },
      { value: 'needs_review', label: { tr: 'Gözden geçirmem gerekiyor', en: 'I need to review' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '4A-0',
  },

  // ── STAGE 4 ─ Scope 2 Emissions ───────────────────────────────────────────
  {
    id: '4A-0',
    number: 57,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 4: Kapsam 2 — Satın Alınan Enerji Emisyonları',
      en: 'Stage 4: Scope 2 — Purchased Energy Emissions',
    },
    helper: {
      tr: 'Kapsam 2, şirketin satın aldığı elektrik, ısı, buhar ve soğutmadan kaynaklanan dolaylı GHG emisyonlarını kapsar. Lokasyon tabanlı ve piyasa tabanlı olmak üzere iki hesaplama yöntemi mevcuttur.',
      en: 'Scope 2 covers indirect GHG emissions from purchased electricity, heat, steam, and cooling. Two calculation methods are available: location-based and market-based.',
    },
    next: '4A-1',
  },
  {
    id: '4A-1',
    number: 58,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.method',
    text: {
      tr: 'Kapsam 2 hesabı için hangi yöntemi kullanacaksınız?',
      en: 'Which method will you use for Scope 2 calculation?',
    },
    helper: {
      tr: 'Lokasyon tabanlı yöntem ulusal ortalama emisyon faktörü kullanır. Piyasa tabanlı yöntem enerji sertifikaları veya tedarikçi emisyon faktörleri kullanır.',
      en: 'Location-based uses national average emission factor. Market-based uses energy certificates or supplier emission factors.',
    },
    options: [
      { value: 'location_based', label: { tr: 'Lokasyon tabanlı (ulusal ortalama)', en: 'Location-based (national average)' } },
      { value: 'market_based', label: { tr: 'Piyasa tabanlı (enerji sertifikası/tedarikçi)', en: 'Market-based (energy certificate/supplier)' } },
      { value: 'both', label: { tr: 'Her iki yöntem (çift raporlama)', en: 'Both methods (dual reporting)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir yöntem seçin.', en: 'Please select a method.' },
    },
    next: '4A-2',
  },
  {
    id: '4A-2',
    number: 59,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: true,
    maxLength: 15,
    reportField: 'scope2.electricity_kwh',
    text: {
      tr: 'Raporlama yılında satın alınan toplam elektrik tüketimi nedir? (kWh)',
      en: 'What is the total purchased electricity consumption in the reporting year? (kWh)',
    },
    placeholder: { tr: 'Örn: 500000', en: 'Example: 500000' },
    helper: {
      tr: 'Elektrik faturalarınızdan veya sayaç okumalarından bu değeri bulabilirsiniz.',
      en: 'You can find this value from your electricity invoices or meter readings.',
    },
    validate: {
      requiredMessage: { tr: 'Elektrik tüketimi zorunludur.', en: 'Electricity consumption is required.' },
    },
    next: '4A-3',
  },
  {
    id: '4A-3',
    number: 60,
    stage: 4,
    block: '4A',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope2.heat_steam_kwh',
    text: {
      tr: 'Raporlama yılında satın alınan ısı / buhar / soğutma miktarı nedir? (kWh)',
      en: 'How much purchased heat / steam / cooling was consumed in the reporting year? (kWh)',
    },
    placeholder: { tr: 'Örn: 100000', en: 'Example: 100000' },
    helper: {
      tr: 'Merkezi ısıtma, endüstriyel buhar veya soğutma satın alıyorsanız bu miktarı girin. Yoksa 0 girin.',
      en: 'Enter this if you purchase district heating, industrial steam, or cooling. Enter 0 if none.',
    },
    next: '4B-0',
  },
  {
    id: '4B-0',
    number: 61,
    stage: 4,
    block: '4B',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: false,
    reportField: 'scope2.renewable_energy_certificate',
    text: {
      tr: 'Yenilenebilir enerji sertifikanız (I-REC, REGO, GÖ vb.) var mı?',
      en: 'Do you have renewable energy certificates (I-REC, REGO, GÖ, etc.)?',
    },
    helper: {
      tr: 'Sertifikanız varsa piyasa tabanlı Kapsam 2 hesabında hesaba katılacak.',
      en: 'If you have certificates, they will be accounted for in the market-based Scope 2 calculation.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — sertifikam var', en: 'Yes — I have certificates' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '4B-1',
  },
  {
    id: '4B-1',
    number: 62,
    stage: 4,
    block: '4B',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'scope2.renewable_kwh',
    text: {
      tr: 'Sahada (rooftop solar vb.) üretilen yenilenebilir enerji miktarı nedir? (kWh)',
      en: 'How much renewable energy was generated on-site (rooftop solar, etc.)? (kWh)',
    },
    placeholder: { tr: 'Örn: 50000', en: 'Example: 50000' },
    helper: {
      tr: 'Şirketin kendi ürettiği güneş, rüzgâr vb. enerji. Yoksa 0 girin veya boş bırakın.',
      en: 'Renewable energy self-generated by the company (solar, wind, etc.). Enter 0 or leave blank if none.',
    },
    next: '4C-0',
  },
  {
    id: '4C-0',
    number: 63,
    stage: 4,
    block: '4C',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.data_accuracy',
    text: {
      tr: 'Kapsam 2 için girdiğiniz enerji verileri ne kadar doğrudur?',
      en: 'How accurate are the energy data you entered for Scope 2?',
    },
    options: [
      { value: 'invoices', label: { tr: 'Fatura kayıtları — güvenilir', en: 'Invoice records — reliable' } },
      { value: 'meter', label: { tr: 'Sayaç okumaları — çok doğru', en: 'Meter readings — very accurate' } },
      { value: 'estimates', label: { tr: 'Tahmin — yaklaşık değerler', en: 'Estimates — approximate values' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '4C-1',
  },
  {
    id: '4C-1',
    number: 64,
    stage: 4,
    block: '4C',
    isoRef: 'ISO 14064-1 §5.3',
    type: 'single_select',
    required: true,
    reportField: 'scope2.confirmed',
    text: {
      tr: 'Kapsam 2 verilerini onaylıyor musunuz?',
      en: 'Do you confirm the Scope 2 data?',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet, verileri onaylıyorum', en: 'Yes, I confirm the data' } },
      { value: 'needs_review', label: { tr: 'Gözden geçirmem gerekiyor', en: 'I need to review' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C1-0',
  },

  // ── STAGE 5 ─ Scope 3 Emissions ───────────────────────────────────────────
  {
    id: 'K3C1-0',
    number: 65,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 5: Kapsam 3 — Dolaylı Değer Zinciri Emisyonları',
      en: 'Stage 5: Scope 3 — Indirect Value Chain Emissions',
    },
    helper: {
      tr: 'Kapsam 3, şirketin değer zincirindeki (tedarik, taşımacılık, kullanım, atık vb.) dolaylı emisyonları kapsar. ISO 14064-1, GHG Protokolü Kapsam 3 Standardı\'nda tanımlanan 15 kategoriyi referans alır.',
      en: 'Scope 3 covers indirect emissions in the company\'s value chain (procurement, transport, use, waste, etc.). ISO 14064-1 references the 15 categories defined in the GHG Protocol Scope 3 Standard.',
    },
    next: 'K3C1-1',
  },
  {
    id: 'K3C1-1',
    number: 66,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat1.include',
    text: {
      tr: 'Kapsam 3 Kategori 1: Satın alınan mal ve hizmetler — Bu kategori envanterinize dahil edilecek mi?',
      en: 'Scope 3 Category 1: Purchased goods and services — Will this category be included in your inventory?',
    },
    helper: {
      tr: 'Tedarik zincirindeki üretim ve hizmet emisyonlarını kapsar. En önemli Kapsam 3 kategorisidir.',
      en: 'Covers production and service emissions in the supply chain. This is the most significant Scope 3 category.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — dahil edilecek', en: 'Yes — will be included' } },
      { value: 'no', label: { tr: 'Hayır — kapsam dışı (gerekçe sonraki aşamada)', en: 'No — excluded (reason in next stage)' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C2-1',
  },
  {
    id: 'K3C2-1',
    number: 67,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat2.include',
    text: {
      tr: 'Kapsam 3 Kategori 2: Sermaye malları — Bu kategori envanterinize dahil edilecek mi?',
      en: 'Scope 3 Category 2: Capital goods — Will this category be included in your inventory?',
    },
    helper: {
      tr: 'Makine, ekipman, bina ve araç gibi sermaye mallarının üretim emisyonlarını kapsar.',
      en: 'Covers production emissions of capital goods such as machinery, equipment, buildings, and vehicles.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C3-1',
  },
  {
    id: 'K3C3-1',
    number: 68,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat3.include',
    text: {
      tr: 'Kapsam 3 Kategori 3: Yakıt ve enerji ile ilgili faaliyetler — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 3: Fuel- and energy-related activities — Will this category be included?',
    },
    helper: {
      tr: 'Kapsam 1 ve 2\'de raporlanmayan yakıt/enerji üretim ve iletim kayıplarını kapsar.',
      en: 'Covers fuel/energy production and transmission losses not reported in Scope 1 and 2.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C4-1',
  },
  {
    id: 'K3C4-1',
    number: 69,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat4.include',
    text: {
      tr: 'Kapsam 3 Kategori 4: Yukarı yönlü taşımacılık ve dağıtım — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 4: Upstream transportation and distribution — Will this category be included?',
    },
    helper: {
      tr: 'Tedarikçilerden şirkete gelen mal ve hizmetlerin taşıma emisyonlarını kapsar.',
      en: 'Covers transport emissions of goods and services coming from suppliers to the company.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C5-1',
  },
  {
    id: 'K3C5-1',
    number: 70,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat5.include',
    text: {
      tr: 'Kapsam 3 Kategori 5: Faaliyetlerde oluşan atıklar — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 5: Waste generated in operations — Will this category be included?',
    },
    helper: {
      tr: 'Şirketin faaliyetlerinden kaynaklanan atıkların işlenme ve bertaraf emisyonlarını kapsar.',
      en: 'Covers emissions from treatment and disposal of waste generated by company operations.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C6-1',
  },
  {
    id: 'K3C6-1',
    number: 71,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat6.include',
    text: {
      tr: 'Kapsam 3 Kategori 6: İş seyahatleri — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 6: Business travel — Will this category be included?',
    },
    helper: {
      tr: 'Çalışanların iş amaçlı hava, kara ve deniz yolculuklarından kaynaklanan emisyonlar.',
      en: 'Emissions from employees\' air, road, and sea travel for business purposes.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C7-1',
  },
  {
    id: 'K3C7-1',
    number: 72,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat7.include',
    text: {
      tr: 'Kapsam 3 Kategori 7: Çalışanların işe geliş-gidiş seyahatleri — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 7: Employee commuting — Will this category be included?',
    },
    helper: {
      tr: 'Çalışanların ev-iş arasındaki günlük ulaşım emisyonlarını kapsar.',
      en: 'Covers daily commuting emissions of employees between home and work.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C8-1',
  },
  {
    id: 'K3C8-1',
    number: 73,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat8.include',
    text: {
      tr: 'Kapsam 3 Kategori 8: Yukarı yönlü kiralık varlıklar — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 8: Upstream leased assets — Will this category be included?',
    },
    helper: {
      tr: 'Şirketin kiracı konumunda olduğu varlıklardan kaynaklanan emisyonlar (finansal kontrol yaklaşımı dışında kalan).',
      en: 'Emissions from assets leased by the company as a lessee (not already covered by financial control approach).',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C9-1',
  },
  {
    id: 'K3C9-1',
    number: 74,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat9.include',
    text: {
      tr: 'Kapsam 3 Kategori 9: Aşağı yönlü taşımacılık ve dağıtım — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 9: Downstream transportation and distribution — Will this category be included?',
    },
    helper: {
      tr: 'Şirketten müşteriye yapılan dağıtım ve lojistik operasyonlarının emisyonlarını kapsar.',
      en: 'Covers emissions from distribution and logistics operations from the company to customers.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C10-1',
  },
  {
    id: 'K3C10-1',
    number: 75,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat10.include',
    text: {
      tr: 'Kapsam 3 Kategori 10: Satılan ürünlerin işlenmesi — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 10: Processing of sold products — Will this category be included?',
    },
    helper: {
      tr: 'Şirketin sattığı ara ürünlerin müşteriler tarafından işlenmesi sırasında oluşan emisyonlar.',
      en: 'Emissions from processing of intermediate products sold by the company by customers.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C11-1',
  },
  {
    id: 'K3C11-1',
    number: 76,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.cat11.include',
    text: {
      tr: 'Kapsam 3 Kategori 11: Satılan ürünlerin kullanımı — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 11: Use of sold products — Will this category be included?',
    },
    helper: {
      tr: 'Müşterilerin satın aldığı ürünleri kullanması sırasında oluşan emisyonlar. Enerji kullanan ürünler için önemlidir.',
      en: 'Emissions generated when customers use purchased products. Important for energy-using products.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: 'K3C12-1',
  },
  {
    id: 'K3C12-1',
    number: 77,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat12.include',
    text: {
      tr: 'Kapsam 3 Kategori 12: Satılan ürünlerin ömür sonu işlemleri — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 12: End-of-life treatment of sold products — Will this category be included?',
    },
    helper: {
      tr: 'Satılan ürünlerin kullanım ömrü dolduğunda bertaraf veya geri dönüşüm sürecindeki emisyonlar.',
      en: 'Emissions from disposal or recycling of sold products at end of life.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C13-1',
  },
  {
    id: 'K3C13-1',
    number: 78,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat13.include',
    text: {
      tr: 'Kapsam 3 Kategori 13: Aşağı yönlü kiralık varlıklar — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 13: Downstream leased assets — Will this category be included?',
    },
    helper: {
      tr: 'Şirketin başkalarına kiraladığı varlıkların (bina, araç vb.) kullanım emisyonları.',
      en: 'Use emissions of assets leased by the company to others (buildings, vehicles, etc.).',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C14-1',
  },
  {
    id: 'K3C14-1',
    number: 79,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat14.include',
    text: {
      tr: 'Kapsam 3 Kategori 14: Franchiseelar — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 14: Franchises — Will this category be included?',
    },
    helper: {
      tr: 'Franchise veren şirketler için franchise alıcıların faaliyetlerinden kaynaklanan emisyonlar.',
      en: 'For franchisors: emissions from franchisee operations.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3C15-1',
  },
  {
    id: 'K3C15-1',
    number: 80,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: false,
    reportField: 'scope3.cat15.include',
    text: {
      tr: 'Kapsam 3 Kategori 15: Yatırımlar — Bu kategori dahil edilecek mi?',
      en: 'Scope 3 Category 15: Investments — Will this category be included?',
    },
    helper: {
      tr: 'Finans sektörü ve yatırımcı şirketler için yatırım portföyünden kaynaklanan emisyonlar.',
      en: 'For finance sector and investor companies: emissions from investment portfolio.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: 'K3-TY',
  },
  {
    id: 'K3-TY',
    number: 81,
    stage: 5,
    block: '5A',
    isoRef: 'ISO 14064-1 §5.4',
    type: 'single_select',
    required: true,
    reportField: 'scope3.confirmed',
    text: {
      tr: 'Kapsam 3 kategori seçimlerinizi onaylıyor musunuz?',
      en: 'Do you confirm your Scope 3 category selections?',
    },
    helper: {
      tr: 'Seçilen kategoriler raporunuzda belgelenecek. Dahil edilmeyen kategoriler için gerekçeler 6. Aşama\'da girilecek.',
      en: 'Selected categories will be documented in your report. Reasons for excluded categories will be entered in Stage 6.',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet, seçimlerimi onaylıyorum', en: 'Yes, I confirm my selections' } },
      { value: 'needs_review', label: { tr: 'Gözden geçirmem gerekiyor', en: 'I need to review' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '6A-1',
  },

  // ── STAGE 6 ─ Exclusions, Assumptions, Exceptions ────────────────────────
  {
    id: '6A-1',
    number: 82,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'info',
    required: false,
    text: {
      tr: 'Aşama 6: Hariç Tutmalar, Kabuller ve İstisnalar',
      en: 'Stage 6: Exclusions, Assumptions, and Exceptions',
    },
    helper: {
      tr: 'Bu aşamada kapsam dışı bırakılan kaynakların gerekçelerini, kullanılan varsayımları ve veri belirsizliklerini belgeleyeceğiz. ISO 14064-1 bu bilgilerin raporlanmasını zorunlu kılmaktadır.',
      en: 'In this stage, we will document the reasons for excluded sources, assumptions used, and data uncertainties. ISO 14064-1 requires this information to be reported.',
    },
    next: '6A-2',
  },
  {
    id: '6A-2',
    number: 83,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 600,
    reportField: 'exclusions.sources',
    text: {
      tr: 'Kapsam dışı bırakılan GHG kaynakları ve gerekçelerini açıklayın.',
      en: 'Describe the GHG sources excluded from the inventory and the reasons.',
    },
    placeholder: {
      tr: 'Örn: Yurt dışı depo — veri erişilemez; Şirket arabası (çalışan ödentisi) — materyalite eşiği altında',
      en: 'Example: Overseas warehouse — data inaccessible; Company car (employee allowance) — below materiality threshold',
    },
    helper: {
      tr: 'Tüm önemli dışlamalar ISO 14064-1 uyarınca belgelenmelidir. Dışlama yoksa bu alanı boş bırakabilirsiniz.',
      en: 'All significant exclusions must be documented under ISO 14064-1. Leave blank if there are no exclusions.',
    },
    next: '6A-3',
  },
  {
    id: '6A-3',
    number: 84,
    stage: 6,
    block: '6A',
    isoRef: 'ISO 14064-1 §5.1',
    type: 'single_select',
    required: true,
    reportField: 'exclusions.materiality_threshold',
    text: {
      tr: 'Materyalite (önemlilik) eşiği uyguladınız mı?',
      en: 'Have you applied a materiality threshold for exclusions?',
    },
    helper: {
      tr: 'ISO 14064-1, toplam Kapsam 1+2 emisyonlarının %5\'inden düşük kaynakların dışarıda bırakılabileceğini belirtir.',
      en: 'ISO 14064-1 states that sources below 5% of total Scope 1+2 emissions may be excluded.',
    },
    options: [
      { value: 'yes_5pct', label: { tr: 'Evet — %5 eşiği altındaki kaynaklar hariç tutuldu', en: 'Yes — sources below 5% threshold excluded' } },
      { value: 'yes_other', label: { tr: 'Evet — farklı bir eşik uygulandı', en: 'Yes — a different threshold was applied' } },
      { value: 'no', label: { tr: 'Hayır — eşik uygulanmadı, tüm kaynaklar dahil', en: 'No — no threshold applied, all sources included' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '6B-1',
  },
  {
    id: '6B-1',
    number: 85,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'text',
    subtype: 'multi_line',
    required: false,
    maxLength: 600,
    reportField: 'assumptions.methodology',
    text: {
      tr: 'Emisyon hesabında kullanılan metodolojik varsayımları açıklayın.',
      en: 'Describe the methodological assumptions used in the emission calculations.',
    },
    placeholder: {
      tr: 'Örn: Uzak çalışanlar için ev enerjisi tahmin kullanıldı; bazı tesisler için fatura yerine sayaç endeksi esas alındı.',
      en: 'Example: Home energy estimates used for remote workers; meter readings used instead of invoices for some facilities.',
    },
    helper: {
      tr: 'Tüm önemli varsayımlar ISO 14064-1\'e uygun biçimde raporlanmalıdır.',
      en: 'All significant assumptions must be reported in compliance with ISO 14064-1.',
    },
    next: '6B-2',
  },
  {
    id: '6B-2',
    number: 86,
    stage: 6,
    block: '6B',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'assumptions.data_gaps',
    text: {
      tr: 'Veri boşlukları için tahmin veya varsayılan değer kullandınız mı?',
      en: 'Did you use estimates or default values to fill any data gaps?',
    },
    options: [
      { value: 'yes_significant', label: { tr: 'Evet — önemli miktarda tahmin kullanıldı', en: 'Yes — significant estimates used' } },
      { value: 'yes_minor', label: { tr: 'Evet — küçük bazı boşluklar tahminle dolduruldu', en: 'Yes — minor gaps filled with estimates' } },
      { value: 'no', label: { tr: 'Hayır — tüm veriler gerçek', en: 'No — all data are actual' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '6C-1',
  },
  {
    id: '6C-1',
    number: 87,
    stage: 6,
    block: '6C',
    isoRef: 'ISO 14064-1 §7.3',
    type: 'single_select',
    required: true,
    reportField: 'uncertainty.level',
    text: {
      tr: 'Genel veri belirsizliği düzeyini nasıl değerlendiriyorsunuz?',
      en: 'How do you assess the overall data uncertainty level?',
    },
    helper: {
      tr: 'ISO 14064-1, belirsizlik değerlendirmesini zorunlu kılmaktadır. Bu bilgi raporunuzun doğrulama bölümünde yer alacak.',
      en: 'ISO 14064-1 requires an uncertainty assessment. This information will appear in the verification section of your report.',
    },
    options: [
      { value: 'low', label: { tr: 'Düşük — çoğunlukla ölçüm/fatura verisi', en: 'Low — mostly measured/invoice data' } },
      { value: 'medium', label: { tr: 'Orta — bazı tahminler içeriyor', en: 'Medium — contains some estimates' } },
      { value: 'high', label: { tr: 'Yüksek — önemli ölçüde tahmin içeriyor', en: 'High — significant estimates included' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen belirsizlik düzeyini seçin.', en: 'Please select an uncertainty level.' },
    },
    next: '6D-1',
  },
  {
    id: '6D-1',
    number: 88,
    stage: 6,
    block: '6D',
    isoRef: 'ISO 14064-1 §7.4',
    type: 'single_select',
    required: true,
    reportField: 'recalculation.needed',
    text: {
      tr: 'Önceki yıl raporuyla karşılaştırıldığında yeniden hesaplama (recalculation) gerekiyor mu?',
      en: 'Is recalculation required compared to the previous year\'s report?',
    },
    helper: {
      tr: 'Organizasyon sınırı, metodoloji veya emisyon faktörü değişikliklerinde baz yıl yeniden hesaplanmalıdır. İlk raporunuzsa bu soruyu atlayabilirsiniz.',
      en: 'Baseline year must be recalculated if there are changes in organizational boundary, methodology, or emission factors. You may skip this if it\'s your first report.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet — baz yıl yeniden hesaplanacak', en: 'Yes — baseline year will be recalculated' } },
      { value: 'no', label: { tr: 'Hayır — yeniden hesaplama gerekmiyor', en: 'No — no recalculation needed' } },
      { value: 'first_report', label: { tr: 'İlk raporum — geçerli değil', en: 'First report — not applicable' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '6E-1',
  },
  {
    id: '6E-1',
    number: 89,
    stage: 6,
    block: '6E',
    isoRef: 'ISO 14064-1 §5.5',
    type: 'single_select',
    required: false,
    reportField: 'removals.exists',
    text: {
      tr: 'GHG giderme (removal) veya soyurma faaliyetleriniz var mı?',
      en: 'Do you have any GHG removal or sequestration activities?',
    },
    helper: {
      tr: 'Ormancılık, toprak karbon yönetimi veya teknik karbon tutma/depolama faaliyetleri bu kategoriye girer.',
      en: 'Forestry, soil carbon management, or technical carbon capture and storage activities fall under this category.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '6F-1',
  },
  {
    id: '6F-1',
    number: 90,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.5',
    type: 'single_select',
    required: false,
    reportField: 'offsets.exists',
    text: {
      tr: 'Karbon kredisi veya offset satın aldınız mı?',
      en: 'Have you purchased any carbon credits or offsets?',
    },
    helper: {
      tr: 'VCS, Gold Standard, CDM vb. karbon kredileri. Offset satın alımı raporunuzda ayrıca belgelenecek.',
      en: 'Carbon credits under VCS, Gold Standard, CDM, etc. Offset purchases will be separately documented in your report.',
    },
    options: [
      { value: 'yes', label: { tr: 'Evet', en: 'Yes' } },
      { value: 'no', label: { tr: 'Hayır', en: 'No' } },
    ],
    next: '6F-2',
  },
  {
    id: '6F-2',
    number: 91,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.5',
    type: 'text',
    subtype: 'numeric',
    required: false,
    maxLength: 15,
    reportField: 'offsets.amount_tco2e',
    text: {
      tr: 'Satın alınan karbon kredisi miktarı nedir? (tCO₂e)',
      en: 'What is the amount of carbon credits purchased? (tCO₂e)',
    },
    placeholder: { tr: 'Örn: 1000', en: 'Example: 1000' },
    helper: {
      tr: 'Yoksa 0 girin veya boş bırakın.',
      en: 'Enter 0 or leave blank if none.',
    },
    next: '6F-3',
  },
  {
    id: '6F-3',
    number: 92,
    stage: 6,
    block: '6F',
    isoRef: 'ISO 14064-1 §5.5',
    type: 'single_select',
    required: true,
    reportField: 'stage6.confirmed',
    text: {
      tr: 'Hariç tutmalar, kabuller ve istisnalar bölümünü onaylıyor musunuz?',
      en: 'Do you confirm the exclusions, assumptions, and exceptions section?',
    },
    options: [
      { value: 'confirmed', label: { tr: 'Evet, onaylıyorum', en: 'Yes, I confirm' } },
      { value: 'needs_review', label: { tr: 'Gözden geçirmem gerekiyor', en: 'I need to review' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir seçenek belirtin.', en: 'Please select an option.' },
    },
    next: '7C-1',
  },

  // ── STAGE 7 ─ Report Generation ───────────────────────────────────────────
  {
    id: '7C-1',
    number: 93,
    stage: 7,
    block: '7A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'single_select',
    required: true,
    reportField: 'report.format',
    text: {
      tr: 'Raporu hangi formatta almak istersiniz?',
      en: 'In what format would you like to receive the report?',
    },
    helper: {
      tr: 'PDF raporu ISO 14064-1 uyumlu tam format içerir. Dashboard özeti anlık bir görünüm sunar.',
      en: 'The PDF report contains the full ISO 14064-1 compliant format. The dashboard summary provides an instant overview.',
    },
    options: [
      { value: 'pdf_full', label: { tr: 'PDF — Tam ISO 14064-1 raporu', en: 'PDF — Full ISO 14064-1 report' } },
      { value: 'pdf_summary', label: { tr: 'PDF — Özet rapor', en: 'PDF — Summary report' } },
      { value: 'both', label: { tr: 'Her ikisi — tam rapor + özet', en: 'Both — full report + summary' } },
      { value: 'dashboard_only', label: { tr: 'Yalnızca dashboard görünümü', en: 'Dashboard view only' } },
    ],
    validate: {
      requiredMessage: { tr: 'Lütfen bir rapor formatı seçin.', en: 'Please select a report format.' },
    },
    next: '7C-2',
  },
  {
    id: '7C-2',
    number: 94,
    stage: 7,
    block: '7A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'single_select',
    required: false,
    reportField: 'report.language',
    text: {
      tr: 'Rapor hangi dilde hazırlansın?',
      en: 'In which language should the report be prepared?',
    },
    options: [
      { value: 'tr', label: { tr: 'Türkçe', en: 'Turkish' } },
      { value: 'en', label: { tr: 'İngilizce', en: 'English' } },
      { value: 'both', label: { tr: 'Her iki dilde (Türkçe + İngilizce)', en: 'Both languages (Turkish + English)' } },
    ],
    next: '7A-INFO',
  },
  {
    id: '7A-INFO',
    number: 95,
    stage: 7,
    block: '7A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'info',
    required: false,
    text: {
      tr: 'Raporunuz Hazırlanıyor',
      en: 'Your Report is Being Prepared',
    },
    helper: {
      tr: 'Tüm sorular tamamlandı. Sistem şimdi verilerinizi işleyerek ISO 14064-1 uyumlu GHG envanter raporunuzu oluşturuyor. Bu işlem birkaç dakika sürebilir.',
      en: 'All questions are complete. The system is now processing your data to generate your ISO 14064-1 compliant GHG inventory report. This may take a few minutes.',
    },
    next: '7B-INFO',
  },
  {
    id: '7B-INFO',
    number: 96,
    stage: 7,
    block: '7A',
    isoRef: 'ISO 14064-1 §7.5',
    type: 'info',
    required: false,
    text: {
      tr: 'Envanter Tamamlandı',
      en: 'Inventory Complete',
    },
    helper: {
      tr: 'GHG envanteriniz başarıyla tamamlandı. Raporunuz dashboard\'unuzda hazır. ISO 14064-1 kapsamındaki tüm aşamalar başarıyla dolduruldu.',
      en: 'Your GHG inventory has been successfully completed. Your report is ready in your dashboard. All stages under ISO 14064-1 have been successfully completed.',
    },
    next: null,
  },
];

export function getQuestionById(id) {
  return CARBONIQ_QUESTIONS.find((question) => question.id === id);
}

export function getInitialQuestionId() {
  return 'A1';
}

export function getNextQuestionId(question, answer) {
  if (!question) return null;
  if (question.nextByValue && typeof answer === 'string') {
    return question.nextByValue[answer] || question.next || null;
  }
  return question.next || null;
}

export function validateCarbonIQAnswer(question, value, answers = {}, lang = 'en') {
  if (!question) return { ok: false, message: 'Question not found.' };

  // Info screens never need validation
  if (question.type === 'info') return { ok: true };

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

export function getTriggeredAssumptions(question, value, lang = 'en') {
  if (!question?.assumptions) return [];
  return question.assumptions
    .filter((assumption) => assumption.when?.equals === value)
    .map((assumption) => ({
      questionId: question.id,
      type: assumption.type,
      trigger: assumption.trigger,
      text: assumption.text?.[lang],
      impact: assumption.impact,
    }));
}
