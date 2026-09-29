// ─── Shared emission constants used across dashboard components ───────────────

import { num } from '@/lib/formatNumber';

export const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
export const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const getMonths = (tr) => (tr ? MONTHS_TR : MONTHS_EN);

export const SCOPE_META = {
  scope1: { label: 'Scope 1', bg: 'bg-[#072C0E]/10', text: 'text-[#072C0E]',   bar: '#072C0E' },
  scope2: { label: 'Scope 2', bg: 'bg-[#2ABD41]/15', text: 'text-[#1D9C31]',   bar: '#2ABD41' },
  scope3: { label: 'Scope 3', bg: 'bg-[#8BEA99]/20', text: 'text-[#1D9C31]',   bar: '#8BEA99' },
};

export const STATUS_META = {
  submitted: { bg: 'bg-amber-100',    text: 'text-amber-700',   tr: 'Beklemede', en: 'Pending'  },
  approved:  { bg: 'bg-[#2ABD41]/12', text: 'text-[#1D9C31]',   tr: 'Onaylı',    en: 'Approved' },
  // An approver's "reject" moves an entry to draft with a rejected_reason.
  draft:     { bg: 'bg-red-50',        text: 'text-red-600',      tr: 'Reddedildi', en: 'Rejected' },
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
  // The codes EmissionFactor.category actually uses for these two (the
  // long forms above never occur there, so the dropdown showed the raw code).
  processing_sold:             { tr: 'Satılan Ürün İşleme',    en: 'Processing Sold Products'},
  use_of_sold:                 { tr: 'Satılan Ürün Kullanımı', en: 'Use of Sold Products'    },
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
// Display names for EmissionFactor.unit codes (stored lower-case: kwh, m3…).
const UNIT_LABELS = {
  kwh: 'kWh', mwh: 'MWh', gj: 'GJ', m3: 'm³', m2: 'm²', kg: 'kg', km: 'km', usd: 'USD',
  liters: { tr: 'litre', en: 'litres' }, tonne: { tr: 'ton', en: 'tonnes' },
  tonnes: { tr: 'ton', en: 'tonnes' }, franchises: { tr: 'franchise', en: 'franchises' },
  'tonne-km': { tr: 'ton-km', en: 'tonne-km' }, pkm: { tr: 'yolcu-km', en: 'passenger-km' },
  'person-km': { tr: 'yolcu-km', en: 'passenger-km' }, night: { tr: 'gece', en: 'nights' },
  nights: { tr: 'gece', en: 'nights' }, units: { tr: 'adet', en: 'units' },
  packages: { tr: 'paket', en: 'packages' }, days: { tr: 'gün', en: 'days' },
  employees: { tr: 'çalışan', en: 'employees' },
};
export const unitLabel = (u, tr) => {
  const l = UNIT_LABELS[u];
  if (!l) return u;
  return typeof l === 'string' ? l : (tr ? l.tr : l.en);
};

// In the UI language (see lib/formatNumber).
export const fmt = (n, d = 2) => num(n, d);

// "per" form of a unit, for factors: kg CO₂e per litre / tonne / unit.
const PER_UNIT = {
  liters: { tr: 'litre', en: 'litre' }, tonne: { tr: 'ton', en: 'tonne' },
  tonnes: { tr: 'ton', en: 'tonne' }, pkm: { tr: 'yolcu-km', en: 'passenger-km' },
  'person-km': { tr: 'yolcu-km', en: 'passenger-km' }, night: { tr: 'gece', en: 'night' },
  nights: { tr: 'gece', en: 'night' }, units: { tr: 'adet', en: 'unit' },
  packages: { tr: 'paket', en: 'package' }, days: { tr: 'gün', en: 'day' },
  employees: { tr: 'çalışan', en: 'employee' }, franchises: { tr: 'franchise', en: 'franchise' },
};
// An emission factor for display: "25.200 kg CO₂e/kg", "2,68 kg CO₂e/litre"
// (the stored value, up to 6 decimals, trailing zeros dropped).
export const factorLabel = (value, unit, tr) => {
  const per = PER_UNIT[unit] ? PER_UNIT[unit][tr ? 'tr' : 'en'] : unitLabel(unit, tr);
  return `${num(value, 6)} kg CO₂e/${per}`;
};

export const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/jpeg','image/png','image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
