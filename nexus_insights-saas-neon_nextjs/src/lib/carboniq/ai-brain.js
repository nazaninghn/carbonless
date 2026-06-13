/**
 * CarbonIQ AI Brain — client-side intelligence layer
 *
 * Provides intent detection, knowledge-base Q&A, status reporting,
 * benchmark context, and smart fallbacks for the chat assistant.
 * All functions are pure (no side effects) so they work in preview mode
 * and production mode alike.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EMISSION FACTORS  (mirrors ChatWorkspace — used for status calculation)
// ═══════════════════════════════════════════════════════════════════════════════
const EF_CALC = {
  natural_gas: { 'm³': 2.02, m3: 2.02, kwh: 0.183, kWh: 0.183, gj: 50.77, GJ: 50.77, mcf: 57.17, MCF: 57.17 },
  diesel:      { litre: 2.54, liter: 2.54, l: 2.54, kg: 2.68, ton: 2680, tonne: 2680 },
  lpg:         { litre: 1.51, liter: 1.51, kg: 2.94, ton: 2940, tonne: 2940 },
  fuel_oil:    { litre: 2.52, kg: 2.96, ton: 2960, tonne: 2960, GJ: 74.07 },
  // DEFRA 2023 — mixed coal / industrial coal
  coal:        { kg: 2.42, ton: 2420, tonne: 2420, GJ: 88.34 },
  // DEFRA 2023 — biomass (oven dry wood)
  biomass:     { kg: 0.39, ton: 390, tonne: 390, GJ: 10.23 },
};
const EF_ELEC = 0.439; // IEA 2023 Turkey

function _calcScope1(vals) {
  const fuel = vals['rf.3a.fuel_type'];
  const amt  = parseFloat(vals['rf.3a.consumption']);
  // Normalise unit: accept common variants regardless of case
  const rawUnit = (vals['rf.3a.unit'] || 'm³').replace(/m\^3/i, 'm³');
  const UNIT_NORM = { 'kwh': 'kWh', 'KWH': 'kWh', 'gj': 'GJ', 'mcf': 'MCF' };
  const unit = UNIT_NORM[rawUnit] || rawUnit;
  if (!fuel || isNaN(amt) || amt <= 0) return 0;
  const efMap = EF_CALC[fuel] || {};
  const ef = efMap[unit] || efMap['m³'] || efMap['litre'] || 0;
  return Math.round(amt * ef);
}

function _calcScope2(vals) {
  const kwh = parseFloat(vals['rf.4a.consumption_kwh']);
  const ef  = parseFloat(vals['rf.4a.emission_factor']) || EF_ELEC;
  if (isNaN(kwh) || kwh <= 0) return 0;
  return Math.round(kwh * ef);
}

function _fmtKg(kg) {
  if (!kg || kg <= 0) return '0 kgCO₂e';
  return kg >= 1000
    ? `${(kg / 1000).toFixed(2)} tCO₂e`
    : `${Math.round(kg).toLocaleString()} kgCO₂e`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════════
const KB = [
  // ── ISO 14064-1 ──────────────────────────────────────────────────────────────
  {
    id: 'iso_overview',
    match: /iso.?14064|ghg.?protokol|sera\s*gaz[ıi]\s*protokol|greenhouse.?gas.?protocol|uyum\s*gereksinim/i,
    answer: {
      tr: `**ISO 14064-1 Nedir?**\n\nKuruluşların sera gazı (GHG) envanteri hazırlaması için uluslararası standarttır (2018 revizyon).\n\n**Temel gereksinimler:**\n→ Organizasyon sınırı belirleme (kontrol veya öz sermaye payı)\n→ Kapsam 1, 2 ve önemli Kapsam 3 emisyonlarının hesaplanması\n→ Baz yıl belirleme ve yeniden hesaplama politikası\n→ Veri kalitesi belgelenemesi\n→ Hariç tutmalar ve kabuller\n\n**Türkiye'de durum:**\n→ Büyük sanayi tesisleri için ÇKDYY kapsamında zorunlu\n→ AB'ye ihracat yapanlar için CBAM nedeniyle kritik\n→ SPK listelilerin ESG açıklamaları kapsamında tavsiye edilen\n\n💡 **Tavsiye:** 📋 Rehberli Mod ile tüm 7 aşamayı birlikte tamamlayabiliriz.`,
      en: `**What is ISO 14064-1?**\n\nThe international standard for organizations to prepare their greenhouse gas (GHG) inventory (2018 revision).\n\n**Key requirements:**\n→ Define organizational boundary (control or equity share approach)\n→ Calculate Scope 1, 2, and significant Scope 3 emissions\n→ Establish base year and recalculation policy\n→ Document data quality\n→ Exclusions and assumptions\n\n**Status in Turkey:**\n→ Mandatory for large industrial facilities under environmental regulations\n→ Critical for EU exporters due to CBAM\n→ Recommended for listed companies under ESG disclosures\n\n💡 **Tip:** Use **📋 Guided Mode** to complete all 7 stages together.`
    }
  },

  // ── Scope 1 ──────────────────────────────────────────────────────────────────
  {
    id: 'scope1',
    match: /kapsam\s*1\b|scope\s*1\b|birinci\s*kapsam|doğrudan\s*emis/i,
    answer: {
      tr: `**Kapsam 1 — Doğrudan Emisyonlar**\n\nKuruluşun sahip olduğu veya kontrol ettiği kaynaklardan çıkan emisyonlar.\n\n**Tipik kaynaklar:**\n→ 🔥 Doğalgaz yakma (ısıtma, proses) — **2,02 kgCO₂e/m³**\n→ 🛢️ Dizel (jeneratör, kazan) — **2,54 kgCO₂e/litre**\n→ 🟡 LPG — **1,51 kgCO₂e/litre**\n→ 🚗 Şirket araçları (benzin/dizel)\n→ ❄️ Kaçak soğutucu gaz\n→ ⚙️ Proses emisyonları (çimento, çelik)\n\n**Faktör kaynağı:** DEFRA 2023\n\n**Örnek:** "15.000 m³ doğalgaz kullandık" yazmanız yeterli — hesabı otomatik yaparım.`,
      en: `**Scope 1 — Direct Emissions**\n\nEmissions from sources owned or controlled by the organization.\n\n**Typical sources:**\n→ 🔥 Natural gas combustion (heating, process) — **2.02 kgCO₂e/m³**\n→ 🛢️ Diesel (generator, boiler) — **2.54 kgCO₂e/litre**\n→ 🟡 LPG — **1.51 kgCO₂e/litre**\n→ 🚗 Company vehicles (petrol/diesel)\n→ ❄️ Fugitive refrigerant gas\n→ ⚙️ Process emissions (cement, steel)\n\n**Factor source:** DEFRA 2023\n\n**Example:** Just write "We used 15,000 m³ natural gas" — I'll calculate automatically.`
    }
  },

  // ── Scope 2 ──────────────────────────────────────────────────────────────────
  {
    id: 'scope2',
    match: /kapsam\s*2\b|scope\s*2\b|ikinci\s*kapsam|satın\s*alınan\s*elektrik|purchased.?electricity/i,
    answer: {
      tr: `**Kapsam 2 — Enerji Dolaylı Emisyonlar**\n\nSatın alınan elektrik, ısı veya buharın üretiminden kaynaklanan emisyonlar.\n\n**Türkiye TEIAS grid faktörü (IEA 2023):**\n→ **0,439 kgCO₂e/kWh** ← Sistemde kullanılan değer\n\n**Yıllara göre değişim:**\n→ 2021: 0,499 → 2022: 0,463 → 2023: **0,439** (↓ yenilenebilir artışı)\n\n**Hesaplama:**\n→ 18.000 kWh × 0,439 = **7.902 kgCO₂e = 7,9 tCO₂e**\n\n**İki yöntem:**\n→ **Konum tabanlı:** Grid ortalaması (0,439) — faturanızdan\n→ **Piyasa tabanlı:** GO/REC sertifikası varsa daha düşük faktör\n\n💡 Elektrik tüketiminizi kWh olarak paylaşın — otomatik hesaplayayım.`,
      en: `**Scope 2 — Energy Indirect Emissions**\n\nEmissions from generation of purchased electricity, heat, or steam.\n\n**Turkey TEIAS grid factor (IEA 2023):**\n→ **0.439 kgCO₂e/kWh** ← Value used in this system\n\n**Year-on-year change:**\n→ 2021: 0.499 → 2022: 0.463 → 2023: **0.439** (↓ renewables growth)\n\n**Calculation:**\n→ 18,000 kWh × 0.439 = **7,902 kgCO₂e = 7.9 tCO₂e**\n\n**Two methods:**\n→ **Location-based:** Grid average (0.439) — from your invoice\n→ **Market-based:** If GO/REC certificate available, lower factor\n\n💡 Share your electricity consumption in kWh — I'll calculate automatically.`
    }
  },

  // ── Scope 3 ──────────────────────────────────────────────────────────────────
  {
    id: 'scope3',
    match: /kapsam\s*3\b|scope\s*3\b|üçüncü\s*kapsam|değer\s*zinciri|value.?chain|tedarik\s*zinciri|supply.?chain/i,
    answer: {
      tr: `**Kapsam 3 — Diğer Dolaylı Emisyonlar**\n\nDeğer zincirindeki tüm diğer dolaylı emisyonlar. ISO 14064-1'de 15 kategori vardır.\n\n**Çoğu Türk şirketi için öncelikli kategoriler:**\n\n→ **Kat.4 Upstream Taşıma** 🚛\n  Tedarikçiden fabrikaya/depoya taşıma (ton×km)\n  Faktör: HGV **0,0614** · Deniz **0,00681** · Hava **0,7027 kgCO₂e/tkm**\n\n→ **Kat.6 İş Seyahati** ✈️\n  Uçuş: Kısa **0,153** · Uzun **0,195 kgCO₂e/pkm**\n  Tren: **0,035 kgCO₂e/pkm**\n\n→ **Kat.1 Satın Alınan Ürün/Hizmet** 🏭\n  Genellikle en büyük Kapsam 3 kalemi\n\n→ **Kat.7 Çalışan Kommüt** 🚌\n  Çalışanların işe gidip gelme emisyonları\n\n**Faktör kaynağı:** GLEC v3 (taşıma), DEFRA 2023 (seyahat)`,
      en: `**Scope 3 — Other Indirect Emissions**\n\nAll other indirect emissions in the value chain. ISO 14064-1 has 15 categories.\n\n**Priority categories for most Turkish companies:**\n\n→ **Cat.4 Upstream Transport** 🚛\n  Transport from supplier to factory/warehouse (tonne×km)\n  Factor: HGV **0.0614** · Sea **0.00681** · Air **0.7027 kgCO₂e/tkm**\n\n→ **Cat.6 Business Travel** ✈️\n  Flights: Short-haul **0.153** · Long-haul **0.195 kgCO₂e/pkm**\n  Rail: **0.035 kgCO₂e/pkm**\n\n→ **Cat.1 Purchased Goods/Services** 🏭\n  Usually the largest Scope 3 item\n\n→ **Cat.7 Employee Commuting** 🚌\n  Emissions from employee travel to/from work\n\n**Factor sources:** GLEC v3 (transport), DEFRA 2023 (travel)`
    }
  },

  // ── CO2e ─────────────────────────────────────────────────────────────────────
  {
    id: 'co2e',
    match: /\bco2e\b|co₂e|kge\b|karbondioksit\s*eş|carbon\s*dioxide\s*equiv|\bgwp\b|global.?warm/i,
    answer: {
      tr: `**CO₂e (Karbondioksit Eşdeğeri) Nedir?**\n\nFarklı sera gazlarını tek bir ölçülebilir birimde ifade eden metrik.\n\n**Sera gazları ve GWP değerleri (IPCC AR6 / 100 yıl):**\n→ CO₂ — karbondioksit: **GWP = 1**\n→ CH₄ — metan (doğalgaz kaçakları): **GWP = 27,9**\n→ N₂O — azot dioksit (tarım, yakıt): **GWP = 273**\n→ SF₆ — elektrik ekipmanı: **GWP = 25.200**\n→ HFC-134a — soğutucu: **GWP = 1.530**\n\n**Örnek hesaplama:**\n→ 1 kg CH₄ = 27,9 kg CO₂e\n→ 1 kg N₂O = 273 kg CO₂e\n\n**Neden kullanılır?** Farklı gazları tek envanter rakamında toplamak için. 1 tCO₂e = 1.000 kgCO₂e.`,
      en: `**What is CO₂e (Carbon Dioxide Equivalent)?**\n\nA metric to express different greenhouse gases in a single measurable unit.\n\n**Greenhouse gases and GWP values (IPCC AR6 / 100 years):**\n→ CO₂ — carbon dioxide: **GWP = 1**\n→ CH₄ — methane (natural gas leaks): **GWP = 27.9**\n→ N₂O — nitrous oxide (agriculture, fuel): **GWP = 273**\n→ SF₆ — electrical equipment: **GWP = 25,200**\n→ HFC-134a — refrigerant: **GWP = 1,530**\n\n**Example:**\n→ 1 kg CH₄ = 27.9 kg CO₂e\n→ 1 kg N₂O = 273 kg CO₂e\n\n**Why use it?** To combine different gases into a single inventory number. 1 tCO₂e = 1,000 kgCO₂e.`
    }
  },

  // ── Emission factors ─────────────────────────────────────────────────────────
  {
    id: 'emission_factors',
    match: /emisyon\s*faktör|emission\s*factor|\bdefra\b|\biea\b|\bglec\b|hangi\s*faktör|which\s*factor|nereden.*faktör/i,
    answer: {
      tr: `**Emisyon Faktörü Kaynakları**\n\nBu sistemde 3 uluslararası veritabanı kullanılır:\n\n**🇬🇧 DEFRA 2023** (UK Çevre Bakanlığı)\n→ Yakıt yanması: doğalgaz, dizel, LPG, fuel oil, kömür\n→ İş seyahati: uçuş, tren, araç kiralama\n→ Güncellenme: Her yıl (son: Temmuz 2023)\n\n**⚡ IEA 2023** (Uluslararası Enerji Ajansı)\n→ Türkiye elektrik şebekesi: **0,439 kgCO₂e/kWh**\n→ Ülkeye özgü grid faktörleri\n→ Kaynak: TEIAS + Enerji Bakanlığı verileri\n\n**🚢 GLEC v3** (Smart Freight Centre)\n→ Yük taşımacılığı: karayolu, denizyolu, havayolu, demiryolu\n→ Her mod için ayrı faktör (tam yük / kısmi yük)\n→ Küresel en güncel nakliye veri tabanı\n\n**Neden 3 kaynak?** Her kaynak kendi alanında en yetkili ve güncel veriyi sunar.`,
      en: `**Emission Factor Sources**\n\nThis system uses 3 international databases:\n\n**🇬🇧 DEFRA 2023** (UK Department for Environment)\n→ Fuel combustion: natural gas, diesel, LPG, fuel oil, coal\n→ Business travel: flights, rail, car rental\n→ Updated: Annually (last: July 2023)\n\n**⚡ IEA 2023** (International Energy Agency)\n→ Turkey electricity grid: **0.439 kgCO₂e/kWh**\n→ Country-specific grid factors\n→ Source: TEIAS + Ministry of Energy data\n\n**🚢 GLEC v3** (Smart Freight Centre)\n→ Freight transport: road, sea, air, rail\n→ Separate factor per mode (full load / partial load)\n→ Global's most current freight database\n\n**Why 3 sources?** Each source provides the most authoritative and current data in its domain.`
    }
  },

  // ── Turkey electricity ────────────────────────────────────────────────────────
  {
    id: 'turkey_electricity',
    match: /türkiye.*(?:elektrik|grid|şebeke)|(?:elektrik|grid|şebeke).*türkiye|teias|0[.,]439/i,
    answer: {
      tr: `**Türkiye Elektrik Faktörü (IEA 2023): 0,439 kgCO₂e/kWh**\n\n**Trend (TEIAS ağı):**\n→ 2019: 0,524  → 2020: 0,521  → 2021: 0,499\n→ 2022: 0,463  → **2023: 0,439** ← Güncel\n\n**Neden düşüyor?** Türkiye'nin yenilenebilir kapasitesi hızla artıyor:\n→ Güneş: 2019'da 5 GW → 2023'te 22 GW+\n→ Rüzgar: 7 GW → 11 GW+\n\n**Yenilenebilir enerji aldıysanız:**\n→ GO (Garanti Belgesi) / REC ile piyasa bazlı faktör ≈ 0 olabilir\n→ Bu durumu raporunuzda belgelemeniz gerekir\n\n**Örnek:** 18.000 kWh × 0,439 = **7.902 kgCO₂e** ≈ 7,9 tCO₂e`,
      en: `**Turkey Electricity Factor (IEA 2023): 0.439 kgCO₂e/kWh**\n\n**Trend (TEIAS grid):**\n→ 2019: 0.524  → 2020: 0.521  → 2021: 0.499\n→ 2022: 0.463  → **2023: 0.439** ← Current\n\n**Why decreasing?** Turkey's renewable capacity is growing rapidly:\n→ Solar: 5 GW in 2019 → 22 GW+ in 2023\n→ Wind: 7 GW → 11 GW+\n\n**If you purchased renewables:**\n→ GO (Guarantee of Origin) / REC can bring market-based factor ≈ 0\n→ You must document this in your report\n\n**Example:** 18,000 kWh × 0.439 = **7,902 kgCO₂e** ≈ 7.9 tCO₂e`
    }
  },

  // ── Natural gas factor ───────────────────────────────────────────────────────
  {
    id: 'natural_gas_factor',
    match: /doğal\s*gaz.*(?:faktör|fiyat|hesap)|(?:faktör|nasıl\s*hesap).*doğal\s*gaz|natural\s*gas.*factor|m³.*co2/i,
    answer: {
      tr: `**Doğalgaz Emisyon Faktörü (DEFRA 2023)**\n\n| Birim | Faktör |\n|-------|--------|\n| **m³** | **2,02 kgCO₂e/m³** ← En yaygın |\n| kWh | 0,183 kgCO₂e/kWh |\n| GJ | 50,77 kgCO₂e/GJ |\n| mcf | 57,17 kgCO₂e/mcf |\n\n**Örnek hesaplamalar:**\n→ 5.000 m³ × 2,02 = **10.100 kgCO₂e = 10,1 tCO₂e**\n→ 15.000 m³ × 2,02 = **30.300 kgCO₂e = 30,3 tCO₂e**\n→ 50.000 m³ × 2,02 = **101.000 kgCO₂e = 101 tCO₂e**\n\n**Faturanızda ne bakmalısınız?**\n→ "Tüketim m³" satırı — doğrudan kullanabilirsiniz\n→ kWh/Sm³ yazıyorsa: 1 Sm³ ≈ 10,55 kWh olarak çevirin`,
      en: `**Natural Gas Emission Factor (DEFRA 2023)**\n\n| Unit | Factor |\n|------|--------|\n| **m³** | **2.02 kgCO₂e/m³** ← Most common |\n| kWh | 0.183 kgCO₂e/kWh |\n| GJ | 50.77 kgCO₂e/GJ |\n| mcf | 57.17 kgCO₂e/mcf |\n\n**Example calculations:**\n→ 5,000 m³ × 2.02 = **10,100 kgCO₂e = 10.1 tCO₂e**\n→ 15,000 m³ × 2.02 = **30,300 kgCO₂e = 30.3 tCO₂e**\n→ 50,000 m³ × 2.02 = **101,000 kgCO₂e = 101 tCO₂e**\n\n**What to look for on your invoice:**\n→ "Consumption m³" line — use directly\n→ If it shows kWh/Sm³: 1 Sm³ ≈ 10.55 kWh conversion`
    }
  },

  // ── How to start ─────────────────────────────────────────────────────────────
  {
    id: 'how_to_start',
    match: /nasıl\s*baş|nereden\s*baş|how.*(start|begin|get\s*start)|first\s*step|ilk\s*adım|neler\s*gerekiyor|ne.*yapmalı/i,
    answer: {
      tr: `**ISO 14064-1 Karbon Envanteri — Nasıl Başlanır?**\n\n**Aşama 1 — Şirket Profili** ✍️\n→ Tam ticari unvan, VKN, raporlama yılı\n→ Hazırlayan kişi / sürdürülebilirlik birimi\n\n**Aşama 2 — Organizasyon Sınırı** 🏢\n→ Hangi tesisler dahil? (ofis, fabrika, depo)\n→ Kontrol yaklaşımı (çoğu şirket için)\n\n**Aşama 3 — Kapsam 1** 🔥\n→ Doğalgaz faturası (m³/yıl)\n→ Dizel, LPG, fuel oil tüketimi\n\n**Aşama 4 — Kapsam 2** ⚡\n→ Elektrik faturası (kWh/yıl)\n\n**Aşama 5 — Kapsam 3** 🚛✈️\n→ Nakliye verisi (ton × km)\n→ İş seyahati (pkm)\n\n**Aşama 6-7 — Hariç Tutmalar & Rapor** 📄\n→ Sistem otomatik tamamlar\n\n🚀 **En hızlı yol:** Üstteki **📋 Rehberli Mod** — sizi adım adım yönlendiririm!`,
      en: `**ISO 14064-1 Carbon Inventory — How to Start?**\n\n**Stage 1 — Company Profile** ✍️\n→ Full legal name, tax ID, reporting year\n→ Prepared by / sustainability department\n\n**Stage 2 — Organizational Boundary** 🏢\n→ Which facilities included? (office, factory, warehouse)\n→ Control approach (for most companies)\n\n**Stage 3 — Scope 1** 🔥\n→ Natural gas invoice (m³/year)\n→ Diesel, LPG, fuel oil consumption\n\n**Stage 4 — Scope 2** ⚡\n→ Electricity invoice (kWh/year)\n\n**Stage 5 — Scope 3** 🚛✈️\n→ Freight data (tonnes × km)\n→ Business travel (pkm)\n\n**Stages 6-7 — Exclusions & Report** 📄\n→ System completes automatically\n\n🚀 **Fastest way:** Click **📋 Guide Mode** above — I'll walk you through it!`
    }
  },

  // ── Data quality ──────────────────────────────────────────────────────────────
  {
    id: 'data_quality',
    match: /veri\s*kalite|data\s*quality|seviye\s*[123]|level\s*[123]|tier\s*[123]|tahmin.*mi|fatura.*yok/i,
    answer: {
      tr: `**Veri Kalitesi Seviyeleri (ISO 14064-1)**\n\n**Seviye 1 — Ölçüm Verisi** ⭐⭐⭐\n→ Fatura veya tesis sayacından doğrudan okuma\n→ Örn: Doğalgaz faturasından m³ değeri\n→ En yüksek güvenilirlik — tercih edilen\n\n**Seviye 2 — Hesaplanmış** ⭐⭐\n→ Ölçüm × dönüştürme faktörü\n→ Örn: Bina alanı × m² başına tipik tüketim\n→ Belgeleyin ve raporda belirtin\n\n**Seviye 3 — Tahmini** ⭐\n→ Sektör ortalamaları veya basit modeller\n→ Örn: Çalışan sayısı × kişi başı emisyon\n→ Raporunuzda "tahmini veri" olarak işaretlenir\n\n💡 **Pratik öneri:** Toplam emisyonun %80'ini kapsayan kaynaklar için Seviye 1 veri kullanın.`,
      en: `**Data Quality Levels (ISO 14064-1)**\n\n**Level 1 — Measured** ⭐⭐⭐\n→ Direct reading from invoice or site meter\n→ Example: m³ value from natural gas invoice\n→ Highest reliability — preferred\n\n**Level 2 — Calculated** ⭐⭐\n→ Measurement × conversion factor\n→ Example: Building area × typical consumption per m²\n→ Document and note in report\n\n**Level 3 — Estimated** ⭐\n→ Sector averages or simple models\n→ Example: Headcount × per-capita emission\n→ Flagged as "estimated data" in your report\n\n💡 **Practical tip:** Use Level 1 data for sources covering 80% of your total emissions.`
    }
  },

  // ── Verification ─────────────────────────────────────────────────────────────
  {
    id: 'verification',
    match: /doğrulama|verifikasyon|verification|denetim|audit|üçüncü\s*taraf|third.?party|bağımsız/i,
    answer: {
      tr: `**GHG Envanter Doğrulaması**\n\n**Doğrulama seviyeleri:**\n→ **Makul güvence:** Kapsamlı + pahalı → hata riski < %5\n→ **Sınırlı güvence:** Hızlı + uygun maliyetli → genel kontrol\n\n**Doğrulama kimin için zorunlu (Türkiye)?**\n→ ÇKDYY kapsamı: Büyük yakma tesisleri (≥50 MW ısıl güç)\n→ CBAM ihracatçıları: AB'ye çelik, çimento, alüminyum, gübre\n→ SPK açıklamaları: BIST100 listeli şirketler (tavsiye edilen)\n\n**Akredite doğrulayıcılar:** Bureau Veritas, DNV, SGS, TÜV SÜD, Intertek\n\n**Maliyet tahmini (Türkiye 2024):**\n→ Sınırlı güvence: ~₺50-120K\n→ Makul güvence: ~₺120-300K`,
      en: `**GHG Inventory Verification**\n\n**Verification levels:**\n→ **Reasonable assurance:** Comprehensive + expensive → error risk <5%\n→ **Limited assurance:** Faster + cost-effective → general review\n\n**Who must verify (Turkey)?**\n→ Environmental regulations: Large combustion facilities (≥50 MW thermal)\n→ CBAM exporters: EU-bound steel, cement, aluminium, fertilizers\n→ Capital markets: BIST100 listed companies (recommended)\n\n**Accredited verifiers:** Bureau Veritas, DNV, SGS, TÜV SÜD, Intertek\n\n**Cost estimate (Turkey 2024):**\n→ Limited assurance: ~₺50-120K\n→ Reasonable assurance: ~₺120-300K`
    }
  },

  // ── CBAM ─────────────────────────────────────────────────────────────────────
  {
    id: 'cbam',
    match: /\bcbam\b|ab\s*sınır.*karbon|carbon\s*border|eu\s*carbon|sınır\s*karbon\s*düzenlem/i,
    answer: {
      tr: `**CBAM — AB Sınır Karbon Düzenlemesi**\n\nTürkiye'den AB'ye ihraç edilen bazı ürünler için karbon maliyeti oluşturur.\n\n**Etkilenen ürünler (Faz 1 — 2023-2025):**\n→ Çelik ve demir ürünleri\n→ Çimento\n→ Alüminyum\n→ Gübre\n→ Elektrik\n→ Hidrojen\n\n**Zaman çizelgesi:**\n→ Ekim 2023 – Aralık 2025: Geçiş dönemi (ücretsiz raporlama)\n→ **Ocak 2026:** CBAM sertifikaları zorunlu ← Para ödenmeye başlar\n→ 2034: Ücretsiz tahsisat tamamen sona erer\n\n**Size ne anlama gelir?**\n→ Belgelenmiş düşük emisyon = daha az CBAM maliyeti\n→ ISO 14064-1 envanteri CBAM raporlamasının temelini oluşturur\n→ Şimdi hazırlanmak 2026'da büyük avantaj sağlar`,
      en: `**CBAM — EU Carbon Border Adjustment Mechanism**\n\nCreates a carbon cost for certain products exported from Turkey to the EU.\n\n**Affected products (Phase 1 — 2023-2025):**\n→ Steel and iron products\n→ Cement\n→ Aluminium\n→ Fertilizers\n→ Electricity\n→ Hydrogen\n\n**Timeline:**\n→ Oct 2023 – Dec 2025: Transition period (free reporting)\n→ **Jan 2026:** CBAM certificates mandatory ← Payments begin\n→ 2034: Free allowances fully phased out\n\n**What it means for you:**\n→ Documented low emissions = lower CBAM cost\n→ ISO 14064-1 inventory forms the basis of CBAM reporting\n→ Preparing now gives a major advantage in 2026`
    }
  },

  // ── Organizational boundary ───────────────────────────────────────────────────
  {
    id: 'org_boundary',
    match: /organizasyon\s*sınır|örgütsel\s*sınır|organizational\s*boundary|kontrol\s*yaklaşım|control\s*approach|equity\s*share|öz\s*sermaye\s*payı/i,
    answer: {
      tr: `**Organizasyon Sınırı — Kontrol vs. Öz Sermaye**\n\n**Kontrol Yaklaşımı** ✅ (Çoğu şirket için önerilir)\n→ Operasyonel veya finansal kontrol ettiğiniz tesisler\n→ Paylaşım oranından bağımsız — %100 dahil\n→ Kiralanan ofis bile tamamen dahil (kontrolünüzde)\n\n**Öz Sermaye Payı Yaklaşımı** ℹ️\n→ Tesisin sahiplik payı oranında dahil\n→ Örn: %40 hisse = tesis emisyonunun %40'ı\n→ Karmaşık JV veya ortaklık yapıları için\n\n**Hangi tesisler dahil edilmeli?**\n→ ✅ Sahip olunan ofis ve fabrikalar\n→ ✅ Kiralanan alanlar (kira ödeseniz bile)\n→ ✅ Kontrol ettiğiniz depo ve tesisler\n→ ⚠️ Kiracı yönetimli alanlar: Kat.13 kapsamında raporlanır`,
      en: `**Organizational Boundary — Control vs. Equity Share**\n\n**Control Approach** ✅ (Recommended for most companies)\n→ Facilities you have operational or financial control over\n→ Independent of ownership share — 100% included\n→ Even leased offices are fully included (under your control)\n\n**Equity Share Approach** ℹ️\n→ Include facilities in proportion to ownership share\n→ Example: 40% stake = 40% of facility emissions\n→ For complex JV or partnership structures\n\n**Which facilities must be included?**\n→ ✅ Owned offices and factories\n→ ✅ Leased spaces (even if you pay rent)\n→ ✅ Warehouses and facilities you control\n→ ⚠️ Tenant-managed spaces: Reported under Cat.13`
    }
  },

  // ── Freight calculation ───────────────────────────────────────────────────────
  {
    id: 'freight_calc',
    match: /nakliye.*nasıl|taşıma.*hesap|how.*freight.*calc|tkm\s*nedir|ton.?km\s*nedir|glec/i,
    answer: {
      tr: `**Yük Taşımacılığı Emisyon Hesabı (GLEC v3)**\n\n**Temel formül:** Ton-km × Emisyon Faktörü = kgCO₂e\n\n**Ton-km hesaplama:** Ağırlık (ton) × Mesafe (km) = tkm\n\n**GLEC v3 Faktörleri:**\n| Mod | Faktör (kgCO₂e/tkm) |\n|-----|---------------------|\n| 🚛 HGV >3,5t | **0,0614** |\n| 🚐 LGV ≤3,5t | **0,0961** |\n| 🚢 Deniz (bulk) | **0,00681** |\n| 🚂 Demiryolu | **0,0280** |\n| ✈️ Hava kargo | **0,7027** |\n\n**Örnek:** 45 ton yük × 1.200 km = 54.000 tkm × 0,0614 = **3.316 kgCO₂e**\n\n💡 Direkt yazan: "45 ton yük 1200 km karayoluyla taşındı" — hesabı yaparım!`,
      en: `**Freight Transport Emission Calculation (GLEC v3)**\n\n**Basic formula:** Tonne-km × Emission Factor = kgCO₂e\n\n**Tonne-km calculation:** Weight (tonnes) × Distance (km) = tkm\n\n**GLEC v3 Factors:**\n| Mode | Factor (kgCO₂e/tkm) |\n|------|---------------------|\n| 🚛 HGV >3.5t | **0.0614** |\n| 🚐 LGV ≤3.5t | **0.0961** |\n| 🚢 Sea (bulk) | **0.00681** |\n| 🚂 Rail | **0.0280** |\n| ✈️ Air freight | **0.7027** |\n\n**Example:** 45 tonnes × 1,200 km = 54,000 tkm × 0.0614 = **3,316 kgCO₂e**\n\n💡 Just write: "45 tonnes shipped 1,200 km by road" — I'll calculate!`
    }
  },

  // ── Base year ────────────────────────────────────────────────────────────────
  {
    id: 'base_year',
    match: /baz\s*yıl|base\s*year|referans\s*yıl|taban\s*yıl|yeniden\s*hesap|recalcul/i,
    answer: {
      tr: `**Baz Yıl (Base Year)**\n\nKarbon performansınızı zaman içinde karşılaştırmak için referans alınan yıl.\n\n**Baz yıl seçim kriterleri (ISO 14064-1):**\n→ Güvenilir veri bulunan en erken yıl (tercihen ≥ 3 yıl önce)\n→ Büyük yapısal değişiklik yoksa 5 yıl öncesi ideal\n→ COVID etkisi nedeniyle 2020'den kaçınmak akıllıca\n\n**Baz yıl yeniden hesaplaması ne zaman gerekir?**\n→ Şirket birleşmesi veya bölünmesi\n→ Emisyon sınırındaki önemli değişiklikler\n→ Hesap yöntemi revizyonu\n→ Eşik: Toplam emisyonun >%5 etkisi\n\n**Öneri:** İlk rapor için mevcut yıl baz yıl olarak belirlenebilir — ilerleyen yıllarda trend analizi yapılır.`,
      en: `**Base Year**\n\nThe reference year for comparing your carbon performance over time.\n\n**Base year selection criteria (ISO 14064-1):**\n→ Earliest year with reliable data (preferably ≥ 3 years ago)\n→ 5 years ago is ideal if no major structural changes\n→ Wise to avoid 2020 due to COVID impact\n\n**When is base year recalculation required?**\n→ Company merger or split\n→ Significant changes to emission boundary\n→ Revision of calculation methodology\n→ Threshold: >5% impact on total emissions\n\n**Recommendation:** For the first report, the current year can be set as the base year — trend analysis follows in subsequent years.`
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// BENCHMARKS  —  typical ranges for context
// ═══════════════════════════════════════════════════════════════════════════════
const BENCHMARKS = {
  natural_gas_office: {
    // m³/year for typical Turkish office building
    low: 5000, avg: 15000, high: 40000,
    unit: 'm³',
    context: {
      tr: 'Türkiye ofis binası için tipik yıllık doğalgaz tüketimi',
      en: 'Typical annual natural gas consumption for a Turkish office building',
    },
  },
  electricity_office: {
    // kWh/year
    low: 10000, avg: 30000, high: 100000,
    unit: 'kWh',
    context: {
      tr: 'Türkiye ofis binası için tipik yıllık elektrik tüketimi',
      en: 'Typical annual electricity consumption for a Turkish office building',
    },
  },
};

/**
 * Returns a benchmark context string for a detected emission result.
 * @param {string} type  — emission type key (e.g. 'natural_gas', 'electricity')
 * @param {number} amount
 * @param {string} lang  — 'tr' | 'en'
 * @returns {string|null}
 */
export function getBenchmarkContext(type, amount, lang) {
  const isTr = lang === 'tr';

  if (type === 'natural_gas') {
    const b = BENCHMARKS.natural_gas_office;
    if (amount < b.low) {
      return isTr
        ? `📊 _Kıyaslama: Tipik ofis binası ortalaması (${b.avg.toLocaleString()} m³) ile karşılaştırıldığında düşük bir değer. Küçük tesis veya az tüketim dönemini yansıtıyor olabilir._`
        : `📊 _Benchmark: This is below typical office building average (${b.avg.toLocaleString()} m³). May reflect a small facility or low-use period._`;
    } else if (amount > b.high) {
      return isTr
        ? `📊 _Kıyaslama: Büyük bir tesis veya yüksek ısıtma ihtiyacını gösteriyor (tipik ofis ortalaması ${b.avg.toLocaleString()} m³). Isı yalıtımı iyileştirme fırsatı olabilir._`
        : `📊 _Benchmark: Indicates a large facility or high heating demand (typical office avg. ${b.avg.toLocaleString()} m³). May be an opportunity to improve heat insulation._`;
    } else {
      return isTr
        ? `📊 _Kıyaslama: Tipik Türk ofis binası aralığında (${b.low.toLocaleString()}–${b.high.toLocaleString()} m³). Normal tüketim profili._`
        : `📊 _Benchmark: Within typical Turkish office range (${b.low.toLocaleString()}–${b.high.toLocaleString()} m³). Normal consumption profile._`;
    }
  }

  if (type === 'electricity') {
    const b = BENCHMARKS.electricity_office;
    if (amount < b.low) {
      return isTr
        ? `📊 _Kıyaslama: Çok düşük elektrik tüketimi — küçük ofis veya kısmi yıl verisi olabilir (tipik: ${b.avg.toLocaleString()} kWh)._`
        : `📊 _Benchmark: Very low electricity consumption — may be a small office or partial year data (typical: ${b.avg.toLocaleString()} kWh)._`;
    } else if (amount > b.high) {
      return isTr
        ? `📊 _Kıyaslama: Yüksek elektrik tüketimi — büyük tesis veya enerji yoğun operasyon (tipik ofis: ${b.avg.toLocaleString()} kWh). LED + akıllı HVAC tasarruf potansiyeli var._`
        : `📊 _Benchmark: High electricity consumption — large facility or energy-intensive operation (typical office: ${b.avg.toLocaleString()} kWh). LED + smart HVAC can reduce this._`;
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
const INTENT_PATTERNS = [
  {
    intent: 'STATUS',
    re: /ne\s*eksik|eksik\s*ne|durum\s*ne|ne\s*kaldı|ilerleme|tamamland[ıi]\s*mı|bitirdim\s*mi|ne\s*yaptım|hangi.*tamamlandı|what.*missing|missing.*what|\bstatus\b|progress|am\s*i\s*done|what.*completed|how.*far/i,
  },
  {
    intent: 'GUIDANCE',
    re: /nasıl\s*baş|nereden\s*baş|ne\s*yapmalı|neler\s*gerekiyor|ilk\s*adım|bana\s*yardım|nasıl\s*kullan|how.*(start|begin|get\s*start)|what.*should.*do|help\s*me|guide\s*me|tutorial|first\s*step|where\s*do\s*i\s*start/i,
  },
  {
    intent: 'QUESTION',
    re: /nedir\?|ne\s*demek|nasıl\s*hesap|hangi\s*faktör|açıkla|bana\s*anlat|what\s*is\b|how\s*(is|does|do)|why\s+(is|do|does|are)|which\s+factor|explain|define\b|tell\s+me\s+about/i,
  },
  {
    intent: 'BENCHMARK',
    re: /çok\s*(fazla|yüksek|az|düşük)|normal\s*mı|ortalama\s*(nedir|kaç)|kıyasla|karşılaştır|too\s*(much|high|low|little)|is\s*(this|that)\s*(normal|typical|high|low)|average.*is|compare/i,
  },
];

/**
 * Classify the intent of a user message.
 * @param {string} text
 * @returns {'STATUS'|'GUIDANCE'|'QUESTION'|'BENCHMARK'|'CALCULATE'|'UNKNOWN'}
 */
export function detectIntent(text) {
  for (const { intent, re } of INTENT_PATTERNS) {
    if (re.test(text)) return intent;
  }
  // Numbers + units → likely a calculation
  if (/\d+\s*(m³|m3|kwh|mwh|litre|liter|kg\b|ton\b|pkm|tkm|gj|mcf)/i.test(text)) {
    return 'CALCULATE';
  }
  return 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Search the knowledge base for a relevant answer.
 * @param {string} text
 * @param {'tr'|'en'} lang
 * @returns {string|null}  Answer string or null if no match
 */
export function searchKB(text, lang) {
  for (const entry of KB) {
    if (entry.match.test(text)) {
      return entry.answer[lang] || entry.answer.en || null;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS REPORTER  —  summarizes current inventory completion
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a human-readable inventory status report from current field values.
 * @param {Object} fieldValues  — flat map of saved field values
 * @param {'tr'|'en'} lang
 * @returns {string}
 */
export function buildStatusReport(fieldValues, lang) {
  const isTr = lang === 'tr';

  const has3A = !!(fieldValues['rf.3a.fuel_type'] && parseFloat(fieldValues['rf.3a.consumption']) > 0);
  const has4A = !!(parseFloat(fieldValues['rf.4a.consumption_kwh']) > 0);
  const hasK4 = !!(parseFloat(fieldValues['rf.k4.total_emission_kgco2e']) > 0 ||
                   (Array.isArray(fieldValues['rf.k4.shipments']) && fieldValues['rf.k4.shipments'].length > 0));
  const hasK5 = !!(parseFloat(fieldValues['rf.k5.total_emission_kgco2e']) > 0);

  const completedCount = [has3A, has4A, hasK4, hasK5].filter(Boolean).length;

  if (completedCount === 0) {
    return isTr
      ? `📊 **Envanter Durumu — Henüz Başlanmadı**\n\nHenüz hiç emisyon verisi girilmemiş.\n\n**Hızlı başlangıç seçenekleri:**\n→ 📋 **Rehberli Mod** — 133 soruyu adım adım tamamlayın\n→ 💬 **Serbest Mod** — Doğrudan yazın: "15.000 m³ doğalgaz kullandık"\n\n**Toplama almanız gereken belgeler:**\n→ Doğalgaz faturaları (m³/yıl)\n→ Elektrik faturaları (kWh/yıl)\n→ Nakliye verileri (ton × km)\n→ İş seyahati kayıtları (pkm)`
      : `📊 **Inventory Status — Not Started Yet**\n\nNo emission data has been entered yet.\n\n**Quick start options:**\n→ 📋 **Guided Mode** — Complete 133 questions step by step\n→ 💬 **Free Mode** — Write directly: "We used 15,000 m³ natural gas"\n\n**Documents you need to gather:**\n→ Natural gas invoices (m³/year)\n→ Electricity invoices (kWh/year)\n→ Freight data (tonnes × km)\n→ Business travel records (pkm)`;
  }

  // Calculate totals — each scope is independent
  const scope1Kg = has3A ? _calcScope1(fieldValues) : 0;
  const scope2Kg = has4A ? _calcScope2(fieldValues) : 0;
  const scope3K4 = hasK4 ? (parseFloat(fieldValues['rf.k4.total_emission_kgco2e']) || 0) : 0;
  const scope3K5 = hasK5 ? (parseFloat(fieldValues['rf.k5.total_emission_kgco2e']) || 0) : 0;
  const grandTotalKg = scope1Kg + scope2Kg + scope3K4 + scope3K5;

  const pct = Math.round((completedCount / 4) * 100);
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  const rows = [
    {
      done: has3A,
      labelTr: 'Kapsam 1 — Sabit Yanma',
      labelEn: 'Scope 1 — Stationary Combustion',
      kg: scope1Kg,
    },
    {
      done: has4A,
      labelTr: 'Kapsam 2 — Elektrik',
      labelEn: 'Scope 2 — Purchased Electricity',
      kg: scope2Kg,
    },
    {
      done: hasK4,
      labelTr: 'Kapsam 3 — Upstream Taşıma',
      labelEn: 'Scope 3 — Upstream Transport',
      kg: scope3K4,
    },
    {
      done: hasK5,
      labelTr: 'Kapsam 3 — İş Seyahati',
      labelEn: 'Scope 3 — Business Travel',
      kg: scope3K5,
    },
  ];

  const lines = rows.map(r => {
    const icon = r.done ? '✅' : '⬜';
    const label = isTr ? r.labelTr : r.labelEn;
    const val = r.done ? ` — ${_fmtKg(r.kg)}` : (isTr ? ' — Eksik' : ' — Missing');
    return `${icon} ${label}${val}`;
  });

  const missing = rows.filter(r => !r.done);
  let nextStepMsg = '';
  if (missing.length > 0) {
    const nextLabel = isTr ? missing[0].labelTr : missing[0].labelEn;
    nextStepMsg = isTr
      ? `\n\n💡 **Sıradaki adım:** ${nextLabel} verisini girin — hazır olduğunuzda yazın veya 📋 Rehberli Mod kullanın.`
      : `\n\n💡 **Next step:** Enter ${nextLabel} data — write it when ready or use 📋 Guided Mode.`;
  } else {
    nextStepMsg = isTr
      ? '\n\n🎉 **Tüm kategoriler tamamlandı!** Raporunuzu Kontrol Paneli\'nden oluşturabilirsiniz.'
      : '\n\n🎉 **All categories complete!** You can generate your report from the Dashboard.';
  }

  return isTr
    ? `📊 **Envanter Durumu**\n\n${bar} **${pct}%** (${completedCount}/4 kategori)\n\n${lines.join('\n')}\n\n**Toplam girilen:** ${_fmtKg(grandTotalKg)}${nextStepMsg}`
    : `📊 **Inventory Status**\n\n${bar} **${pct}%** (${completedCount}/4 categories)\n\n${lines.join('\n')}\n\n**Total entered:** ${_fmtKg(grandTotalKg)}${nextStepMsg}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART FALLBACK  —  when neither KB nor extraction matches
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a helpful fallback response when no specific answer is found.
 * @param {'tr'|'en'} lang
 * @returns {string}
 */
export function buildFallback(lang) {
  const isTr = lang === 'tr';
  return isTr
    ? `🤔 Mesajınızı net anlayamadım, ama şunları yapabilirim:\n\n**Emisyon hesapla:**\n→ "15.000 m³ doğalgaz kullandık"\n→ "18.000 kWh elektrik tükettik"\n→ "45 ton yük 1.200 km karayoluyla taşındı"\n→ "12.000 pkm kısa mesafe iş seyahati"\n\n**Soru sor:**\n→ "Scope 1 nedir?"\n→ "Türkiye elektrik faktörü kaç?"\n→ "CBAM nedir?"\n→ "Nasıl başlarım?"\n\n**Durum sorgula:**\n→ "Ne eksik?" veya "Ne tamamladım?"\n\nNasıl yardımcı olabilirim?`
    : `🤔 I didn't quite understand your message, but here's what I can do:\n\n**Calculate emissions:**\n→ "We used 15,000 m³ natural gas"\n→ "We consumed 18,000 kWh electricity"\n→ "45 tonnes shipped 1,200 km by road"\n→ "12,000 pkm short-haul business travel"\n\n**Answer questions:**\n→ "What is Scope 1?"\n→ "What is Turkey's electricity factor?"\n→ "What is CBAM?"\n→ "How do I start?"\n\n**Check status:**\n→ "What's missing?" or "What have I completed?"\n\nHow can I help you?`;
}

/**
 * Build a guided onboarding message for new users.
 * @param {'tr'|'en'} lang
 * @returns {string}
 */
export function buildOnboarding(lang) {
  const isTr = lang === 'tr';
  return isTr
    ? `🌿 **CarbonIQ'ya Hoş Geldiniz!**\n\nISO 14064-1 uyumlu karbon envanteri hazırlamak için iki yol var:\n\n**Yol 1 — 📋 Rehberli Mod** (Önerilen)\n→ 133 soruyu adım adım tamamlayın\n→ Sistem sizi branching mantığıyla yönlendirir\n→ Üstteki butona tıklayın: **📋 Rehber**\n\n**Yol 2 — 💬 Serbest Mod** (Hızlı giriş)\n→ Emisyon verilerini doğal dilde yazın\n→ AI otomatik hesaplar ve kaydeder\n→ Örnekler: "15.000 m³ doğalgaz kullandık"\n\n**Veri toplamak için hazırlayın:**\n→ 📄 Doğalgaz ve elektrik faturaları\n→ 🚛 Nakliye/lojistik verileri\n→ ✈️ İş seyahati raporları\n\nHangi yöntemle başlamak istersiniz?`
    : `🌿 **Welcome to CarbonIQ!**\n\nThere are two ways to prepare an ISO 14064-1 compliant carbon inventory:\n\n**Path 1 — 📋 Guided Mode** (Recommended)\n→ Complete 133 questions step by step\n→ System guides you with smart branching\n→ Click the button above: **📋 Guide**\n\n**Path 2 — 💬 Free Mode** (Quick entry)\n→ Write emission data in natural language\n→ AI calculates and saves automatically\n→ Examples: "We used 15,000 m³ natural gas"\n\n**Prepare the following data:**\n→ 📄 Natural gas and electricity invoices\n→ 🚛 Freight/logistics data\n→ ✈️ Business travel reports\n\nWhich way would you like to start?`;
}
