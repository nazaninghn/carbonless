'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import { sendWorkspaceChatMessage, confirmSuggestion, rejectSuggestion } from '@/lib/workspace/api';
import { SuggestionReviewCard } from './SuggestionReviewCard';
import {
  detectIntent,
  searchKB,
  buildStatusReport,
  buildFallback,
  buildOnboarding,
  getBenchmarkContext,
} from '@/lib/carboniq/ai-brain';
import {
  getQuestionById,
  getInitialQuestionId,
  getNextQuestionId,
  validateCarbonIQAnswer,
  getSystemMessage,
  getQuestionWarning,
  CARBONIQ_STAGES,
  TOTAL_QUESTIONS,
} from '@/lib/carboniq/questions';

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
  road_hgv:     { tkm: 0.0614 },
  road_lgv:     { tkm: 0.0961 },
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
// SMART NUMBER EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════
function extractNums(text) {
  const norm = text
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
  const matches = [...norm.matchAll(/(\d+(?:[.,]\d+)?)\s*(bin\b|k\b)?/gi)];
  return matches
    .map(m => {
      let n = parseFloat(m[1].replace(',', '.'));
      if (m[2]) n *= 1000;
      return n;
    })
    .filter(n => !isNaN(n) && n > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE EXTRACTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
function extractEmissions(text) {
  const t = text;
  const nums = extractNums(t);
  const results = [];

  if (/doğal\s*gaz|natural\s*gas|m³|m3\b|gaz\s*(tüketi|kullan|yaktık)|gaz\b.*\d/i.test(t)) {
    const unitRaw = /\bkwh\b/i.test(t) ? 'kwh' : /\bgj\b/i.test(t) ? 'gj' : /\bmcf\b/i.test(t) ? 'mcf' : 'm³';
    // Use canonical casing so estimateKg() can look them up in DEFRA_EF
    const UNIT_DISPLAY = { 'm³': 'm³', kwh: 'kWh', gj: 'GJ', mcf: 'MCF' };
    const displayUnit = UNIT_DISPLAY[unitRaw] || unitRaw.toUpperCase();
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

  if (/fuel\s*oil|motorin\b|kalorifer\s*yakıtı|mazut\b/i.test(t)) {
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
      _localFields: { 'rf.4a.consumption_kwh': kwhAmt, 'rf.4a.emission_factor': 0.439, 'rf.4a.supplier': 'Şebeke (TEDAŞ)' },
      confidence: 0.92,
    });
  }

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

  if (/nakliye|taşıma|freight|kamyon|tır\b|sevkiyat|kargo|shipment|tkm\b|ton.?km|tonne.?km/i.test(t)
      && !/iş.?seyahat|business.?travel|tren\s*seyahat/i.test(t)) {
    const isSea  = /deniz|sea\b|gemi\b|vessel|ship\b/i.test(t);
    const isAir  = /hava\s*kargo|air.?freight/i.test(t);
    const isRail = /demiryolu|rail.?freight|tren\s*yük/i.test(t);
    const isLgv  = /hafif\s*araç|lgv\b|light\s*goods/i.test(t);
    const mode   = isSea ? 'sea_bulk' : isAir ? 'air_freight' : isRail ? 'rail_freight' : isLgv ? 'road_lgv' : 'road_hgv';
    const ef = EF[mode].tkm;

    if (/tkm\b|ton.?km|tonne.?km/i.test(t)) {
      const tkm  = nums.find(n => n > 0) || 54000;
      const emKg = Math.round(tkm * ef);
      results.push({
        scope: 3, category: 'K4', type: mode,
        amount: tkm, unit: 'tkm', ef, emKg, directTkm: true,
        fields: [{ field_id: 'rf.k4.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.86 }],
        _localFields: { 'rf.k4.total_emission_kgco2e': emKg },
        confidence: 0.86,
      });
    } else {
      const sortedNums = [...nums].sort((a, b) => a - b);
      const tonnes = sortedNums.find(n => n > 0 && n <= 2000) || 45;
      const km     = sortedNums.find(n => n > tonnes && n >= 10) || 1200;
      const tkm    = tonnes * km;
      const emKg   = Math.round(tkm * ef);
      results.push({
        scope: 3, category: 'K4', type: mode,
        amount: tkm, unit: 'tkm', ef, emKg, tonnes, km,
        fields: [{ field_id: 'rf.k4.total_emission_kgco2e', label: 'Total Emission', value: emKg, unit: 'kgCO₂e', confidence: 0.85 }],
        _localFields: { 'rf.k4.total_emission_kgco2e': emKg },
        confidence: 0.85,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RICH REPLY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
const SCOPE_LABEL = {
  '3A': { tr: 'Kapsam 1 — Sabit Yanma',          en: 'Scope 1 — Stationary Combustion'    },
  '4A': { tr: 'Kapsam 2 — Satın Alınan Elektrik', en: 'Scope 2 — Purchased Electricity'   },
  'K4': { tr: 'Kapsam 3 — Upstream Taşıma',       en: 'Scope 3 — Upstream Transport'      },
  'K5': { tr: 'Kapsam 3 — İş Seyahati',           en: 'Scope 3 — Business Travel'         },
};

function fmtKg(kg) {
  return kg >= 1000
    ? `${(kg / 1000).toFixed(2)} tCO₂e`
    : `${Math.round(kg).toLocaleString()} kgCO₂e`;
}

function buildReply(results, inputText, lang, fieldValues) {
  // Respect the explicit language toggle the user chose in the UI.
  // Auto-detection is intentionally NOT used here: common words like "ton",
  // "kwh", "lpg" appear in both TR and EN and caused false TR responses.
  const useTr = lang === 'tr';
  const L     = useTr ? 'tr' : 'en';

  if (results.length === 0) {
    return {
      reply: useTr
        ? '🤔 Emisyon verisi bulamadım. Şu şekilde yazabilirsiniz:\n\n🔥 _"15.000 m³ doğalgaz kullandık"_\n⚡ _"18.000 kWh elektrik tükettik"_\n✈️ _"12.000 pkm kısa mesafe iş seyahati"_\n🚛 _"45 ton yük 1.200 km karayoluyla taşındı"_\n\nBirim ve miktar içeren her mesajı anlayabilirim!'
        : "🤔 I couldn't find emission data in your message. Try writing:\n\n🔥 _\"We used 15,000 m³ natural gas\"_\n⚡ _\"We consumed 18,000 kWh electricity\"_\n✈️ _\"12,000 pkm short-haul business flights\"_\n🚛 _\"45 tonnes of freight, 1,200 km by road\"_\n\nAny message with a quantity and unit works!",
      suggestion: null,
    };
  }

  const r        = results[0];
  const catLabel = SCOPE_LABEL[r.category]?.[L] || r.category;
  const source   = EF_SOURCE[r.type] || 'DEFRA 2023';
  const emText   = fmtKg(r.emKg);

  // Clean calculation line
  let calcLine;
  if (r.tonnes && r.km) {
    calcLine = useTr
      ? `${r.tonnes.toLocaleString()} ton × ${r.km.toLocaleString()} km = ${r.amount.toLocaleString()} tkm × ${r.ef} = **${emText}**`
      : `${r.tonnes.toLocaleString()} t × ${r.km.toLocaleString()} km = ${r.amount.toLocaleString()} tkm × ${r.ef} = **${emText}**`;
  } else {
    calcLine = `${r.amount.toLocaleString()} ${r.unit} × ${r.ef} kgCO₂e/${r.unit} = **${emText}**`;
  }

  // Smart contextual follow-up
  const has3A = !!fieldValues['rf.3a.consumption'];
  const has4A = !!fieldValues['rf.4a.consumption_kwh'];
  const hasK4 = !!fieldValues['rf.k4.total_emission_kgco2e'];
  const hasK5 = !!fieldValues['rf.k5.total_emission_kgco2e'];
  const doneCount = [has3A, has4A, hasK4, hasK5].filter(Boolean).length;

  let followUp = '';
  if (r.category === '3A' && !has4A) {
    followUp = useTr
      ? '\n\n💡 Sırada: Elektrik faturanızdan kWh verinizi paylaşın → Kapsam 2 tamamlanır.'
      : '\n\n💡 Next: Share your electricity bill (kWh) → Scope 2 done.';
  } else if (r.category === '4A' && !has3A) {
    followUp = useTr
      ? '\n\n💡 Sırada: Yakıt tüketiminizi paylaşın (doğalgaz, dizel…) → Kapsam 1 tamamlanır.'
      : '\n\n💡 Next: Share your fuel consumption (natural gas, diesel…) → Scope 1 done.';
  } else if ((r.category === '3A' || r.category === '4A') && has3A && has4A && !hasK4 && !hasK5) {
    followUp = useTr
      ? '\n\n💡 Kapsam 1 ve 2 tamam! Nakliye veya iş seyahati veriniz var mı?'
      : '\n\n💡 Scope 1 & 2 done! Do you have freight or business travel data?';
  } else if ((r.category === 'K4' || r.category === 'K5') && has3A && has4A) {
    const newCount = doneCount + 1;
    followUp = newCount >= 4
      ? (useTr ? '\n\n🎉 Tüm kapsamlar tamamlandı! Raporunuzu oluşturabilirsiniz.' : '\n\n🎉 All scopes complete! You can now generate your report.')
      : (useTr ? `\n\n✅ ${newCount}/4 kategori tamamlandı. Devam edelim!` : `\n\n✅ ${newCount}/4 categories done. Let's keep going!`);
  }

  const reply = useTr
    ? `✅ **${catLabel}** tespit edildi!\n\n📐 _${source}_\n${calcLine}${followUp}\n\nAşağıdaki kartı onaylayın veya düzenleyin:`
    : `✅ **${catLabel}** detected!\n\n📐 _${source}_\n${calcLine}${followUp}\n\nReview the card below and save when ready:`;

  return {
    reply,
    suggestion: {
      id: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: r.category,
      confidence: r.confidence,
      fields: r.fields,
      emKg: r.emKg,
      _localFields: r._localFields,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUIDED MODE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns a human-readable label for a raw guided answer value. */
function getAnswerLabel(question, rawAnswer, lang) {
  if (rawAnswer === undefined || rawAnswer === null || rawAnswer === '') return '';
  if (question.type === 'single_select' || question.type === 'year_select') {
    const opt = (question.options || []).find(o => o.value === rawAnswer);
    return opt?.label?.[lang] || opt?.label?.en || String(rawAnswer);
  }
  if (question.type === 'multi_select' && Array.isArray(rawAnswer)) {
    return rawAnswer.map(v => {
      const opt = (question.options || []).find(o => o.value === v);
      return opt?.label?.[lang] || opt?.label?.en || v;
    }).join(', ');
  }
  if (question.type === 'country_city' && typeof rawAnswer === 'object') {
    const parts = [rawAnswer.country, rawAnswer.city].filter(Boolean);
    return parts.join(' — ');
  }
  return String(rawAnswer);
}

/** Formats a guided question as an AI message string. */
function formatQuestionMsg(question, lang) {
  const stageInfo = CARBONIQ_STAGES.find(s => s.id === question.stage);
  const stageName  = stageInfo?.title?.[lang] || stageInfo?.title?.en || '';
  const qText      = question.text?.[lang]   || question.text?.en   || '';
  const qHelper    = question.helper?.[lang] || question.helper?.en || '';

  let content = `🔢 **${lang === 'tr' ? 'Soru' : 'Question'} ${question.number} / ${TOTAL_QUESTIONS}**`;
  if (stageName) content += ` — _${stageName}_`;
  content += '\n';
  if (question.isoRef) content += `\`${question.isoRef}\`\n\n`;
  content += qText;
  if (qHelper) content += `\n\n💡 _${qHelper}_`;
  if (question.type === 'info') {
    content += `\n\n→ ${lang === 'tr' ? 'Devam etmek için butona basın.' : 'Press the button to continue.'}`;
  }
  return content;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-[7px] w-[7px] rounded-full bg-[#B4BE6A]"
          style={{
            animation: 'ciq-dot 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.22}s`,
          }}
        />
      ))}
      <style>{`@keyframes ciq-dot{0%,60%,100%{opacity:.2;transform:scale(.75)}30%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

function RichText({ text }) {
  if (!text) return null;

  function renderInline(raw) {
    const RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|_[^_\n]{1,200}_)/g;
    return raw.split(RE).map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith('`') && p.endsWith('`') && p.length > 2)
        return <code key={i} className="rounded bg-[#302817]/8 px-1 py-px font-mono text-[10.5px]">{p.slice(1, -1)}</code>;
      if (p.startsWith('_') && p.endsWith('_') && p.length > 2)
        return <span key={i} className="opacity-60">{p.slice(1, -1)}</span>;
      return p;
    });
  }

  // Group lines into normal lines and table blocks
  const lines = text.split('\n');
  const segments = [];
  let idx = 0;
  while (idx < lines.length) {
    if (lines[idx].trim().startsWith('|')) {
      const tbl = [];
      while (idx < lines.length && lines[idx].trim().startsWith('|')) { tbl.push(lines[idx]); idx++; }
      segments.push({ type: 'table', lines: tbl });
    } else {
      segments.push({ type: 'line', text: lines[idx] });
      idx++;
    }
  }

  return (
    <div className="text-[13px] leading-[1.75]">
      {segments.map((seg, si) => {
        if (seg.type === 'table') {
          const rows = seg.lines
            .filter(l => !/^\s*\|[-:\s|]+\|\s*$/.test(l))  // strip separator rows
            .map(l => l.split('|').slice(1, -1).map(c => c.trim()));
          if (!rows.length) return null;
          return (
            <table key={si} className="w-full border-collapse text-[11px] my-2 rounded-lg overflow-hidden">
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="border border-[#302817]/10 bg-[#302817]/6 px-2.5 py-1.5 text-left font-bold text-[#302817]/60">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-[#302817]/[0.02]' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-[#302817]/10 px-2.5 py-1.5 text-[#302817]/65">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        const line = seg.text;
        if (line.trim() === '---') return <hr key={si} className="border-[#302817]/10 my-2" />;
        if (!line.trim())          return <div key={si} className="h-2" />;
        if (line.startsWith('→ ')) return (
          <div key={si} className="flex items-start gap-1.5">
            <span className="text-[#75863B] font-bold shrink-0 select-none">→</span>
            <span>{renderInline(line.slice(2))}</span>
          </div>
        );
        return <div key={si}>{renderInline(line)}</div>;
      })}
    </div>
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
      <div className={`max-w-[86%] rounded-[18px] px-4 py-2.5 ${
        isUser
          ? 'rounded-tr-sm bg-[#302817] text-white text-[13px] leading-[1.7]'
          : 'rounded-tl-sm border border-[#302817]/8 bg-white text-[#302817] shadow-sm'
      }`}>
        {isUser ? msg.content : <RichText text={msg.content} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST-CONFIRM MESSAGE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildConfirmMsg(category, fieldValues, tr) {
  const done = {
    has3A: !!fieldValues['rf.3a.consumption']         || category === '3A',
    has4A: !!fieldValues['rf.4a.consumption_kwh']     || category === '4A',
    hasK4: !!fieldValues['rf.k4.total_emission_kgco2e'] || category === 'K4',
    hasK5: !!fieldValues['rf.k5.total_emission_kgco2e'] || category === 'K5',
  };
  const doneCount  = Object.values(done).filter(Boolean).length;
  const savedLabel = {
    '3A': tr ? 'Kapsam 1 — Sabit Yanma'   : 'Scope 1 — Stationary Combustion',
    '4A': tr ? 'Kapsam 2 — Elektrik'       : 'Scope 2 — Electricity',
    'K4': tr ? 'Kapsam 3 — Nakliye'        : 'Scope 3 — Freight',
    'K5': tr ? 'Kapsam 3 — İş Seyahati'   : 'Scope 3 — Business Travel',
  }[category] || category;

  if (doneCount >= 4) {
    return tr
      ? `🎉 **${savedLabel}** kaydedildi! **Tüm kapsamlar tamamlandı (4/4).**\n\nKontrol Paneli\'nden karbon envanteri raporunuzu artık oluşturabilirsiniz.`
      : `🎉 **${savedLabel}** saved! **All scopes complete (4/4).**\n\nYou can now generate your carbon inventory report from the Dashboard.`;
  }

  const missing = [
    !done.has3A && (tr ? '🔥 Kapsam 1' : '🔥 Scope 1'),
    !done.has4A && (tr ? '⚡ Kapsam 2' : '⚡ Scope 2'),
    !done.hasK4 && (tr ? '🚛 Kapsam 3 Nakliye' : '🚛 Scope 3 Freight'),
    !done.hasK5 && (tr ? '✈️ Kapsam 3 Seyahat' : '✈️ Scope 3 Travel'),
  ].filter(Boolean);

  return tr
    ? `✅ **${savedLabel}** rapora kaydedildi! (${doneCount}/4 tamamlandı)\n\n**Eksik:** ${missing.join(' · ')}\n\nDevam etmek için bir sonraki kategoriyi paylaşın.`
    : `✅ **${savedLabel}** saved to report! (${doneCount}/4 complete)\n\n**Remaining:** ${missing.join(' · ')}\n\nShare the next category to keep going.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function ChatWorkspace({
  reportId,
  lang = 'en',
  onLangChange,
  onFieldsConfirmed,
  isPreview = false,
  onPreviewFields,
  fieldValues = {},
}) {
  // ── Language state (local — user can toggle; also notifies parent) ────────────
  const [activeLang, setActiveLangRaw] = useState(lang || 'en');
  const setActiveLang = useCallback((l) => {
    setActiveLangRaw(l);
    if (onLangChange) onLangChange(l);
    // Insert a divider when switching language mid-conversation
    setMessages(prev => {
      if (prev.length <= 1) return prev;  // just welcome message — silently rewrite it
      return [...prev, {
        id: `lang-${Date.now()}`,
        role: 'mode-switch',
        label: l === 'tr' ? '🌐 Türkçe\'ye geçildi' : '🌐 Switched to English',
      }];
    });
  }, [onLangChange]);
  const tr = activeLang === 'tr';

  // ── Mode: 'free' | 'guided' ──────────────────────────────────────────────────
  const [mode, setMode] = useState('free');

  // ── Guided questionnaire state ───────────────────────────────────────────────
  const [currentQId,     setCurrentQId]     = useState(null);
  const [guidedAnswers,  setGuidedAnswers]  = useState({});
  const [pendingAnswer,  setPendingAnswer]  = useState('');
  const [selectedOpts,   setSelectedOpts]   = useState([]);  // multi_select
  const [countryCityVal, setCountryCityVal] = useState({ country: '', city: '' });
  const [guidedError,    setGuidedError]    = useState('');

  // Current question derived
  const currentQuestion    = currentQId ? getQuestionById(currentQId) : null;
  const currentStage       = currentQuestion
    ? CARBONIQ_STAGES.find(s => s.id === currentQuestion.stage)
    : null;
  const currentStageIndex  = currentQuestion
    ? CARBONIQ_STAGES.findIndex(s => s.id === currentQuestion.stage)
    : -1;

  // ── Welcome message builder ──────────────────────────────────────────────────
  const buildWelcome = useCallback((l) => {
    const isTr = l === 'tr';
    return isTr
      ? '👋 Merhaba! Ben **CarbonIQ**, ISO 14064-1 karbon envanter asistanınım.\n\nSize şunları yapabilirim:\n\n🔥 **Kapsam 1** — "15.000 m³ doğalgaz kullandık" yazın, hesaplayayım\n⚡ **Kapsam 2** — "18.000 kWh elektrik tükettik" → anında CO₂e\n✈️ **Kapsam 3** — Nakliye ve iş seyahati verilerinizi alayım\n\n📊 "Ne eksik?" veya "Durum nedir?" diye sorabilirsiniz.\n📋 **Rehberli Mod** ile 133 soruyu birlikte tamamlayabiliriz.\n\nHazır olduğunuzda verilerinizi paylaşın — ben de hemen hesaplayayım! 👇'
      : "👋 Hi! I'm **CarbonIQ**, your ISO 14064-1 carbon inventory assistant.\n\nHere's what I can do:\n\n🔥 **Scope 1** — Tell me \"We used 15,000 m³ natural gas\" and I'll calculate it\n⚡ **Scope 2** — \"We consumed 18,000 kWh electricity\" → instant CO₂e\n✈️ **Scope 3** — Share your freight and business travel data\n\n📊 Ask \"What's missing?\" or \"Show my status\" anytime.\n📋 Use **Guided Mode** to walk through all 133 questions together.\n\nJust share your data below and I'll handle the rest! 👇";
  }, []);

  const [messages, setMessages] = useState(() => [
    { id: 'welcome', role: 'assistant', content: buildWelcome(lang || 'en') },
  ]);
  const [input,   setInput]   = useState('');
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const scrollRef = useRef(null);
  const msgIdRef  = useRef(0);

  // Update welcome message if lang changes before any user message
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [{ id: 'welcome', role: 'assistant', content: buildWelcome(activeLang) }];
      }
      return prev;
    });
  }, [activeLang, buildWelcome]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const addMsg = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { id: `m-${++msgIdRef.current}`, role, content, ...extra }]);
  }, []);

  // ── Guided: add question message ─────────────────────────────────────────────
  const addGuidedQuestionMsg = useCallback((question, lang) => {
    if (!question) return;
    addMsg('assistant', formatQuestionMsg(question, lang));
  }, [addMsg]);

  // ── Guided: process answer (system msg → next question) ──────────────────────
  const processGuidedAnswer = useCallback((question, rawAnswer, newAnswers) => {
    const lang = activeLang;

    const sysMsg  = getSystemMessage(question, rawAnswer, lang);
    const warning = getQuestionWarning(question, rawAnswer, lang);

    let delay = 450;
    if (sysMsg) {
      setTimeout(() => addMsg('assistant', `💡 ${sysMsg}`), 200);
      delay += 300;
    }
    if (warning) {
      setTimeout(() => addMsg('assistant', `⚠️ **${lang === 'tr' ? 'Uyarı' : 'Warning'}:** ${warning}`), sysMsg ? 500 : 200);
      delay += 300;
    }

    const nextId = getNextQuestionId(question, rawAnswer);

    setTimeout(() => {
      if (!nextId) {
        addMsg('assistant', lang === 'tr'
          ? '🎉 **Tüm sorular tamamlandı!**\n\nISO 14064-1 karbon envanteri süreciniz başarıyla tamamlandı. Raporunuzu Kontrol Paneli\'nden oluşturabilirsiniz.'
          : '🎉 **All questions complete!**\n\nYour ISO 14064-1 carbon inventory process is successfully finished. Generate your report from the Dashboard.'
        );
        setCurrentQId(null);
        setMode('free');
        return;
      }

      const nextQ = getQuestionById(nextId);
      setCurrentQId(nextId);
      setPendingAnswer('');
      setSelectedOpts([]);
      setGuidedError('');
      setCountryCityVal({ country: '', city: '' });
      addGuidedQuestionMsg(nextQ, lang);
    }, delay);
  }, [activeLang, addMsg, addGuidedQuestionMsg]);

  // ── Guided: submit an answer ─────────────────────────────────────────────────
  const submitGuidedAnswer = useCallback((rawAnswer) => {
    const question = currentQuestion;
    if (!question) return;

    // Always trim string answers so whitespace-only never reaches the chat
    const answer = typeof rawAnswer === 'string' ? rawAnswer.trim() : rawAnswer;

    const validation = validateCarbonIQAnswer(question, answer, guidedAnswers, activeLang);
    if (!validation.ok) {
      setGuidedError(validation.message || (tr ? 'Lütfen geçerli bir yanıt girin.' : 'Please enter a valid answer.'));
      return;
    }

    setGuidedError('');

    // Show user's answer in chat
    const displayLabel = getAnswerLabel(question, answer, activeLang);
    addMsg('user', displayLabel || String(answer));

    // Store
    const newAnswers = { ...guidedAnswers, [currentQId]: answer };
    setGuidedAnswers(newAnswers);

    // Process next step
    processGuidedAnswer(question, answer, newAnswers);
  }, [currentQuestion, guidedAnswers, currentQId, activeLang, tr, addMsg, processGuidedAnswer]);

  // ── Guided: skip optional question ──────────────────────────────────────────
  const handleSkip = useCallback(() => {
    const question = currentQuestion;
    if (!question || question.required) return;
    addMsg('user', tr ? '⏭️ Atlandı' : '⏭️ Skipped');
    const newAnswers = { ...guidedAnswers, [currentQId]: '__skipped__' };
    setGuidedAnswers(newAnswers);
    processGuidedAnswer(question, '__skipped__', newAnswers);
  }, [currentQuestion, guidedAnswers, currentQId, tr, addMsg, processGuidedAnswer]);

  // ── Guided: info-type continue ───────────────────────────────────────────────
  const handleInfoContinue = useCallback(() => {
    const question = currentQuestion;
    if (!question) return;
    addMsg('user', tr ? '✓ Anladım, devam edelim.' : '✓ Got it, let\'s continue.');
    const newAnswers = { ...guidedAnswers, [currentQId]: '__info_continued__' };
    setGuidedAnswers(newAnswers);
    processGuidedAnswer(question, '__info_continued__', newAnswers);
  }, [currentQuestion, guidedAnswers, currentQId, tr, addMsg, processGuidedAnswer]);

  // ── Guided: multi_select toggle ──────────────────────────────────────────────
  const toggleMultiOption = useCallback((value, question) => {
    setSelectedOpts(prev => {
      const opt = question.options?.find(o => o.value === value);
      // Exclusive options (like 'none') deselect everything else
      if (opt?.exclusive) {
        return prev.includes(value) ? [] : [value];
      }
      // Clicking a regular option removes any previously-selected exclusive options
      const withoutExclusive = prev.filter(v => {
        const o = question.options?.find(o2 => o2.value === v);
        return !o?.exclusive;
      });
      return withoutExclusive.includes(value)
        ? withoutExclusive.filter(v => v !== value)
        : [...withoutExclusive, value];
    });
  }, []);

  // ── Start guided mode ────────────────────────────────────────────────────────
  const startGuidedMode = useCallback(() => {
    const firstId = getInitialQuestionId();
    const firstQ  = getQuestionById(firstId);
    const lang    = activeLang;
    const sName   = CARBONIQ_STAGES.find(s => s.id === 1)?.title?.[lang] || '';

    setMode('guided');
    setCurrentQId(firstId);
    setGuidedAnswers({});
    setPendingAnswer('');
    setSelectedOpts([]);
    setGuidedError('');
    setCountryCityVal({ country: '', city: '' });

    // Divider
    setMessages(prev => [...prev, {
      id: `mode-switch-${Date.now()}`,
      role: 'mode-switch',
      label: lang === 'tr'
        ? `📋 Rehberli Akış Başlıyor — ${TOTAL_QUESTIONS} Soru`
        : `📋 Guided Flow Starting — ${TOTAL_QUESTIONS} Questions`,
    }]);

    // Intro
    addMsg('assistant', lang === 'tr'
      ? `ISO 14064-1 soru akışını başlatıyorum.\n\n**Aşama 1: ${sName}** — şirket bilgilerini topluyoruz. Her soruyu yanıtladıktan sonra otomatik ilerleyeceğiz.\n\n💡 Dilediğiniz zaman üstteki **"💬 Serbest"** butonu ile serbest moda dönebilirsiniz.`
      : `Starting the ISO 14064-1 questionnaire.\n\n**Stage 1: ${sName}** — collecting company information. We'll advance automatically after each answer.\n\n💡 You can switch back to **"💬 Free"** mode at any time using the button above.`
    );

    // First question (slight delay for smooth UX)
    setTimeout(() => addGuidedQuestionMsg(firstQ, lang), 550);
  }, [activeLang, addMsg, addGuidedQuestionMsg]);

  // ── Switch back to free mode ─────────────────────────────────────────────────
  const switchToFreeMode = useCallback(() => {
    setMode('free');
    setCurrentQId(null);
    setGuidedError('');
    setMessages(prev => [...prev, {
      id: `mode-switch-${Date.now()}`,
      role: 'mode-switch',
      label: activeLang === 'tr' ? '💬 Serbest Moda Geçildi' : '💬 Switched to Free Mode',
    }]);
    addMsg('assistant', activeLang === 'tr'
      ? 'Serbest moda geçildi. Emisyon verilerini doğal dilde paylaşabilirsiniz.'
      : 'Switched to free mode. Share your emission data in natural language.'
    );
  }, [activeLang, addMsg]);

  // ── Free mode send (overrideText lets chips send directly without typing) ────
  const send = useCallback(async (overrideText) => {
    const text = overrideText !== undefined ? String(overrideText).trim() : input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    addMsg('user', text);
    setSending(true);

    try {
      if (isPreview) {
        await new Promise(r => setTimeout(r, 650 + Math.random() * 550));
        const results = extractEmissions(text);

        if (results.length > 0) {
          // ── Emission data detected: calculate + enrich with benchmark ─────────
          const { reply, suggestion } = buildReply(results, text, activeLang, fieldValues);
          const benchmark = getBenchmarkContext(results[0].type, results[0].amount, activeLang);
          addMsg('assistant', benchmark ? `${reply}\n\n---\n\n${benchmark}` : reply);
          if (suggestion) {
            setMessages(prev => [...prev, {
              id: `s-${suggestion.id}`,
              role: 'suggestion',
              suggestion,
            }]);
          }
        } else {
          // ── No emission data: route by intent (ai-brain intelligence) ─────────
          const intent = detectIntent(text);
          let smartReply;
          if (intent === 'STATUS') {
            smartReply = buildStatusReport(fieldValues, activeLang);
          } else if (intent === 'GUIDANCE') {
            smartReply = buildOnboarding(activeLang);
          } else {
            // QUESTION / BENCHMARK / UNKNOWN — search KB first, then fallback
            smartReply = searchKB(text, activeLang) || buildFallback(activeLang);
          }
          addMsg('assistant', smartReply);
        }
      } else {
        if (!reportId) return;
        const data = await sendWorkspaceChatMessage(reportId, text);
        if (data.reply) addMsg('assistant', data.reply);
        if (data.suggestion) {
          setMessages(prev => [...prev, {
            id: `s-${data.suggestion.id}`,
            role: 'suggestion',
            suggestion: data.suggestion,
          }]);
        } else if (!data.reply) {
          // Only show extraction hint when backend returned NEITHER a reply nor a suggestion.
          // Avoid showing it after every Q&A response which would be noisy.
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
  }, [input, sending, reportId, addMsg, tr, isPreview, fieldValues, activeLang]);

  // ── Suggestion confirm ───────────────────────────────────────────────────────
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
        const category = messages.find(m => m.suggestion?.id === suggestionId)?.suggestion?.category;
        setMessages(prev => prev.map(m =>
          m.suggestion?.id === suggestionId
            ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
            : m
        ));
        addMsg('assistant', buildConfirmMsg(category, fieldValues, tr));
        if (onFieldsConfirmed) onFieldsConfirmed([]);
      } else {
        const result = await confirmSuggestion(suggestionId, editedFields);
        const category = messages.find(m => m.suggestion?.id === suggestionId)?.suggestion?.category;
        setMessages(prev => prev.map(m =>
          m.suggestion?.id === suggestionId
            ? { ...m, role: 'confirmed', suggestion: { ...m.suggestion, status: 'confirmed' } }
            : m
        ));
        addMsg('assistant', buildConfirmMsg(category, fieldValues, tr));
        if (onFieldsConfirmed) onFieldsConfirmed(result.saved_fields || []);
      }
    } catch {
      setError(tr ? 'Kaydetme başarısız. Tekrar deneyin.' : 'Save failed. Please try again.');
    }
  }, [addMsg, tr, isPreview, messages, onPreviewFields, onFieldsConfirmed, fieldValues]);

  // ── Suggestion reject ────────────────────────────────────────────────────────
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

  // ── Quick-start chips (free mode) ────────────────────────────────────────────
  const CHIPS = tr ? [
    { emoji: '🔥', scope: 'Kapsam 1', title: 'Sabit Yanma',    example: '15.000 m³ doğalgaz',   text: '15.000 m³ doğalgaz kullandık' },
    { emoji: '⚡', scope: 'Kapsam 2', title: 'Elektrik',        example: '18.000 kWh',            text: '18.000 kWh elektrik tükettik' },
    { emoji: '✈️', scope: 'Kapsam 3', title: 'İş Seyahati',    example: '12.000 pkm kısa hat',  text: '12.000 pkm kısa mesafe iş seyahati uçuşu yaptık' },
    { emoji: '🚛', scope: 'Kapsam 3', title: 'Nakliye',         example: '45 ton × 1.200 km',    text: '45 ton yük 1200 km karayoluyla taşındı' },
  ] : [
    { emoji: '🔥', scope: 'Scope 1', title: 'Stationary',       example: '15,000 m³ natural gas', text: 'We used 15,000 m³ natural gas' },
    { emoji: '⚡', scope: 'Scope 2', title: 'Electricity',       example: '18,000 kWh',            text: 'We consumed 18,000 kWh electricity' },
    { emoji: '✈️', scope: 'Scope 3', title: 'Business Travel',  example: '12,000 pkm flights',    text: 'We had 12,000 pkm short-haul business travel flights' },
    { emoji: '🚛', scope: 'Scope 3', title: 'Freight',           example: '45 t × 1,200 km',      text: '45 tonnes of freight shipped 1,200 km by road' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FAFAF8]">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[#302817]/6 bg-white">
        {/* Icon + title */}
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#302817] shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11.5px] font-bold text-[#302817] truncate">
            {tr ? 'CarbonIQ AI Asistanı' : 'CarbonIQ AI Assistant'}
          </p>
          <p className="text-[9px] text-[#302817]/30 truncate">
            ISO 14064-1 · DEFRA 2023 · IEA 2023 · GLEC v3
          </p>
        </div>

        {/* ── Mode toggle ── */}
        <div className="flex items-center rounded-full border border-[#302817]/12 overflow-hidden shrink-0 text-[10px] font-bold">
          <button
            onClick={() => mode === 'guided' ? switchToFreeMode() : null}
            className={`px-2.5 py-[5px] transition-all ${
              mode === 'free'
                ? 'bg-[#302817] text-white'
                : 'text-[#302817]/45 hover:text-[#302817] hover:bg-[#302817]/5'
            }`}>
            💬 {tr ? 'Serbest' : 'Free'}
          </button>
          <button
            onClick={() => mode === 'free' ? startGuidedMode() : null}
            className={`px-2.5 py-[5px] transition-all ${
              mode === 'guided'
                ? 'bg-[#302817] text-white'
                : 'text-[#302817]/45 hover:text-[#302817] hover:bg-[#302817]/5'
            }`}>
            📋 {tr ? 'Rehber' : 'Guide'}
          </button>
        </div>

        {/* ── TR / EN toggle ── */}
        <div className="flex items-center rounded-full border border-[#302817]/12 overflow-hidden shrink-0 text-[10px] font-bold">
          <button
            onClick={() => setActiveLang('tr')}
            className={`px-2.5 py-[5px] transition-all ${
              activeLang === 'tr'
                ? 'bg-[#302817] text-white'
                : 'text-[#302817]/45 hover:text-[#302817] hover:bg-[#302817]/5'
            }`}>
            TR
          </button>
          <button
            onClick={() => setActiveLang('en')}
            className={`px-2.5 py-[5px] transition-all ${
              activeLang === 'en'
                ? 'bg-[#302817] text-white'
                : 'text-[#302817]/45 hover:text-[#302817] hover:bg-[#302817]/5'
            }`}>
            EN
          </button>
        </div>

        {/* Online indicator */}
        <span className="shrink-0 hidden sm:flex items-center gap-1 text-[9.5px] font-bold text-[#75863B] bg-[#95A847]/10 border border-[#95A847]/20 px-2 py-1 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#95A847] animate-pulse" />
          {tr ? 'Çevrimiçi' : 'Online'}
        </span>
      </div>

      {/* ── Guided progress bar ── */}
      {mode === 'guided' && currentQuestion && (
        <div className="shrink-0 px-4 py-2 bg-gradient-to-r from-[#F0F3E0]/60 to-[#F9F8F4] border-b border-[#B4BE6A]/20">
          <div className="flex items-center justify-between mb-1.5">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#75863B]/60">
                {tr
                  ? `Aşama ${currentStageIndex + 1} / ${CARBONIQ_STAGES.length}`
                  : `Stage ${currentStageIndex + 1} of ${CARBONIQ_STAGES.length}`}
                {!currentQuestion.required && (
                  <span className="ml-1.5 normal-case font-semibold text-[#302817]/30">
                    · {tr ? 'İsteğe bağlı' : 'Optional'}
                  </span>
                )}
              </p>
              <p className="text-[10.5px] font-bold text-[#75863B] truncate">
                {currentStage?.title?.[activeLang] || currentStage?.title?.en || ''}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-[#302817]/40 shrink-0 tabular-nums">
              {currentQuestion.number} / {TOTAL_QUESTIONS}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-[#302817]/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#B4BE6A] to-[#95A847] transition-all duration-700 ease-out"
              style={{ width: `${(currentQuestion.number / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">

        {/* Quick-start chips — visible until user submits first emission data */}
        {mode === 'free' && !messages.some(m => ['suggestion', 'confirmed', 'rejected'].includes(m.role)) && (
          <div className="flex flex-col items-center gap-2.5 pt-1 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#302817]/25">
              {tr ? 'Hızlı Örnek Seç' : 'Quick Start Example'}
            </p>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-xs">
              {CHIPS.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => send(chip.text)}
                  className="rounded-xl border border-[#302817]/10 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/8 active:scale-[0.97]"
                >
                  <span className="text-[16px] leading-none">{chip.emoji}</span>
                  <p className="text-[9px] font-bold text-[#302817]/35 mt-1.5 uppercase tracking-wide">{chip.scope}</p>
                  <p className="text-[11px] font-bold text-[#302817] leading-tight">{chip.title}</p>
                  <p className="text-[9.5px] text-[#302817]/35 mt-0.5 font-mono">{chip.example}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-[#302817]/8" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#302817]/20">
                {tr ? 'veya kendiniz yazın' : 'or type your own data'}
              </span>
              <div className="flex-1 h-px bg-[#302817]/8" />
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map(msg => {
          if (msg.role === 'mode-switch') {
            return (
              <div key={msg.id} className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#B4BE6A]/25" />
                <span className="text-[9.5px] font-bold text-[#75863B]/60 shrink-0 px-1">{msg.label}</span>
                <div className="flex-1 h-px bg-[#B4BE6A]/25" />
              </div>
            );
          }
          if (msg.role === 'suggestion') {
            return (
              <SuggestionReviewCard key={msg.id} suggestion={msg.suggestion}
                onConfirm={handleConfirm} onReject={handleReject} lang={activeLang} />
            );
          }
          if (msg.role === 'confirmed') {
            const catLabel = ({
              '3A': tr ? 'Kapsam 1 — Sabit Yanma'  : 'Scope 1 — Stationary Combustion',
              '4A': tr ? 'Kapsam 2 — Elektrik'      : 'Scope 2 — Electricity',
              'K4': tr ? 'Kapsam 3 — Nakliye'       : 'Scope 3 — Freight',
              'K5': tr ? 'Kapsam 3 — İş Seyahati'  : 'Scope 3 — Business Travel',
            })[msg.suggestion?.category] || msg.suggestion?.category;
            return (
              <div key={msg.id} className="flex items-center gap-3 rounded-2xl border border-[#95A847]/25 bg-[#95A847]/8 px-4 py-3 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-[#527A1A] shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-[#527A1A]">{tr ? 'Kaydedildi' : 'Saved'} — {catLabel}</p>
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

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-[#302817]/6 bg-white px-4 py-3">

        {/* ── GUIDED MODE: dynamic input based on question type ── */}
        {mode === 'guided' && currentQuestion && (
          <div className="flex flex-col gap-2">
            {/* Validation error */}
            {guidedError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                {guidedError}
              </div>
            )}

            {/* INFO → Continue button */}
            {currentQuestion.type === 'info' && (
              <button onClick={handleInfoContinue}
                className="w-full rounded-full bg-[#302817] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-black active:scale-[0.98] transition">
                {tr ? '→ Devam' : '→ Continue'}
              </button>
            )}

            {/* SINGLE_SELECT / YEAR_SELECT → option pills */}
            {['single_select', 'year_select'].includes(currentQuestion.type) && currentQuestion.options && (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {currentQuestion.options.map(opt => (
                  <button key={opt.value}
                    onClick={() => submitGuidedAnswer(opt.value)}
                    className="w-full text-left rounded-xl border border-[#302817]/10 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#302817] shadow-sm hover:border-[#B4BE6A]/60 hover:bg-[#B4BE6A]/8 hover:text-[#302817] active:scale-[0.98] transition">
                    {opt.label?.[activeLang] || opt.label?.en || opt.value}
                  </button>
                ))}
              </div>
            )}

            {/* MULTI_SELECT → checkable pills + Confirm button */}
            {currentQuestion.type === 'multi_select' && currentQuestion.options && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
                  {currentQuestion.options.map(opt => {
                    const isSelected = selectedOpts.includes(opt.value);
                    return (
                      <button key={opt.value}
                        onClick={() => toggleMultiOption(opt.value, currentQuestion)}
                        className={`w-full text-left rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold transition active:scale-[0.98] ${
                          isSelected
                            ? 'border-[#B4BE6A] bg-[#B4BE6A]/15 text-[#302817]'
                            : 'border-[#302817]/10 bg-white text-[#302817]/65 hover:border-[#B4BE6A]/40 hover:text-[#302817]'
                        }`}>
                        <span className="mr-2.5 font-mono text-[11px]">{isSelected ? '✓' : '○'}</span>
                        {opt.label?.[activeLang] || opt.label?.en || opt.value}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => submitGuidedAnswer(selectedOpts)}
                  disabled={selectedOpts.length === 0 && currentQuestion.required}
                  className="w-full rounded-full bg-[#302817] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-black disabled:opacity-40 active:scale-[0.98] transition mt-0.5">
                  {tr
                    ? `Onayla${selectedOpts.length > 0 ? ` (${selectedOpts.length})` : ''}`
                    : `Confirm${selectedOpts.length > 0 ? ` (${selectedOpts.length})` : ''}`}
                </button>
              </div>
            )}

            {/* COUNTRY_CITY → two-field input */}
            {currentQuestion.type === 'country_city' && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-xl border border-[#302817]/10 bg-[#FAFAF8] px-3 py-2.5 text-[12.5px] font-semibold text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 transition"
                    value={countryCityVal.country}
                    onChange={e => { setCountryCityVal(v => ({ ...v, country: e.target.value })); setGuidedError(''); }}>
                    <option value="">{tr ? '— Ülke seçin —' : '— Select country —'}</option>
                    {(currentQuestion.options || []).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label?.[activeLang] || opt.label?.en || opt.value}
                      </option>
                    ))}
                  </select>
                  <input
                    className="flex-1 rounded-xl border border-[#302817]/10 bg-[#FAFAF8] px-3 py-2.5 text-[12.5px] font-semibold text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 transition"
                    placeholder={tr ? 'Şehir' : 'City'}
                    value={countryCityVal.city}
                    onChange={e => { setCountryCityVal(v => ({ ...v, city: e.target.value })); setGuidedError(''); }}
                  />
                </div>
                <button
                  onClick={() => submitGuidedAnswer(countryCityVal)}
                  disabled={!countryCityVal.country || !countryCityVal.city}
                  className="w-full rounded-full bg-[#302817] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-black disabled:opacity-40 active:scale-[0.98] transition">
                  {tr ? '→ Onayla' : '→ Confirm'}
                </button>
              </div>
            )}

            {/* TEXT / NUMERIC / COMPOUND / LOOP TYPES → textarea
                Also serves as catch-all fallback for any unknown future type
                so guided mode never gets fully stuck with no input. */}
            {(
              ['text', 'compound'].includes(currentQuestion.type) ||
              !['info', 'single_select', 'year_select', 'multi_select', 'country_city'].includes(currentQuestion.type)
            ) && (
              <div className="flex items-end gap-2">
                <textarea
                  className="flex-1 resize-none rounded-2xl border border-[#302817]/10 bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/28 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 min-h-[44px] max-h-[130px] transition-colors leading-relaxed"
                  placeholder={currentQuestion.placeholder?.[activeLang] || currentQuestion.placeholder?.en || (tr ? 'Yanıtınızı yazın…' : 'Type your answer…')}
                  value={pendingAnswer}
                  rows={1}
                  onChange={e => { setPendingAnswer(e.target.value); setGuidedError(''); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const t = pendingAnswer.trim();
                      if (!t) { if (!currentQuestion.required) handleSkip(); return; }
                      submitGuidedAnswer(t);
                    }
                  }}
                  maxLength={currentQuestion.maxLength || 500}
                />
                <button
                  onClick={() => {
                    const t = pendingAnswer.trim();
                    if (!t) { if (!currentQuestion.required) handleSkip(); return; }
                    submitGuidedAnswer(t);
                  }}
                  disabled={!pendingAnswer.trim() && currentQuestion.required}
                  aria-label={tr ? 'Gönder' : 'Send'}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Footer: ISO ref + skip button */}
            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <TrendingUp className="h-3 w-3 text-[#75863B]/40 shrink-0" />
                <p className="text-[9.5px] text-[#302817]/28 truncate">
                  {currentQuestion.isoRef} — {tr ? `Soru ${currentQuestion.number}/${TOTAL_QUESTIONS}` : `Question ${currentQuestion.number}/${TOTAL_QUESTIONS}`}
                  {currentQuestion.required ? (tr ? ' · Zorunlu' : ' · Required') : (tr ? ' · İsteğe bağlı' : ' · Optional')}
                </p>
              </div>
              {!currentQuestion.required && currentQuestion.type !== 'info' && (
                <button
                  onClick={handleSkip}
                  className="shrink-0 text-[9.5px] font-semibold text-[#302817]/30 hover:text-[#302817]/55 transition flex items-center gap-0.5 whitespace-nowrap"
                >
                  {tr ? 'Atla' : 'Skip'} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── FREE MODE (or guided finished) input ── */}
        {(mode === 'free' || (mode === 'guided' && !currentQuestion)) && (
          <>
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-2xl border border-[#302817]/10 bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#302817] outline-none placeholder:text-[#302817]/28 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/15 min-h-[44px] max-h-[130px] transition-colors leading-relaxed"
                placeholder={tr
                  ? 'Örn: "15.000 m³ doğalgaz kullandık" veya "18.000 kWh elektrik tükettik"'
                  : 'E.g. "We used 15,000 m³ natural gas" or "18,000 kWh electricity consumed"'}
                value={input}
                rows={1}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                maxLength={4000}
              />
              <button onClick={send} disabled={!input.trim() || sending}
                aria-label={tr ? 'Gönder' : 'Send'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#302817] text-white shadow-sm transition hover:bg-black disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">
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
          </>
        )}
      </div>
    </div>
  );
}
