// ─── Shared emission constants used across dashboard components ───────────────

export const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
export const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const getMonths = (tr) => (tr ? MONTHS_TR : MONTHS_EN);

export const SCOPE_META = {
  scope1: { label: 'Scope 1', bg: 'bg-[#302817]/10', text: 'text-[#302817]',   bar: '#302817' },
  scope2: { label: 'Scope 2', bg: 'bg-[#95A847]/15', text: 'text-[#75863B]',   bar: '#95A847' },
  scope3: { label: 'Scope 3', bg: 'bg-[#B4BE6A]/20', text: 'text-[#75863B]',   bar: '#B4BE6A' },
};

export const STATUS_META = {
  submitted: { bg: 'bg-amber-100',    text: 'text-amber-700',   tr: 'Beklemede', en: 'Pending'  },
  approved:  { bg: 'bg-[#95A847]/12', text: 'text-[#75863B]',   tr: 'Onaylı',    en: 'Approved' },
  draft:     { bg: 'bg-[#302817]/8',  text: 'text-[#302817]/50', tr: 'Taslak',   en: 'Draft'    },
};

export const CATEGORY_LABELS = {
  stationary_combustion:       { tr: 'Sabit Yanma',           en: 'Stationary Combustion'   },
  mobile_combustion:           { tr: 'Mobil Yanma',            en: 'Mobile Combustion'       },
  fugitive_emissions:          { tr: 'Kaçak Emisyon',          en: 'Fugitive Emissions'      },
  process_emissions:           { tr: 'Proses',                 en: 'Process Emissions'       },
  electricity:                 { tr: 'Elektrik',               en: 'Electricity'             },
  steam_heat:                  { tr: 'Buhar / Isı',            en: 'Steam & Heat'            },
  purchased_goods:             { tr: 'Satın Alınan Mal',       en: 'Purchased Goods'         },
  capital_goods:               { tr: 'Sermaye Malları',         en: 'Capital Goods'           },
  fuel_energy:                 { tr: 'Yakıt & Enerji',         en: 'Fuel & Energy'           },
  upstream_transport:          { tr: 'Yukarı Akış Taşıma',     en: 'Upstream Transport'      },
  waste:                       { tr: 'Atık',                   en: 'Waste'                   },
  business_travel:             { tr: 'İş Seyahati',            en: 'Business Travel'         },
  employee_commuting:          { tr: 'Çalışan Ulaşımı',        en: 'Employee Commuting'      },
  upstream_leased:             { tr: 'Kiral. Var. (Yukarı)',    en: 'Upstream Leased'         },
  downstream_transport:        { tr: 'Aşağı Akış Taşıma',      en: 'Downstream Transport'    },
  processing_of_sold_products: { tr: 'Satılan Ürün İşleme',    en: 'Processing Sold Products'},
  use_of_sold_products:        { tr: 'Satılan Ürün Kullanımı', en: 'Use of Sold Products'    },
  end_of_life:                 { tr: 'Ömür Sonu',              en: 'End of Life'             },
  downstream_leased:           { tr: 'Kiral. Var. (Aşağı)',    en: 'Downstream Leased'       },
  franchises:                  { tr: 'Franchise',              en: 'Franchises'              },
  investments:                 { tr: 'Yatırımlar',             en: 'Investments'             },
  water:                       { tr: 'Su',                     en: 'Water'                   },
  custom:                      { tr: 'Özel',                   en: 'Custom'                  },
  // Legacy keys (DashboardOverview)
  combustion:                  { tr: 'Sabit Yanma',            en: 'Stationary Combustion'   },
  fleet_vehicles:              { tr: 'Araç Filosu',             en: 'Fleet Vehicles'          },
  freight:                     { tr: 'Yük Taşıma',             en: 'Freight'                 },
  refrigerants:                { tr: 'Soğutucu Gaz',           en: 'Refrigerants'            },
};

export const catLabel = (key, tr) => CATEGORY_LABELS[key]?.[tr ? 'tr' : 'en'] ?? key;
export const scopeLabel = (s) => SCOPE_META[s]?.label ?? s;
export const fmt = (n, d = 2) => parseFloat(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });

export const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/jpeg','image/png','image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
