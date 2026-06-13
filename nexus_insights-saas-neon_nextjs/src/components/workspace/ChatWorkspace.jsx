'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import { sendWorkspaceChatMessage, confirmSuggestion, rejectSuggestion } from '@/lib/workspace/api';
import { SuggestionReviewCard } from './SuggestionReviewCard';

// ═══════════════════════════════════════════════════════════════════════════════
// EMISSION FACTOR DATABASE  —  DEFRA 2023 / IEA 2023 / GLEC v3
// ═══════════════════════════════════════════════════════════════════════════════
const EF = {
  // ── Scope 1: Stationary combustion ──────────────────────────────────────────
  natural_gas: { 'm³': 2.02, m3: 2.02, kwh: 0.183, gj: 50.77, mcf: 57.17 },
  diesel:      { litre: 2.54, liter: 2.54, l: 2.54, kg: 2.68, ton: 2680, gj: 68.08 },
  lpg:         { litre: 1.51, liter: 1.51, kg: 2.94, ton: 2940, gj: 59.65 },
  fuel_oil:    { litre: 2.52, kg: 2.96, ton: 2960, gj: 74.07 },
  coal:        { kg: 2.42, ton: 2420, tonne: 2420 },
  // ── Scope 2: Electricity ────────────────────────────────────────────────────
  electricity: { kwh: 0.439, mwh: 439 }, // Turkey TEIAS IEA 2023
  // ── Scope 3 Cat 5: Business travel ──────────────────────────────────────────
  flight_domestic:   { pkm: 0.264, km: 0.264 },
  flight_short_haul: { pkm: 0.153, km: 0.153 },  // < 3,700 km
  flight_long_haul:  { pkm: 0.195, km: 0.195 },  // ≥ 3,700 km
  rail_travel:       { pkm: 0.035, km: 0.035 },
  car_rental:        { km: 0.149, vkm: 0.149 },
  // ── Scope 3 Cat 4: Upstream transport ───────────────────────────────────────
  road_hgv:     { tkm: 0.0614 },  // Heavy goods vehicle > 3.5t
  road_lgv:     { tkm: 0.0961 },  // Light goods vehicle ≤ 3.5t
  sea_bulk:     { tkm: 0.00681 },
  rail_freight: { tkm: 0.0280 },
  air_freight:  { tkm: 0.7027 },
};

const EF_SOURCE = {
  natural_gas: 'DEFRA 2023', diesel: 'DEFRA 2023', lpg: 'DEFRA 2023',
  fuel_oil: 'DEFRA 2023',  coal: 'DEFRA 2023',
  electricity: 'IEA 2023 Turkey',
  flight_domestic: 'DEFRA 2023', flight_short_haul: 'DEFRA 2023', flight_long_haul: 'DEFRA 2023',
  rail_travel: 'DEFRA 2023', car_rental: 'DEFRA 2023',
  road_hgv: 'GLEC v3', road_lgv: 'GLEC v3', sea_bulk: 'GLEC v3',
  rail_freight: 'GLEC v3', air_freight: 'GLEC v3',
};

// ═══════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION  (works regardless of app lang setting)
// ═══════════════════════════════════════════════════════════════════════════════
const TR_RE = /\b(kullandık|tükettik|aldık|yaptık|seyahat|doğalgaz|doğal\s*gaz|elektrik|yakıt|litre|litr[ei]|metre\s*küp|ton\b|yıl|geçen|fabrika|ofis|şirket|kamyon|uçuş|uçak|tren|araç|firma|aylık|günlük|yıllık|kapsam|emisyon|birim|sarfiyat|tüketim|satın|nakliye|taşıma|sevkiyat|kargo|gaz\b|mazot|dizel|lpg|enerji\b|kwh|mwh)\b/i;

function detectLang(text) {
  return TR_RE.test(text) ? 'tr' : 'en';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART NUMBER EXTRACTION  (handles TR: "15.000", EN: "15,000", "15k", "15 bin")
// ═══════════════════════════════════════════════════════════════════════════════
function extractNums(text) {
  // 1. Normalize Turkish/EU thousands separator (15.000 → 15000)
  const norm = text
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')   // 15.000 → 15000
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2');   // 15,000 → 15000

  const matches = [...norm.matchAll(/(\d+(?:[.,]\d+)?)\s*(bin\b|k\b)?/gi)];
  return matches
    .map(m => {
      let n = parseFloat(m[1].replace(',', '.'));
      if (m[2]) n *= 1000;  // "bin" or "k" suffix
      return n;
    })
    .filter(n => !isNaN(n) && n > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE EXTRACTION ENGINE  —  returns array of detected emission sources
// ═══════════════════════════════════════════════════════════════════════════════
function extractEmissions(text) {
  const t = text;
  const nums = extractNums(t);
  const results = [];

  // ── Scope 1: Natural gas ────────────────────────────────────────────────────
  if (/doğal\s*gaz|natural\s*gas|m³|m3\b|gaz\s*(tüketi|kullan|yaktık)|gaz\b.*\d/i.test(t)) {
    const unitRaw = /\bkwh\b/i.test(t) ? 'kwh' : /\bgj\b/i.test(t) ? 'gj' : /\bmcf\b/i.test(t) ? 'mcf' : 'm³';
    const displayUnit = unitRaw === 'm³' ? 'm³' : unitRaw.toUpperCase();
    const amount = nums.find(n => n > 10) || 15000;
    const ef = EF.natural_gas[unitRaw] || EF.natural_gas['m³'];
    results.push({
      scope: 1, category: '3A', type: 'natural_gas',
      amount, unit: displayUnit, ef, emKg: Math.round(amount * ef),
      fields: [
        { field_id: 'rf.3a.fuel_type',   label: 'Fuel Type',   value: 'natural_gas', confidence: 0.98 },
        { field_id: 'rf.3a.consumption', label: 'Consumption', value: amount, unit: displayUnit, confidence: 0.93 },
        { field_id: 'rf.3a.unit',        label: 'Unit',        value: displayUnit, confidence: 0.99 },
      ],
      _localFields: { 'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': amount, 'rf.3a.unit': displayUnit },
      confidence: 0.93,
    });
  }

  // ── Scope 1: Diesel ─────────────────────────────────────────────────────────
  if (/\bdizel\b|\bdiesel\b|\bmazot\b/i.test(t)) {
    const unit = /\bton\b/i.test(t) ? 'ton' : /\bkg\b/i.test(t) ? 'kg' : 'litre';
    const amount = nums.find(n => n > 0) || 5000;
    const ef = EF.diesel[unit] || EF.diesel.litre;
    results.push({
      scope: 1, category: '3A', type: 'diesel',
      amount, unit, ef, emKg: Math.round(amount * ef),
      fields: [
        { field_id: 'rf.3a.fuel_type',   label: 'Fuel Type',   value: 'diesel', confidence: 0.96 },
        { field_id: 'rf.3a.consumption', label: 'Consumption', value: amount, unit, confidence: 0.91 },
        { field_id: 'rf.3a.unit',        label: 'Unit',        value: unit, confidence: 0.99 },
      ],
      _localFields: { 'rf.3a.fuel_type': 'diesel', 'rf.3a.consumption': amount, 'rf.3a.unit': unit },
      confidence: 0.91,
    });
  }

  // ── Scope 1: LPG ────────────────────────────────────────────────────────────
  if (/\blpg\b|likit\s*petrol|sıvılaştırılmış/i.test(t)) {
    const unit = /\bton\b/i.test(t) ? 'ton' : /\bkg\b/i.test(t) ? 'kg' : 'litre';
    const amount = nums.find(n => n > 0) || 3000;
    const ef = EF.lpg[unit] || EF.lpg.litre;
    results.push({
      scope: 1, category: '3A', type: 'lpg',
      amount, unit, ef, emKg: Math.round(amount * ef),
      fields: [
        { field_id: 'rf.3a.fuel_type',   label: 'Fuel Type',   value: 'lpg', confidence: 0.95 },
        { field_id: 'rf.3a.consumption', label: 'Consumption', value: amount, unit, confidence: 0.89 },
        { field_id: 'rf.3a.unit',        label: 'Unit',        value: unit, confidence: 0.99 },
      ],
      _localFields: { 'rf.3a.fuel_type': 'lpg', 'rf.3a.consumption': amount, 'rf.3a.unit': unit },
      confidence: 0.89,
    });
  }

  // ── Scope 1: Fuel oil ───────────────────────────────────────────────────────
  if (/fuel\s*oil|fuel oil|motorin\b|kalorifer\s*yakıtı|mazut\b/i.test(t)) {
    const unit = /\bton\b/i.test(t) ? 'ton' : /\bkg\b/i.test(t) ? 'kg' : 'litre';
    const amount = nums.find(n => n > 0) || 4000;
    const ef = EF.fuel_oil[unit] || EF.fuel_oil.litre;
    results.push({
      scope: 1, category: '3A', type: 'fuel_oil',
      amount, unit, ef, emKg: Math.round(amount * ef),
      fields: [
        { field_id: 'rf.3a.fuel_type',   label: 'Fuel Type',   value: 'fuel_oil', confidence: 0.94 },
        { field_id: 'rf.3a.consumption', label: 'Consumption', value: amount, unit, confidence: 0.90 },
        { field_id: 'rf.3a.unit',        label: 'Unit',        value: unit, confidence: 0.99 },
      ],
      _localFields: { 'rf.3a.fuel_type': 'fuel_oil', 'rf.3a.consumption': amount, 'rf.3a.unit': unit },
      confidence: 0.90,
    });
  }

  // ── Scope 2: Electricity ────────────────────────────────────────────────────
  if (/\bkwh\b|\bmwh\b|elektrik\s*(tüketi|alın|satın)|electricity\s*(consumption|usage|purchased)|kilowatt/i.test(t)
      && !/uçuş|flight|doğal\s*gaz|natural\s*gas|dizel|diesel|lpg\b/i.test(t)) {
    const isMwh = /\bmwh\b/i.test(t);
    const rawAmt = nums.find(n => n > 0);
    const kwhAmt = isMwh ? (rawAmt || 18) * 1000 : (rawAmt || 18000);
    const ef = EF.electricity.kwh;
    results.push({
      scope: 2, category: '4A', type: 'electricity',
      amount: kwhAmt, unit: 'kWh', ef, emKg: Math.round(kwhAmt * ef),
      fields: [
        { field_id: 'rf.4a.consumption_kwh', label: 'Consumption', value: kwhAmt, unit: 'kWh', confidence: 0.94 },
        { field_id: 'rf.4a.emission_factor', label: 'Emission Factor', value: 0.439, unit: 'kgCO₂e/kWh', confidence: 0.99 },
        { field_id: 'rf.4a.supplier',        label: 'Supplier', value: 'Şebeke (TEDAŞ)', confidence: 0.75 },
      ],
      _localFields: {
        'rf.4a.consumption_kwh': kwhAmt,
        'rf.4a.emission_factor': 0.439,
        'rf.4a.supplier': 'Şebeke (TEDAŞ)',
      },
      confidence: 0.92,
    });
  }

  // ── Scope 3 Cat 5: Business travel — flights ────────────────────────────────
  if (/uçuş|uçak\b|flight|hava.?yolu|business.?travel|iş.?seyahat|pkm|yolcu.?km|passenger.?km/i.test(t)) {
    const isLong = /uzun\s*mesafe|long.?haul|intercontinental|transatlant|≥\s*3[.,]?700/i.test(t);
    const isDom  = /iç\s*hat|domestic|yurt\s*içi/i.test(t);
    const fType  = isLong ? 'flight_long_haul' : isDom ? 'flight_domestic' : 'flight_short_haul';
    const fKey   = fType === 'flight_domestic'  ? 'rf.k5.air_domestic_pkm'
                 : fType === 'flight_long_haul'  ? 'rf.k5.air_long_haul_pkm'
                 :                                 'rf.k5.air_short_haul_pkm';
    const fLabel = fType === 'flight_domestic'  ? 'Domestic Flight'
                 : fType === 'flight_long_haul'  ? 'Long-Haul Flight'
                 :                                 'Short-Haul Flight';
    const pkm  = nums.find(n => n > 10) || 12000;
    const ef   = EF[fType].pkm;
    const emKg = Math.round(pkm * ef);
    results.push({
      scope: 3, category: 'K5', type: fType,
      amount: pkm, unit: 'pkm', ef, emKg,
      fields: [
        { field_id: fKey, label: fLabel, value: pkm, unit: 'pkm', confidence: 0.88 },
        { field_id: 'rf.k5.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.91 },
      ],
      _localFields: { [fKey]: pkm, 'rf.k5.total_emission_kgco2e': emKg },
      confidence: 0.88,
    });
  }

  // ── Scope 3 Cat 5: Rail travel ──────────────────────────────────────────────
  if (/tren\s*(seyahat|yolculuk)|rail\s*travel|yüksek\s*hızlı\s*tren|hsr\b/i.test(t)
      && !/tren\s*yük|rail.?freight/i.test(t)) {
    const pkm  = nums.find(n => n > 10) || 4000;
    const ef   = EF.rail_travel.pkm;
    const emKg = Math.round(pkm * ef);
    results.push({
      scope: 3, category: 'K5', type: 'rail_travel',
      amount: pkm, unit: 'pkm', ef, emKg,
      fields: [
        { field_id: 'rf.k5.rail_pkm', label: 'Rail Travel', value: pkm, unit: 'pkm', confidence: 0.87 },
        { field_id: 'rf.k5.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.90 },
      ],
      _localFields: { 'rf.k5.rail_pkm': pkm, 'rf.k5.total_emission_kgco2e': emKg },
      confidence: 0.87,
    });
  }

  // ── Scope 3 Cat 4: Upstream freight ────────────────────────────────────────
  if (/nakliye|taşıma|freight|kamyon|tır\b|sevkiyat|kargo|shipment|tkm\b|ton.?km|tonne.?km/i.test(t)
      && !/iş.?seyahat|business.?travel|tren\s*seyahat/i.test(t)) {
    const isSea  = /deniz|sea\b|gemi\b|vessel|ship\b/i.test(t);
    const isAir  = /hava\s*kargo|air.?freight/i.test(t);
    const isRail = /demiryolu|rail.?freight|tren\s*yük/i.test(t);
    const isLgv  = /hafif\s*araç|lgv\b|light\s*goods/i.test(t);
    const mode   = isSea ? 'sea_bulk' : isAir ? 'air_freight' : isRail ? 'rail_freight' : isLgv ? 'road_lgv' : 'road_hgv';
    const ef = EF[mode].tkm;

    if (/tkm\b|ton.?km|tonne.?km/i.test(t)) {
      // Direct tonne-km input
      const tkm  = nums.find(n => n > 0) || 54000;
      const emKg = Math.round(tkm * ef);
      results.push({
        scope: 3, category: 'K4', type: mode,
        amount: tkm, unit: 'tkm', ef, emKg, directTkm: true,
        fields: [
          { field_id: 'rf.k4.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.86 },
        ],
        _localFields: { 'rf.k4.total_emission_kgco2e': emKg },
        confidence: 0.86,
      });
    } else {
      // Separate tonnes + km
      const sortedNums = [...nums].sort((a, b) => a - b);
      const tonnes = sortedNums.find(n => n > 0 && n <= 2000) || 45;
      const km     = sortedNums.find(n => n > tonnes && n >= 10) || 1200;
      const tkm    = tonnes * km;
      const emKg   = Math.round(tkm * ef);
      results.push({
        scope: 3, category: 'K4', type: mode,
        amount: tkm, unit: 'tkm', ef, emKg, tonnes, km,
        fields: [
          { field_id: 'rf.k4.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.85 },
        ],
        _localFields: { 'rf.k4.total_emission_kgco2e': emKg },
        confidence: 0.85,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RICH REPLY BUILDER  —  transparent calculations + context-aware follow-ups
// ═══════════════════════════════════════════════════════════════════════════════
const SCOPE_LABEL = {
  '3A': { tr: 'Kapsam 1 — Sabit Yanma',      en: 'Scope 1 — Stationary Combustion' },
  '4A': { tr: 'Kapsam 2 — Satın Alınan Elektrik', en: 'Scope 2 — Purchased Electricity' },
  'K4': { tr: 'Kapsam 3 — Upstream Taşıma',  en: 'Scope 3 — Upstream Transport'    },
  'K5': { tr: 'Kapsam 3 — İş Seyahati',      en: 'Scope 3 — Business Travel'       },
};

function fmtKg(kg) {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(2)} tCO₂e`
    : `${Math.round(kg).toLocaleString()} kgCO₂e`;
}

function buildReply(results, inputText, lang, fieldValues) {
  const autoLang  = detectLang(inputText);
  const useTr     = lang === 'tr' || autoLang === 'tr';
  const L         = useTr ? 'tr' : 'en';

  // ── Nothing extracted ────────────────────────────────────────────────────────
  if (results.length === 0) {
    return {
      reply: useTr
        ? '🤔 Emisyon verisi tespit edemedim. Şu formatlarda paylaşabilirsiniz:\n\n' +
          '**Kapsam 1 (Yakıt):**\n→ "15.000 m³ doğalgaz kullandık"\n→ "5.000 litre dizel yaktık"\n→ "3.000 litre LPG tükettik"\n\n' +
          '**Kapsam 2 (Elektrik):**\n→ "18.000 kWh şebeke elektriği aldık"\n\n' +
          '**Kapsam 3 (Seyahat / Nakliye):**\n→ "12.000 pkm kısa mesafe uçuş yaptık"\n→ "45 ton × 1.200 km karayolu nakliyesi"'
        : "🤔 I couldn't extract emission data. Try these formats:\n\n" +
          "**Scope 1 (Fuel):**\n→ \"We used 15,000 m³ natural gas\"\n→ \"We burned 5,000 litres diesel\"\n\n" +
          "**Scope 2 (Electricity):**\n→ \"We purchased 18,000 kWh electricity\"\n\n" +
          "**Scope 3 (Travel / Freight):**\n→ \"12,000 pkm short-haul business flights\"\n→ \"45 tonnes × 1,200 km road freight\"",
      suggestion: null,
    };
  }

  // ── Data found: build rich reply ─────────────────────────────────────────────
  const r = results[0];
  const catLabel = SCOPE_LABEL[r.category]?.[L] || r.category;
  const source   = EF_SOURCE[r.type] || 'DEFRA 2023';
  const emText   = fmtKg(r.emKg);

  // Calculation line
  let calcLine;
  if (r.tonnes && r.km) {
    calcLine = useTr
      ? `${r.tonnes.toLocaleString()} ton × ${r.km.toLocaleString()} km = ${r.amount.toLocaleString()} tkm × ${r.ef} kgCO₂e/tkm = **${emText}**`
      : `${r.tonnes.toLocaleString()} t × ${r.km.toLocaleString()} km = ${r.amount.toLocaleString()} tkm × ${r.ef} kgCO₂e/tkm = **${emText}**`;
  } else {
    calcLine = `${r.amount.toLocaleString()} ${r.unit} × ${r.ef} kgCO₂e/${r.unit} = **${emText}**`;
  }

  // Context-aware follow-up
  const has3A = !!fieldValues['rf.3a.consumption'];
  const has4A = !!fieldValues['rf.4a.consumption_kwh'];
  const hasK4 = !!fieldValues['rf.k4.total_emission_kgco2e'];
  const hasK5 = !!fieldValues['rf.k5.total_emission_kgco2e'];

  let followUp = '';
  if (r.category === '3A' && !has4A) {
    followUp = useTr
      ? '\n\n💡 **Sıradaki adım:** Elektrik tüketiminizi (kWh) paylaşırsanız Kapsam 2\'yi de tamamlarız.'
      : '\n\n💡 **Next step:** Share your electricity consumption (kWh) to complete Scope 2.';
  } else if (r.category === '4A' && !has3A) {
    followUp = useTr
      ? '\n\n💡 **İpucu:** Yakıt tüketiminizi de (doğalgaz, dizel…) eklerseniz Kapsam 1 tamamlanır.'
      : '\n\n💡 **Tip:** Add your fuel consumption (natural gas, diesel…) to complete Scope 1.';
  } else if (r.category === '4A' && !hasK4 && !hasK5) {
    followUp = useTr
      ? '\n\n💡 **Sıradaki adım:** Kapsam 3 için nakliye veya iş seyahati verisi var mı?'
      : '\n\n💡 **Next step:** Any Scope 3 data — freight shipments or business travel?';
  } else if ((r.category === 'K4' || r.category === 'K5') && has3A && has4A) {
    followUp = useTr
      ? '\n\n🎉 Tüm kapsamlar kapsamanıza yaklaştınız! **Panel Görünümü** ile toplam emisyonunuzu görebilirsiniz.'
      : '\n\n🎉 You\'re close to covering all scopes! Open **Panel View** to see your total emissions.';
  }

  const reply = useTr
    ? `✅ Tespit edildi: **${catLabel}**\n\n📐 Hesaplama (${source}):\n${calcLine}${followUp}`
    : `✅ Detected: **${catLabel}**\n\n📐 Calculation (${source}):\n${calcLine}${followUp}`;

  return {
    reply,
    suggestion: {
      id: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: r.category,
      confidence: r.confidence,
      fields: r.fields,
      _localFields: r._localFields,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-1 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="h-2 w-2 rounded-full bg-[#B4BE6A] animate-bounce"
          style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

// Renders **bold** markdown in chat bubbles
function RichText({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, li) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={li}>
            {parts.map((p, pi) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={pi}>{p.slice(2, -2)}</strong>
                : p
            )}
            {li < text.split('\n').length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#302817]">
          <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
        </div>
      )}
      <div className={`max-w-[86%] rounded-[18px] px-4 py-2.5 text-[13px] leading-[1.7] ${
        isUser
          ? 'rounded-tr-sm bg-[#302817] text-white'
          : 'rounded-tl-sm border border-[#302817]/8 bg-white text-[#302817] shadow-sm'
      }`}>
        <RichText text={msg.content} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function ChatWorkspace({
  reportId,
  lang = 'en',
  onFieldsConfirmed,
  isPreview = false,
  onPreviewFields,
  fieldValues = {},   // current saved field values — used for context-aware replies
}) {
  const tr = lang === 'tr';

  // ── Welcome message ─────────────────────────────────────────────────────────
  const WELCOME = tr
    ? 'Merhaba! Ben **CarbonIQ AI Asistanınım** 🌿\n\nISO 14064-1 çerçevesinde karbon envanterinizi birlikte oluşturalım. Verilerinizi doğal dilde paylaşın — emisyon hesaplamalarını otomatik yapıp onayınıza sunacağım.\n\n**Başlamak için örnekler:**\n→ "15.000 m³ doğalgaz kullandık"\n→ "18.000 kWh elektrik aldık"\n→ "12.000 pkm iş seyahati uçuşu"\n→ "45 ton yük, 1.200 km karayolu"'
    : "Hello! I'm your **CarbonIQ AI Assistant** 🌿\n\nLet's build your ISO 14064-1 carbon inventory together. Share your emission data in natural language — I'll calculate and present it for your approval.\n\n**Quick examples:**\n→ \"We used 15,000 m³ natural gas\"\n→ \"We purchased 18,000 kWh electricity\"\n→ \"12,000 pkm business travel flights\"\n→ \"45 tonnes shipped 1,200 km by road\"";

  const [messages, setMessages] = useState([
    { id: 'welcome', role: 'assistant', content: WELCOME },
  ]);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const scrollRef = useRef(null);
  const msgIdRef  = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const addMsg = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role, content, ...extra }]);
  }, []);

  // ── Send handler ─────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    addMsg('user', text);
    setSending(true);

    try {
      if (isPreview) {
        // ── Preview / demo mode: smart local AI ──
        await new Promise(r => setTimeout(r, 650 + Math.random() * 550));
        const results = extractEmissions(text);
        const { reply, suggestion } = buildReply(results, text, lang, fieldValues);
        addMsg('assistant', reply);
        if (suggestion) {
          setMessages(prev => [...prev, {
            id: `s-${suggestion.id}`,
            role: 'suggestion',
            suggestion,
          }]);
        }
      } else {
        // ── Production mode: real backend ──
        if (!reportId) return;
        const data = await sendWorkspaceChatMessage(reportId, text);
        if (data.reply) addMsg('assistant', data.reply);
        if (data.suggestion) {
          setMessages(prev => [...prev, {
            id: `s-${data.suggestion.id}`,
            role: 'suggestion',
            suggestion: data.suggestion,
          }]);
        } else {
          addMsg('hint', tr
            ? 'İpucu: Sayısal veri paylaşırsanız (örn: "15.000 m³ doğalgaz") otomatik çıkarım yapabilirim.'
            : "Tip: Share specific quantities (e.g., \"15,000 m³ natural gas\") for automatic extraction.");
        }
      }
    } catch {
      setError(tr ? 'AI isteği başarısız. Tekrar deneyin.' : 'AI request failed. Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, reportId, addMsg, tr, isPreview, fieldValues, lang]);

  // ── Confirm suggestion ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (suggestionId, editedFields) => {
    try {
      if (isPreview) {
        const msg = messages.find(m => m.suggestion?.id === suggestionId);
        if (msg?.suggestion?._localFields) {
          const fields = editedFields
            ? editedFields
            : Object.entries(msg.suggestion._localFields).map(([field_id, value]) => ({ field_id, value }));
          if (onPreviewFields) onPreviewFields(fields);
        }
        setMessages(prev => prev.map(m =>
          m.suggestion?.id === suggestionId
            ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
            : m
        ));
        addMsg('assistant', tr
          ? '✅ Veriler rapora kaydedildi! Sol panelde özet güncellendi.\n\nBaşka kategori eklemek ister misiniz?'
          : '✅ Data saved to your report! The left panel summary has been updated.\n\nWould you like to add another category?');
        if (onFieldsConfirmed) onFieldsConfirmed([]);
      } else {
        // Production: save to Django backend
        const result = await confirmSuggestion(suggestionId, editedFields);
        setMessages(prev => prev.map(m =>
          m.suggestion?.id === suggestionId
            ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
            : m
        ));
        const n = result.saved_fields?.length || 0;
        addMsg('assistant', tr
          ? `✅ ${n} alan veritabanına kaydedildi! Rapor güncellendi.\n\nBaşka emisyon verisi eklemek ister misiniz?`
          : `✅ ${n} field(s) saved to database! Report updated.\n\nWould you like to add more emission data?`);
        if (onFieldsConfirmed) onFieldsConfirmed(result.saved_fields || []);
      }
    } catch {
      setError(tr ? 'Kaydetme başarısız. Tekrar deneyin.' : 'Save failed. Please try again.');
    }
  }, [addMsg, tr, isPreview, messages, onPreviewFields, onFieldsConfirmed]);

  // ── Reject suggestion ────────────────────────────────────────────────────────
  const handleReject = useCallback(async (suggestionId) => {
    try {
      if (!isPreview) await rejectSuggestion(suggestionId);
      setMessages(prev => prev.map(m =>
        m.suggestion?.id === suggestionId ? { ...m, role: 'rejected' } : m
      ));
      addMsg('assistant', tr
        ? '↩️ Öneri reddedildi. Verileri farklı bir şekilde paylaşabilirsiniz.'
        : "↩️ Suggestion rejected. Feel free to rephrase or share different data.");
    } catch {
      setError(tr ? 'İşlem başarısız.' : 'Action failed.');
    }
  }, [addMsg, tr, isPreview]);

  // ── Quick-start chips ────────────────────────────────────────────────────────
  const CHIPS = [
    { label: tr ? '🔥 15.000 m³ doğalgaz' : '🔥 15,000 m³ natural gas',
      text:  tr ? '15.000 m³ doğalgaz kullandık'                           : 'We used 15,000 m³ natural gas'                      },
    { label: tr ? '⚡ 18.000 kWh elektrik' : '⚡ 18,000 kWh electricity',
      text:  tr ? '18.000 kWh elektrik tükettik'                           : 'We consumed 18,000 kWh electricity'                  },
    { label: tr ? '✈️ 12.000 pkm iş seyahati' : '✈️ 12,000 pkm flights',
      text:  tr ? '12.000 pkm kısa mesafe iş seyahati uçuşu yaptık'       : 'We had 12,000 pkm short-haul business travel flights' },
    { label: tr ? '🚛 45 ton × 1200 km nakliye' : '🚛 45 t × 1,200 km freight',
      text:  tr ? '45 ton yük 1200 km karayoluyla taşındı'                 : '45 tonnes of freight shipped 1,200 km by road'       },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 border-b border-[#302817]/6 bg-white">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#302817]">
          <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] font-bold text-[#302817]">
            {tr ? 'CarbonIQ AI Asistanı' : 'CarbonIQ AI Assistant'}
          </p>
          <p className="text-[9.5px] text-[#302817]/35 truncate">
            ISO 14064-1 · DEFRA 2023 · IEA 2023 · GLEC v3 · TR / EN
          </p>
        </div>
        <span className="shrink-0 flex items-center gap-1 text-[9.5px] font-bold text-[#75863B] bg-[#95A847]/10 border border-[#95A847]/20 px-2 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#95A847] animate-pulse" />
          {tr ? 'Çevrimiçi' : 'Online'}
        </span>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">

        {/* Quick-start chips — only before conversation starts */}
        {messages.length === 1 && messages[0].id === 'welcome' && (
          <div className="flex flex-col items-center gap-2.5 pt-2 pb-1">
            <div className="flex flex-wrap justify-center gap-2">
              {CHIPS.map((chip, i) => (
                <button key={i} onClick={() => setInput(chip.text)}
                  className="rounded-full border border-[#302817]/10 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#302817]/55 shadow-sm transition hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/8 hover:text-[#302817]">
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full max-w-sm">
              <div className="flex-1 h-px bg-[#302817]/8" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#302817]/22">
                {tr ? 'veya kendiniz yazın' : 'or type below'}
              </span>
              <div className="flex-1 h-px bg-[#302817]/8" />
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map(msg => {
          if (msg.role === 'suggestion') {
            return (
              <SuggestionReviewCard key={msg.id} suggestion={msg.suggestion}
                onConfirm={handleConfirm} onReject={handleReject} lang={lang} />
            );
          }
          if (msg.role === 'confirmed') {
            return (
              <div key={msg.id} className="flex items-center gap-3 rounded-2xl border border-[#95A847]/25 bg-[#95A847]/8 px-4 py-3 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-[#527A1A] shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-[#527A1A]">{tr ? 'Kaydedildi' : 'Saved'} — {msg.suggestion?.category}</p>
                  <p className="text-[10px] text-[#302817]/40 mt-0.5">{tr ? 'Veriler rapora işlendi' : 'Data written to report'}</p>
                </div>
              </div>
            );
          }
          if (msg.role === 'rejected') {
            return (
              <div key={msg.id} className="rounded-2xl border border-[#302817]/8 bg-[#302817]/3 px-4 py-2 text-[11.5px] text-[#302817]/35 line-through">
                {tr ? 'Reddedildi' : 'Rejected'} — {msg.suggestion?.category}
              </div>
            );
          }
          if (msg.role === 'hint') {
            return (
              <div key={msg.id} className="flex items-start gap-2.5 rounded-2xl border border-[#B4BE6A]/25 bg-[#B4BE6A]/6 px-4 py-2.5">
                <Info className="h-3.5 w-3.5 text-[#75863B] shrink-0 mt-0.5" />
                <span className="text-[12px] text-[#302817]/55 leading-relaxed">{msg.content}</span>
              </div>
            );
          }
          return <ChatBubble key={msg.id} msg={msg} />;
        })}

        {sending && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#302817]">
              <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
            </div>
            <div className="rounded-[18px] rounded-tl-sm border border-[#302817]/8 bg-white px-4 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="shrink-0 border-t border-[#302817]/6 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-2xl border border-[#302817]/10 bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/28 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 min-h-[44px] max-h-[130px] transition-colors leading-relaxed"
            placeholder={tr
              ? 'Emisyon verinizi paylaşın… (TR veya EN yazabilirsiniz)'
              : 'Share your emission data… (write in TR or EN)'}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            maxLength={4000}
          />
          <button onClick={send} disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-35 active:scale-95">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 pl-1">
          <TrendingUp className="h-3 w-3 text-[#75863B]/50" />
          <p className="text-[9.5px] text-[#302817]/30">
            {tr
              ? 'DEFRA 2023 · IEA 2023 · GLEC v3 faktörleri kullanılır · Onaylamadan kaydedilmez'
              : 'Uses DEFRA 2023 · IEA 2023 · GLEC v3 factors · Nothing saves without your approval'}
          </p>
        </div>
      </div>
    </div>
  );
}
