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
    next: 'B1',
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
