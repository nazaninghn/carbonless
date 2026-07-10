'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2, Info, TrendingUp, FileText, X } from 'lucide-react';
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
// Emission factors shared with ai-brain.js and the dashboard preview — see
// emission-factors.js for why this used to be three separate, drifting tables.
import { getEmissionFactor, EF_SOURCE } from '@/lib/carboniq/emission-factors';

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
    const ef = getEmissionFactor('natural_gas', unitRaw);
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
    const ef = getEmissionFactor('diesel', unit);
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
    const ef = getEmissionFactor('lpg', unit);
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
    const ef = getEmissionFactor('fuel_oil', unit);
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
    const ef = getEmissionFactor('electricity', 'kwh');
    results.push({
      scope: 2, category: '4A', type: 'electricity',
      amount: kwhAmt, unit: 'kWh', ef, emKg: Math.round(kwhAmt * ef),
      fields: [
        { field_id: 'rf.4a.consumption_kwh', label: 'Consumption', value: kwhAmt, unit: 'kWh', confidence: 0.94 },
        { field_id: 'rf.4a.emission_factor', label: 'Emission Factor', value: 0.4199, unit: 'kgCO₂e/kWh', confidence: 0.99 },
        { field_id: 'rf.4a.supplier',        label: 'Supplier', value: 'Şebeke (TEDAŞ)', confidence: 0.75 },
      ],
      _localFields: { 'rf.4a.consumption_kwh': kwhAmt, 'rf.4a.emission_factor': 0.4199, 'rf.4a.supplier': 'Şebeke (TEDAŞ)' },
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
    const ef   = getEmissionFactor(fType, 'pkm');
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
    const ef   = getEmissionFactor('rail_travel', 'pkm');
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
    const ef = getEmissionFactor(mode, 'tkm');

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

// When user clicks a quick-start chip, bot asks for their own data (no pre-filled numbers)
const CHIP_PROMPTS = {
  stationary: {
    tr: "🔥 **Kapsam 1 — Sabit Yanma**\n\nHangi yakıtı kullandınız ve ne kadar tükettiniz?\n\n→ _Örnek: '15.000 m³ doğalgaz kullandık'_\n→ _Örnek: '5.000 litre dizel yaktık'_\n\nSiz ne kadar kullandınız?",
    en: "🔥 **Scope 1 — Stationary Combustion**\n\nWhich fuel did you use and how much?\n\n→ _Example: 'We used 15,000 m³ natural gas'_\n→ _Example: 'We burned 5,000 litres of diesel'_\n\nWhat was your consumption?",
  },
  electricity: {
    tr: "⚡ **Kapsam 2 — Elektrik Tüketimi**\n\nYıllık elektrik tüketiminiz ne kadar?\n\n→ _Örnek: '18.000 kWh tükettik'_\n→ _Örnek: 'Yıllık 150 MWh'_\n\nSizin tüketiminiz kaç kWh?",
    en: "⚡ **Scope 2 — Electricity**\n\nHow much electricity did you consume this year?\n\n→ _Example: 'We consumed 18,000 kWh'_\n→ _Example: 'Annual usage: 150 MWh'_\n\nWhat was your consumption?",
  },
  travel: {
    tr: "✈️ **Kapsam 3 — İş Seyahati**\n\nUçuş veya tren seyahatlerinizi paylaşın.\n\n→ _Örnek: '8.000 pkm kısa mesafe uçuş yaptık'_\n→ _Örnek: '3.000 km tren seyahati'_\n\nSizin toplam yolculuğunuz ne kadar?",
    en: "✈️ **Scope 3 — Business Travel**\n\nShare your flight or rail travel data.\n\n→ _Example: 'We flew 8,000 pkm short-haul'_\n→ _Example: '3,000 km by rail'_\n\nWhat was your total travel distance?",
  },
  freight: {
    tr: "🚛 **Kapsam 3 — Nakliye**\n\nYük taşıma verilerinizi paylaşın.\n\n→ _Örnek: '30 ton yük 800 km karayoluyla taşındı'_\n→ _Örnek: '2.000 tkm denizyolu'_\n\nSizin taşınan yük ve mesafe ne kadar?",
    en: "🚛 **Scope 3 — Freight**\n\nShare your freight transport data.\n\n→ _Example: '30 tonnes shipped 800 km by road'_\n→ _Example: '2,000 tkm sea freight'_\n\nWhat was your cargo weight and distance?",
  },
};

// ─── MULTI-TURN CONVERSATION FLOWS ────────────────────────────────────────────
// Each chip click starts a guided conversation: bot asks step-by-step questions,
// user types their own numbers, bot calculates only from user-provided data.

const FUEL_NAME = {
  natural_gas: { tr: 'Doğalgaz',  en: 'Natural gas' },
  diesel:      { tr: 'Dizel',     en: 'Diesel'       },
  lpg:         { tr: 'LPG',       en: 'LPG'          },
  fuel_oil:    { tr: 'Fuel Oil',  en: 'Fuel oil'     },
  coal:        { tr: 'Kömür',     en: 'Coal'         },
};
const FUEL_DEFAULT_UNIT = { natural_gas: 'm³', diesel: 'litre', lpg: 'litre', fuel_oil: 'litre', coal: 'kg' };

const CONV_FLOWS = {
  stationary: {
    steps: [
      {
        id: 'fuel_type',
        q: { tr: 'Hangi yakıtı kullanıyorsunuz?\n\n→ **Doğalgaz** · **Dizel** · **LPG** · **Fuel Oil** · **Kömür**', en: 'Which fuel do you use?\n\n→ **Natural gas** · **Diesel** · **LPG** · **Fuel oil** · **Coal**' },
        parse(t) {
          if (/doğal\s*gaz|natural.?gas|gaz\b/i.test(t)) return { fuel_type: 'natural_gas' };
          if (/dizel|diesel|mazot\b/i.test(t)) return { fuel_type: 'diesel' };
          if (/lpg|sıvılaştırılmış/i.test(t)) return { fuel_type: 'lpg' };
          if (/fuel.?oil|kalorifer.?yakıt|mazut\b/i.test(t)) return { fuel_type: 'fuel_oil' };
          if (/kömür|coal/i.test(t)) return { fuel_type: 'coal' };
          return null;
        },
        nextQ(d, isTr) {
          const name = FUEL_NAME[d.fuel_type][isTr ? 'tr' : 'en'];
          const unit = FUEL_DEFAULT_UNIT[d.fuel_type];
          return isTr
            ? `${name} seçildi. 👍\n\nYıllık ne kadar kullandınız? Miktar ve birim yazın.\n\n→ _Örnek: "5.000 ${unit}"_`
            : `${name} selected. 👍\n\nHow much did you use annually? Write quantity and unit.\n\n→ _Example: "5,000 ${unit}"_`;
        },
        failQ: { tr: 'Yakıt türünü anlayamadım. Lütfen şunlardan birini yazın:\n**Doğalgaz** · **Dizel** · **LPG** · **Fuel Oil** · **Kömür**', en: "I couldn't identify the fuel. Please write one of:\n**Natural gas** · **Diesel** · **LPG** · **Fuel oil** · **Coal**" },
      },
      {
        id: 'amount',
        parse(t, data) {
          const nums = extractNums(t);
          if (!nums.length) return null;
          const unit = /\bton\b/i.test(t) ? 'ton' : /\bkg\b/i.test(t) ? 'kg'
            : /litre|liter|\bl\b/i.test(t) ? 'litre'
            : /\bgj\b/i.test(t) ? 'GJ' : FUEL_DEFAULT_UNIT[data.fuel_type];
          return { amount: nums[0], unit };
        },
        failQ: { tr: 'Miktarı anlayamadım. Lütfen bir sayı ve birim yazın.\n_Örnek: "15.000 m³" veya "5.000 litre"_', en: "I couldn't find the quantity. Write a number with unit.\n_Example: \"15,000 m³\" or \"5,000 litres\"_" },
      },
    ],
    finish(data) {
      const ef = getEmissionFactor(data.fuel_type, data.unit);
      const emKg = Math.round(data.amount * ef);
      return {
        category: '3A', confidence: 0.95, emKg,
        fields: [
          { field_id: 'rf.3a.fuel_type',   value: data.fuel_type, label: 'Fuel type'   },
          { field_id: 'rf.3a.consumption', value: data.amount,    unit: data.unit, label: 'Consumption' },
          { field_id: 'rf.3a.unit',        value: data.unit,      label: 'Unit'         },
        ],
        _localFields: { 'rf.3a.fuel_type': data.fuel_type, 'rf.3a.consumption': data.amount, 'rf.3a.unit': data.unit },
      };
    },
  },

  electricity: {
    steps: [
      {
        id: 'kwh',
        q: { tr: 'Yıllık elektrik tüketiminiz ne kadar?\n\n→ kWh veya MWh olarak yazın.', en: 'How much electricity did you consume this year?\n\n→ Write in kWh or MWh.' },
        parse(t) {
          const nums = extractNums(t);
          if (!nums.length) return null;
          const isMwh = /mwh/i.test(t);
          return { kwh: isMwh ? nums[0] * 1000 : nums[0] };
        },
        failQ: { tr: 'Bir sayı bulamadım. kWh veya MWh olarak yazın.\n_Örnek: "18.000 kWh"_', en: "I couldn't find a number. Write in kWh or MWh.\n_Example: \"18,000 kWh\"_" },
      },
    ],
    finish(data) {
      const ef = getEmissionFactor('electricity', 'kwh');
      const emKg = Math.round(data.kwh * ef);
      return {
        category: '4A', confidence: 0.94, emKg,
        fields: [
          { field_id: 'rf.4a.consumption_kwh',      value: data.kwh, unit: 'kWh',        label: 'Consumption'    },
          { field_id: 'rf.4a.emission_factor',       value: 0.4199,    unit: 'kgCO₂e/kWh', label: 'Emission factor' },
          { field_id: 'rf.4a.total_emission_kgco2e', value: emKg,     unit: 'kgCO₂e',     label: 'Total emission'  },
        ],
        _localFields: { 'rf.4a.consumption_kwh': data.kwh, 'rf.4a.emission_factor': 0.4199 },
      };
    },
  },

  travel: {
    steps: [
      {
        id: 'ttype',
        q: { tr: 'Ne tür seyahat?\n\n→ **İç hat uçuş** · **Kısa mesafe uçuş** · **Uzun mesafe uçuş** · **Tren** · **Araç**', en: 'What type of travel?\n\n→ **Domestic flight** · **Short-haul** · **Long-haul** · **Train** · **Car**' },
        parse(t) {
          if (/iç\s*hat|domestic|yurt\s*içi/i.test(t)) return { ttype: 'flight_domestic',   fieldKey: 'rf.k5.air_domestic_pkm'   };
          if (/uzun\s*mesafe|long.?haul|transatlant/i.test(t)) return { ttype: 'flight_long_haul', fieldKey: 'rf.k5.air_long_haul_pkm'  };
          if (/kısa\s*mesafe|short.?haul/i.test(t)) return { ttype: 'flight_short_haul', fieldKey: 'rf.k5.air_short_haul_pkm' };
          if (/uçuş|uçak|flight|hava/i.test(t))    return { ttype: 'flight_short_haul', fieldKey: 'rf.k5.air_short_haul_pkm' };
          if (/tren|rail|demiryolu/i.test(t))       return { ttype: 'rail_travel',        fieldKey: 'rf.k5.rail_pkm'           };
          if (/araç|araba|car\b/i.test(t))          return { ttype: 'car_rental',         fieldKey: 'rf.k5.car_km'             };
          return null;
        },
        nextQ(d, isTr) {
          const labels = { flight_domestic:{tr:'İç hat uçuş',en:'Domestic flight'}, flight_short_haul:{tr:'Kısa mesafe uçuş',en:'Short-haul'}, flight_long_haul:{tr:'Uzun mesafe uçuş',en:'Long-haul'}, rail_travel:{tr:'Tren',en:'Train'}, car_rental:{tr:'Araç',en:'Car'} };
          const label = labels[d.ttype]?.[isTr ? 'tr' : 'en'] || d.ttype;
          return isTr
            ? `${label} seçildi. 👍\n\nToplam yolculuk mesafeniz ne kadar? (pkm veya km)\n\n→ _Örnek: "8.000 pkm"_`
            : `${label} selected. 👍\n\nTotal travel distance? (in pkm or km)\n\n→ _Example: "8,000 pkm"_`;
        },
        failQ: { tr: 'Seyahat türünü anlayamadım.\n**İç hat** · **Kısa mesafe** · **Uzun mesafe** · **Tren** · **Araç**', en: "I couldn't identify the travel type.\n**Domestic** · **Short-haul** · **Long-haul** · **Train** · **Car**" },
      },
      {
        id: 'distance',
        parse(t) { const n = extractNums(t); return n.length ? { distance: n[0] } : null; },
        failQ: { tr: 'Mesafeyi bulamadım. Bir sayı yazın.\n_Örnek: "8.000 pkm"_', en: "I couldn't find the distance. Write a number.\n_Example: \"8,000 pkm\"_" },
      },
    ],
    finish(data) {
      const ef = getEmissionFactor(data.ttype, 'pkm');
      const emKg = Math.round(data.distance * ef);
      return {
        category: 'K5', confidence: 0.90, emKg,
        fields: [
          { field_id: data.fieldKey,                  value: data.distance, unit: 'pkm',     label: 'Distance'      },
          { field_id: 'rf.k5.total_emission_kgco2e',  value: emKg,          unit: 'kgCO₂e',  label: 'Total emission' },
        ],
        _localFields: { [data.fieldKey]: data.distance, 'rf.k5.total_emission_kgco2e': emKg },
      };
    },
  },

  freight: {
    steps: [
      {
        id: 'mode',
        q: { tr: 'Hangi taşıma modu?\n\n→ **Karayolu** · **Denizyolu** · **Havayolu** · **Demiryolu**', en: 'Which transport mode?\n\n→ **Road** · **Sea** · **Air** · **Rail**' },
        parse(t) {
          if (/deniz|sea\b|gemi|vessel/i.test(t)) return { mode: 'sea_bulk'    };
          if (/hava|air.?freight/i.test(t))       return { mode: 'air_freight'  };
          if (/demir|rail.?freight/i.test(t))     return { mode: 'rail_freight' };
          if (/hafif|lgv/i.test(t))               return { mode: 'road_lgv'    };
          return { mode: 'road_hgv' }; // default: road
        },
        nextQ(d, isTr) {
          const labels = { sea_bulk:{tr:'Denizyolu',en:'Sea'}, air_freight:{tr:'Havayolu',en:'Air'}, rail_freight:{tr:'Demiryolu',en:'Rail'}, road_lgv:{tr:'Hafif araç',en:'Light vehicle'}, road_hgv:{tr:'Karayolu',en:'Road'} };
          const label = labels[d.mode]?.[isTr ? 'tr' : 'en'] || d.mode;
          return isTr ? `${label} seçildi. 👍\n\nKaç ton yük taşındı?` : `${label} selected. 👍\n\nHow many tonnes of freight?`;
        },
        failQ: { tr: '', en: '' },
      },
      {
        id: 'tonnes',
        parse(t) { const n = extractNums(t); return n.length ? { tonnes: n[0] } : null; },
        nextQ(d, isTr) {
          return isTr
            ? `${d.tonnes.toLocaleString()} ton. Taşıma mesafesi ne kadar? (km)`
            : `${d.tonnes.toLocaleString()} tonnes. Transport distance? (in km)`;
        },
        failQ: { tr: 'Ton miktarını anlayamadım. Bir sayı yazın.\n_Örnek: "45 ton"_', en: "I couldn't find the tonnage. Write a number.\n_Example: \"45 tonnes\"_" },
      },
      {
        id: 'km',
        parse(t) { const n = extractNums(t); return n.length ? { km: n[0] } : null; },
        failQ: { tr: 'Mesafeyi anlayamadım. km cinsinden yazın.\n_Örnek: "1.200 km"_', en: "I couldn't find the distance. Write in km.\n_Example: \"1,200 km\"_" },
      },
    ],
    finish(data) {
      const ef = getEmissionFactor(data.mode, 'tkm');
      const tkm = data.tonnes * data.km;
      const emKg = Math.round(tkm * ef);
      return {
        category: 'K4', confidence: 0.88, emKg,
        fields: [{ field_id: 'rf.k4.total_emission_kgco2e', value: emKg, unit: 'kgCO₂e', label: 'Total emission' }],
        _localFields: { 'rf.k4.total_emission_kgco2e': emKg },
      };
    },
  },
};

function detectCategoryIntent(text) {
  const t = text;
  if (/doğal\s*gaz|diesel|dizel|lpg\b|kömür|coal|fuel.?oil|yakıt|combustion|yanma|sabit/i.test(t)) return 'stationary';
  if (/elektrik|electricity|kwh|mwh\b|enerji|grid/i.test(t) && !/uçuş|flight/i.test(t)) return 'electricity';
  if (/uçuş|uçak|flight|iş\s*seyahat|business.?travel|tren\b|rail\b|pkm/i.test(t) && !/nakliye|freight|kargo/i.test(t)) return 'travel';
  if (/nakliye|freight|kargo|cargo|taşıma|kamyon|tır\b|lorry|truck|tkm|ton.?km/i.test(t)) return 'freight';
  return null;
}

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
  const source   = EF_SOURCE[r.type] || 'DEFRA 2024';
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
          className="h-[7px] w-[7px] rounded-full bg-[#8BEA99]"
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
        return <code key={i} className="rounded bg-[#072C0E]/8 px-1 py-px font-mono text-[10.5px]">{p.slice(1, -1)}</code>;
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
                    <th key={ci} className="border border-[#072C0E]/10 bg-[#072C0E]/6 px-2.5 py-1.5 text-left font-bold text-[#072C0E]/60">
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-[#072C0E]/[0.02]' : ''}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-[#072C0E]/10 px-2.5 py-1.5 text-[#072C0E]/65">
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
        if (line.trim() === '---') return <hr key={si} className="border-[#072C0E]/10 my-2" />;
        if (!line.trim())          return <div key={si} className="h-2" />;
        if (line.startsWith('→ ')) return (
          <div key={si} className="flex items-start gap-1.5">
            <span className="text-[#175022] font-bold shrink-0 select-none">→</span>
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
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#1A7B2A] px-4 py-2.5 text-white/95 text-[13px] leading-[1.7]">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#175022]">
        <Sparkles className="h-2.5 w-2.5 text-white/80" />
      </div>
      <div className="flex-1 min-w-0 text-[#072C0E]">
        <RichText text={msg.content} />
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
  startQuestionnaire = false,
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

  // ── Emission conversation state (multi-turn guided data collection) ───────────
  // { cat: 'stationary'|'electricity'|'travel'|'freight', step: number, data: {} }
  const [emConv, setEmConv] = useState(null);

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
      ? 'Karbon envanterinizi birlikte oluşturalım.\n\nAşağıdan bir kategori seçin ya da tüketim verinizi doğrudan yazın.'
      : "Let's build your carbon inventory.\n\nPick a category below or type your consumption data directly.";
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

  // Auto-start questionnaire when parent switches to questionnaire tab
  useEffect(() => {
    if (startQuestionnaire && mode === 'free') {
      startGuidedMode();
    } else if (!startQuestionnaire && mode === 'guided') {
      switchToFreeMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startQuestionnaire]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll when user is already near the bottom (≤ 120px away).
    // Avoids interrupting a user who deliberately scrolled up to re-read a message.
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
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
      ? `ISO 14064-1 soru akışını başlatıyorum.\n\n**Aşama 1: ${sName}** — şirket bilgilerini topluyoruz. Her soruyu yanıtladıktan sonra otomatik ilerleyeceğiz.\n\n💡 Dilediğiniz zaman üstteki **"💬 Sohbet"** butonu ile sohbet moduna dönebilirsiniz.`
      : `Starting the ISO 14064-1 questionnaire.\n\n**Stage 1: ${sName}** — collecting company information. We'll advance automatically after each answer.\n\n💡 You can switch back to **"💬 Chat"** mode at any time using the button above.`
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
      label: activeLang === 'tr' ? '💬 Sohbet Moduna Geçildi' : '💬 Switched to Chat Mode',
    }]);
    addMsg('assistant', activeLang === 'tr'
      ? 'Sohbet moduna geçildi. Emisyon verilerini doğal dilde paylaşabilirsiniz.'
      : 'Switched to chat mode. Share your emission data in natural language.'
    );
  }, [activeLang, addMsg]);

  // ── Free mode send ────────────────────────────────────────────────────────────
  const send = useCallback(async (overrideText) => {
    const text = overrideText !== undefined ? String(overrideText).trim() : input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    addMsg('user', text);
    setSending(true);

    try {
      if (isPreview) {
        // ── If in multi-turn conversation, let the conversation handler process ──
        if (emConv) {
          await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
          handleConvAnswer(text);
          return;
        }

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
          // ── No emission data: try to detect category intent → start conversation
          const cat = detectCategoryIntent(text);
          if (cat) {
            const L = activeLang === 'tr' ? 'tr' : 'en';
            setEmConv({ cat, step: 0, data: {} });
            addMsg('assistant', CONV_FLOWS[cat].steps[0].q[L]);
          } else {
            // ── Generic intent routing (status / guidance / KB) ────────────────
            const intent = detectIntent(text);
            let smartReply;
            if (intent === 'STATUS') {
              smartReply = buildStatusReport(fieldValues, activeLang);
            } else if (intent === 'GUIDANCE') {
              smartReply = buildOnboarding(activeLang);
            } else {
              smartReply = searchKB(text, activeLang) || buildFallback(activeLang);
            }
            addMsg('assistant', smartReply);
          }
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
    } catch (err) {
      // Graceful fallback: try local emission extraction before showing an error
      const results = extractEmissions(text);
      if (results.length > 0) {
        const { reply, suggestion } = buildReply(results, text, activeLang, fieldValues);
        const benchmark = getBenchmarkContext(results[0].type, results[0].amount, activeLang);
        addMsg('assistant', benchmark ? `${reply}\n\n---\n\n${benchmark}` : reply);
        if (suggestion) {
          setMessages(prev => [...prev, {
            id: `s-${suggestion.id}`,
            role: 'suggestion',
            suggestion: { ...suggestion, _fallback: true },
          }]);
        }
      } else if (err?.status === 502 || err?.status === 503) {
        setError(tr
          ? '⏳ Sunucu başlatılıyor... 30 saniye bekleyip tekrar deneyin.'
          : '⏳ Server is starting up. Wait 30 seconds and try again.');
      } else {
        setError(tr ? 'AI isteği başarısız. Tekrar deneyin.' : 'AI request failed. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, reportId, addMsg, tr, isPreview, fieldValues, activeLang, emConv]);

  // ── Suggestion confirm ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (suggestionId, editedFields) => {
    try {
      const msg = messages.find(m => m.suggestion?.id === suggestionId);
      const isFallback = msg?.suggestion?._fallback;

      if (isPreview || isFallback) {
        // Preview mode OR backend-failed fallback: save locally, no API call
        if (msg?.suggestion?._localFields) {
          const fields = editedFields
            ? editedFields
            : Object.entries(msg.suggestion._localFields).map(([field_id, value]) => ({ field_id, value }));
          if (onPreviewFields) onPreviewFields(fields);
        }
        const category = msg?.suggestion?.category;
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

  // ── Conversation answer handler (preview mode multi-turn) ───────────────────
  const handleConvAnswer = useCallback((text) => {
    if (!emConv) return false;
    const { cat, step, data } = emConv;
    const L = activeLang === 'tr' ? 'tr' : 'en';
    const isTr = L === 'tr';
    const flow = CONV_FLOWS[cat];
    if (!flow) { setEmConv(null); return false; }

    const currentStep = flow.steps[step];
    if (!currentStep) { setEmConv(null); return false; }

    const parsed = currentStep.parse(text, data);

    if (!parsed) {
      const failMsg = currentStep.failQ[L] || (isTr ? 'Anlayamadım, tekrar deneyin.' : "I didn't understand, please try again.");
      if (failMsg) setTimeout(() => addMsg('assistant', failMsg), 300);
      return true;
    }

    const newData = { ...data, ...parsed };
    const isLastStep = step >= flow.steps.length - 1;

    if (isLastStep) {
      setEmConv(null);
      try {
        const result = flow.finish(newData);
        const catLabel = SCOPE_LABEL[result.category]?.[L] || result.category;
        const emText = fmtKg(result.emKg);
        const replyText = isTr
          ? `✅ **${catLabel}** hesaplandı!\n\nSizin verilerinizden toplam: **${emText}**\n\nAşağıdaki kartı kontrol edip kaydedin:`
          : `✅ **${catLabel}** calculated!\n\nFrom your data: **${emText}**\n\nCheck the card below and save:`;
        setTimeout(() => {
          addMsg('assistant', replyText);
          const suggestion = {
            id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            category: result.category,
            confidence: result.confidence,
            fields: result.fields,
            emKg: result.emKg,
            _localFields: result._localFields,
          };
          setMessages(prev => [...prev, { id: `s-${suggestion.id}`, role: 'suggestion', suggestion }]);
        }, 350);
      } catch {
        addMsg('assistant', isTr ? 'Hesaplama hatası. Tekrar deneyin.' : 'Calculation error. Please try again.');
      }
    } else {
      setEmConv({ cat, step: step + 1, data: newData });
      const nextMsg = currentStep.nextQ ? currentStep.nextQ(parsed, isTr) : flow.steps[step + 1].q?.[L] || '';
      setTimeout(() => addMsg('assistant', nextMsg), 350);
    }
    return true;
  }, [emConv, activeLang, addMsg, setMessages]);

  // ── Chip click: start conversation (no pre-filled numbers) ───────────────────
  const handleChipClick = useCallback((chip) => {
    const L = activeLang === 'tr' ? 'tr' : 'en';
    addMsg('user', `${chip.emoji} ${chip.title}`);
    // Start conversation state so subsequent messages are handled step-by-step
    setEmConv({ cat: chip.cat, step: 0, data: {} });
    // First question comes from the flow (not CHIP_PROMPTS) for consistency
    const firstQ = CONV_FLOWS[chip.cat]?.steps[0]?.q?.[L] || CHIP_PROMPTS[chip.cat][L];
    setTimeout(() => addMsg('assistant', firstQ), 380);
  }, [activeLang, addMsg]);

  // ── Quick reply: click an inline option chip (fuel, travel type, freight mode) ─
  const handleQuickReply = useCallback((value) => {
    addMsg('user', value);
    if (emConv) setTimeout(() => handleConvAnswer(value), 350);
  }, [addMsg, emConv, handleConvAnswer]);

  // ── Inline quick reply options based on current conversation step ─────────────
  const quickReplies = (() => {
    if (!emConv) return null;
    if (emConv.cat === 'stationary' && emConv.step === 0) {
      return tr
        ? [{l:'🔥 Doğalgaz', v:'doğalgaz'}, {l:'⛽ Dizel', v:'dizel'}, {l:'🔵 LPG', v:'lpg'}, {l:'🛢️ Fuel Oil', v:'fuel oil'}, {l:'⚫ Kömür', v:'kömür'}]
        : [{l:'🔥 Natural gas', v:'natural gas'}, {l:'⛽ Diesel', v:'diesel'}, {l:'🔵 LPG', v:'lpg'}, {l:'🛢️ Fuel oil', v:'fuel oil'}, {l:'⚫ Coal', v:'coal'}];
    }
    if (emConv.cat === 'travel' && emConv.step === 0) {
      return tr
        ? [{l:'🛫 İç Hat', v:'iç hat'}, {l:'✈️ Kısa Mesafe', v:'kısa mesafe'}, {l:'✈️ Uzun Mesafe', v:'uzun mesafe'}, {l:'🚂 Tren', v:'tren'}, {l:'🚗 Araç', v:'araç'}]
        : [{l:'🛫 Domestic', v:'domestic'}, {l:'✈️ Short-haul', v:'short-haul'}, {l:'✈️ Long-haul', v:'long-haul'}, {l:'🚂 Train', v:'train'}, {l:'🚗 Car', v:'car'}];
    }
    if (emConv.cat === 'freight' && emConv.step === 0) {
      return tr
        ? [{l:'🚛 Karayolu', v:'karayolu'}, {l:'🚢 Denizyolu', v:'deniz'}, {l:'✈️ Havayolu', v:'hava'}, {l:'🚂 Demiryolu', v:'demiryolu'}]
        : [{l:'🚛 Road', v:'road'}, {l:'🚢 Sea', v:'sea'}, {l:'✈️ Air', v:'air'}, {l:'🚂 Rail', v:'rail'}];
    }
    return null;
  })();

  // ── Quick-start chips (free mode) ────────────────────────────────────────────
  const CHIPS = tr ? [
    { emoji: '🔥', title: 'Sabit Yanma',  hint: 'Doğalgaz, dizel, LPG…', cat: 'stationary',  scope: 'Kapsam 1', dot: 'bg-orange-400' },
    { emoji: '⚡', title: 'Elektrik',      hint: 'kWh veya MWh tutarı',   cat: 'electricity', scope: 'Kapsam 2', dot: 'bg-yellow-400' },
    { emoji: '✈️', title: 'İş Seyahati', hint: 'Uçuş, tren, araç…',      cat: 'travel',      scope: 'Kapsam 3', dot: 'bg-violet-400' },
    { emoji: '🚛', title: 'Nakliye',       hint: 'Ton × km veya tkm',      cat: 'freight',     scope: 'Kapsam 3', dot: 'bg-sky-400'    },
  ] : [
    { emoji: '🔥', title: 'Combustion',    hint: 'Gas, diesel, LPG…',     cat: 'stationary',  scope: 'Scope 1', dot: 'bg-orange-400' },
    { emoji: '⚡', title: 'Electricity',   hint: 'kWh or MWh',            cat: 'electricity', scope: 'Scope 2', dot: 'bg-yellow-400' },
    { emoji: '✈️', title: 'Business Travel',hint: 'Flights, rail, car…', cat: 'travel',      scope: 'Scope 3', dot: 'bg-violet-400' },
    { emoji: '🚛', title: 'Freight',        hint: 'Tonnes × km',          cat: 'freight',     scope: 'Scope 3', dot: 'bg-sky-400'    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#F1FCF2]">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-2 border-b border-[#072C0E]/8 bg-white">
        {/* Icon */}
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#175022] shrink-0">
          <Sparkles className="h-3 w-3 text-white/80" />
        </div>
        {/* Title + online dot */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p className="text-[12px] font-bold text-[#072C0E]">CarbonIQ</p>
          <span className="h-1.5 w-1.5 rounded-full bg-[#2ABD41] shrink-0 motion-safe:animate-pulse" />
        </div>

        {/* ── Mode toggle ── */}
        <div className="flex items-center rounded-lg border border-[#072C0E]/10 overflow-hidden shrink-0 text-[10px] font-bold">
          <button
            onClick={() => mode === 'guided' ? switchToFreeMode() : null}
            className={`px-2.5 py-1.5 transition-all ${
              mode === 'free'
                ? 'bg-[#175022] text-white cursor-default'
                : 'text-[#072C0E]/40 hover:text-[#072C0E] hover:bg-[#072C0E]/4'
            }`}>
            {tr ? 'Sohbet' : 'Chat'}
          </button>
          <button
            onClick={() => mode === 'free' ? startGuidedMode() : null}
            className={`px-2.5 py-1.5 transition-all ${
              mode === 'guided'
                ? 'bg-[#175022] text-white cursor-default'
                : 'text-[#072C0E]/40 hover:text-[#072C0E] hover:bg-[#072C0E]/4'
            }`}>
            {tr ? 'Anket' : 'Questions'}
          </button>
        </div>

        {/* ── TR / EN toggle ── */}
        <div className="flex items-center rounded-lg border border-[#072C0E]/10 overflow-hidden shrink-0 text-[10px] font-bold">
          <button
            onClick={() => setActiveLang('tr')}
            className={`px-2 py-1.5 transition-all ${
              activeLang === 'tr'
                ? 'bg-[#175022] text-white'
                : 'text-[#072C0E]/40 hover:text-[#072C0E] hover:bg-[#072C0E]/4'
            }`}>
            TR
          </button>
          <button
            onClick={() => setActiveLang('en')}
            className={`px-2 py-1.5 transition-all ${
              activeLang === 'en'
                ? 'bg-[#175022] text-white'
                : 'text-[#072C0E]/40 hover:text-[#072C0E] hover:bg-[#072C0E]/4'
            }`}>
            EN
          </button>
        </div>
      </div>

      {/* ── Guided progress bar ── */}
      {mode === 'guided' && currentQuestion && (
        <div className="shrink-0 px-4 py-2 bg-gradient-to-r from-[#DEFAE1]/60 to-[#F1FCF2] border-b border-[#8BEA99]/20">
          <div className="flex items-center justify-between mb-1.5">
            <div className="min-w-0 flex-1 mr-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#175022]/60">
                {tr
                  ? `Aşama ${currentStageIndex + 1} / ${CARBONIQ_STAGES.length}`
                  : `Stage ${currentStageIndex + 1} of ${CARBONIQ_STAGES.length}`}
                {!currentQuestion.required && (
                  <span className="ml-1.5 normal-case font-semibold text-[#072C0E]/30">
                    · {tr ? 'İsteğe bağlı' : 'Optional'}
                  </span>
                )}
              </p>
              <p className="text-[10.5px] font-bold text-[#175022] truncate">
                {currentStage?.title?.[activeLang] || currentStage?.title?.en || ''}
              </p>
            </div>
            <span className="text-[10px] font-semibold text-[#072C0E]/40 shrink-0 tabular-nums">
              {currentQuestion.number} / {TOTAL_QUESTIONS}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-[#072C0E]/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8BEA99] to-[#2ABD41] transition-all duration-700 ease-out"
              style={{ width: `${(currentQuestion.number / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>
          {/* Stage dots — 7 segments, one per stage */}
          <div className="flex gap-[3px] mt-1.5">
            {CARBONIQ_STAGES.map((stage, i) => (
              <div
                key={stage.id}
                title={stage.title?.[activeLang] || stage.title?.en}
                className={`flex-1 h-[3px] rounded-full transition-all duration-500 ${
                  i < currentStageIndex   ? 'bg-[#2ABD41]' :
                  i === currentStageIndex ? 'bg-[#8BEA99]' : 'bg-[#072C0E]/10'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto ${messages.length === 1 && messages[0]?.id === 'welcome' ? 'flex flex-col justify-center px-4' : 'px-4 py-5 space-y-5'}`}>

        {messages.map(msg => {
          if (msg.id === 'welcome') {
            if (messages.length > 1) return null;
            return (
              <div key={msg.id} className="flex flex-col items-center gap-8 py-8 text-center w-full">
                {/* Sphere / circle element */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-40 w-40 rounded-full bg-[#2ABD41]/15 blur-3xl" />
                  <div className="absolute h-28 w-28 rounded-full bg-[#8BEA99]/20 blur-2xl" />
                  <img
                    src="/chatbot.png"
                    alt="CarbonIQ"
                    className="relative h-32 w-32 object-contain drop-shadow-xl"
                    draggable={false}
                  />
                </div>

                {/* Greeting */}
                <div className="flex flex-col gap-1">
                  <p className="text-[13px] text-[#072C0E]/40 font-medium">
                    {tr ? 'Merhaba,' : 'Hi, there'}
                  </p>
                  <p className="text-[20px] font-black text-[#072C0E] tracking-tight leading-snug">
                    {tr ? 'Nasıl yardımcı olabilirim?' : 'How can I assist?'}
                  </p>
                </div>

                {/* Category chips — horizontal scroll */}
                <div className="flex gap-2 overflow-x-auto w-full pb-1 px-0.5 scrollbar-none">
                  {CHIPS.map((chip, i) => (
                    <button key={i} onClick={() => handleChipClick(chip)}
                      className="flex-shrink-0 flex flex-col items-start gap-1.5 rounded-2xl border border-[#072C0E]/8 bg-white px-4 py-3.5 text-left transition hover:border-[#8BEA99]/60 hover:bg-[#DEFAE1] active:scale-[0.97] min-w-[130px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#072C0E]/30">{chip.scope}</span>
                      </div>
                      <p className="text-[12.5px] font-bold text-[#072C0E]">{chip.emoji} {chip.title}</p>
                      <p className="text-[10px] text-[#072C0E]/35 leading-tight">{chip.hint}</p>
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-[#072C0E]/25">{tr ? 'veya aşağıya yazın' : 'or type anything below'}</p>
              </div>
            );
          }
          if (msg.role === 'mode-switch') {
            return (
              <div key={msg.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-[#8BEA99]/25" />
                <span className="text-[9.5px] font-bold text-[#175022]/60 shrink-0 px-1">{msg.label}</span>
                <div className="flex-1 h-px bg-[#8BEA99]/25" />
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
            const emKg = msg.suggestion?.emKg;
            const emFmt = emKg
              ? (emKg >= 1000
                  ? `${(emKg / 1000).toFixed(2)} tCO₂e`
                  : `${Math.round(emKg).toLocaleString()} kgCO₂e`)
              : null;
            return (
              <div key={msg.id} className="flex items-center gap-3 rounded-2xl border border-[#2ABD41]/25 bg-[#2ABD41]/8 px-4 py-3 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-[#1A7B2A] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#1A7B2A] truncate">{tr ? 'Kaydedildi' : 'Saved'} — {catLabel}</p>
                  <p className="text-[10px] text-[#072C0E]/40 mt-0.5">{tr ? 'Veriler rapora işlendi' : 'Data written to report'}</p>
                </div>
                {emFmt && (
                  <span className="shrink-0 text-[11px] font-bold text-[#1A7B2A] tabular-nums bg-[#2ABD41]/12 rounded-lg px-2 py-1">
                    {emFmt}
                  </span>
                )}
              </div>
            );
          }
          if (msg.role === 'rejected') {
            const rejCatLabel = ({
              '3A': tr ? 'Kapsam 1 — Sabit Yanma'  : 'Scope 1 — Stationary Combustion',
              '4A': tr ? 'Kapsam 2 — Elektrik'      : 'Scope 2 — Electricity',
              'K4': tr ? 'Kapsam 3 — Nakliye'       : 'Scope 3 — Freight',
              'K5': tr ? 'Kapsam 3 — İş Seyahati'  : 'Scope 3 — Business Travel',
            })[msg.suggestion?.category] || msg.suggestion?.category;
            return (
              <div key={msg.id} className="flex items-center gap-2.5 rounded-2xl border border-[#072C0E]/6 bg-[#072C0E]/[0.025] px-4 py-2.5">
                <span className="text-[13px] shrink-0 opacity-40">↩️</span>
                <p className="text-[11.5px] text-[#072C0E]/30 line-through truncate">{rejCatLabel}</p>
                <span className="ml-auto text-[9.5px] font-semibold text-[#072C0E]/25 shrink-0">{tr ? 'Reddedildi' : 'Dismissed'}</span>
              </div>
            );
          }
          if (msg.role === 'hint') {
            return (
              <div key={msg.id} className="flex items-start gap-2.5 rounded-2xl border border-[#8BEA99]/25 bg-[#8BEA99]/6 px-4 py-2.5">
                <Info className="h-3.5 w-3.5 text-[#175022] shrink-0 mt-0.5" />
                <span className="text-[12px] text-[#072C0E]/55 leading-relaxed">{msg.content}</span>
              </div>
            );
          }
          return <ChatBubble key={msg.id} msg={msg} />;
        })}

        {sending && (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#175022]">
              <Sparkles className="h-2.5 w-2.5 text-white/80" />
            </div>
            <div className="pt-0.5">
              <TypingDots />
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')} className="shrink-0 hover:text-red-800 transition" aria-label="Dismiss error">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 border-t border-[#072C0E]/6 bg-white px-4 py-3">

        {/* ── GUIDED MODE: dynamic input based on question type ── */}
        {mode === 'guided' && currentQuestion && (
          <div className="flex flex-col gap-2">
            {/* Validation error */}
            {guidedError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                <span className="flex-1">{guidedError}</span>
                <button onClick={() => setGuidedError('')} className="shrink-0 hover:text-red-800 transition" aria-label={tr ? 'Kapat' : 'Dismiss'}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* INFO → Continue button */}
            {currentQuestion.type === 'info' && (
              <button onClick={handleInfoContinue}
                className="w-full rounded-full bg-[#175022] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-[#175022] active:scale-[0.98] transition">
                {tr ? '→ Devam' : '→ Continue'}
              </button>
            )}

            {/* SINGLE_SELECT / YEAR_SELECT → option pills */}
            {['single_select', 'year_select'].includes(currentQuestion.type) && currentQuestion.options && (
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                {currentQuestion.options.map(opt => (
                  <button key={opt.value}
                    onClick={() => submitGuidedAnswer(opt.value)}
                    className="w-full text-left rounded-xl border border-[#072C0E]/10 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#072C0E] shadow-sm hover:border-[#8BEA99]/60 hover:bg-[#8BEA99]/8 hover:text-[#072C0E] active:scale-[0.98] transition">
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
                            ? 'border-[#8BEA99] bg-[#8BEA99]/15 text-[#072C0E]'
                            : 'border-[#072C0E]/10 bg-white text-[#072C0E]/65 hover:border-[#8BEA99]/40 hover:text-[#072C0E]'
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
                  className="w-full rounded-full bg-[#175022] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-[#175022] disabled:opacity-40 active:scale-[0.98] transition mt-0.5">
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
                    className="flex-1 rounded-xl border border-[#072C0E]/10 bg-[#F1FCF2] px-3 py-2.5 text-[12.5px] font-semibold text-[#072C0E] outline-none focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/15 transition"
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
                    className="flex-1 rounded-xl border border-[#072C0E]/10 bg-[#F1FCF2] px-3 py-2.5 text-[12.5px] font-semibold text-[#072C0E] outline-none placeholder:text-[#072C0E]/30 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/15 transition"
                    placeholder={tr ? 'Şehir' : 'City'}
                    value={countryCityVal.city}
                    onChange={e => { setCountryCityVal(v => ({ ...v, city: e.target.value })); setGuidedError(''); }}
                  />
                </div>
                <button
                  onClick={() => submitGuidedAnswer(countryCityVal)}
                  disabled={!countryCityVal.country || !countryCityVal.city}
                  className="w-full rounded-full bg-[#175022] text-white py-2.5 text-[13px] font-bold shadow-sm hover:bg-[#175022] disabled:opacity-40 active:scale-[0.98] transition">
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
                  className="flex-1 resize-none rounded-2xl border border-[#072C0E]/10 bg-[#F1FCF2] px-4 py-2.5 text-sm text-[#072C0E] outline-none placeholder:text-[#072C0E]/28 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/15 min-h-[44px] max-h-[130px] transition-colors leading-relaxed"
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#175022] text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Footer: ISO ref + skip button */}
            <div className="flex items-center justify-between gap-2 pl-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <FileText className="h-3 w-3 text-[#175022]/40 shrink-0" />
                <p className="text-[9.5px] text-[#072C0E]/28 truncate">
                  {currentQuestion.isoRef} — {tr ? `Soru ${currentQuestion.number}/${TOTAL_QUESTIONS}` : `Question ${currentQuestion.number}/${TOTAL_QUESTIONS}`}
                  {currentQuestion.required ? (tr ? ' · Zorunlu' : ' · Required') : (tr ? ' · İsteğe bağlı' : ' · Optional')}
                </p>
              </div>
              {!currentQuestion.required && currentQuestion.type !== 'info' && (
                <button
                  onClick={handleSkip}
                  className="shrink-0 text-[9.5px] font-semibold text-[#072C0E]/30 hover:text-[#072C0E]/55 transition flex items-center gap-0.5 whitespace-nowrap"
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
            {/* Inline quick reply chips */}
            {quickReplies && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {quickReplies.map((qr, i) => (
                  <button key={i} onClick={() => handleQuickReply(qr.v)}
                    className="rounded-xl border border-[#072C0E]/10 bg-[#DEFAE1] px-3 py-1.5 text-[11px] font-semibold text-[#072C0E] transition hover:border-[#8BEA99]/70 hover:bg-[#DEFAE1] active:scale-[0.97]">
                    {qr.l}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 resize-none rounded-2xl border border-[#072C0E]/10 bg-[#F1FCF2] px-4 py-2.5 text-sm text-[#072C0E] outline-none placeholder:text-[#072C0E]/28 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/15 min-h-[44px] max-h-[130px] transition-colors leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={tr
                  ? 'Örn: 12.000 kWh elektrik kullandık…'
                  : 'e.g. We used 12,000 kWh electricity…'}
                value={input}
                rows={1}
                disabled={sending}
                onChange={e => { setInput(e.target.value); if (error) setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                maxLength={4000}
              />
              <button onClick={send} disabled={!input.trim() || sending}
                aria-label={tr ? 'Gönder' : 'Send'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#175022] text-white shadow-sm transition hover:bg-[#175022] disabled:opacity-35 disabled:cursor-not-allowed active:scale-95">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 pl-1">
              <TrendingUp className="h-3 w-3 text-[#175022]/50" />
              <p className="text-[9.5px] text-[#072C0E]/30">
                {tr
                  ? 'Verileriniz güvende — onaylamadan hiçbir şey kaydedilmez'
                  : 'Your data is safe — nothing saves without your approval'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
