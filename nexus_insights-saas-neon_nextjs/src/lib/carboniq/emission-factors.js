/**
 * Single source of truth for client-side emission-factor math.
 *
 * These factors only power *previews* (chat estimates, the dashboard's
 * pre-backend preview banner). The authoritative CO2e numbers always come
 * from the backend once an entry/report is saved — see
 * `carbonless_backend/emissions/seed_data.py` for the real `EmissionFactor`
 * rows. Before this module existed, the chat workspace, the AI status
 * report, and the dashboard preview each kept their own copy of this table
 * — with different units, coverage, AND numbers that didn't match the
 * backend's actual seeded factors — so the same answer could show three
 * different totals in three different places.
 *
 * Every value below is pulled from the backend's 'turkey' country variant
 * where one exists (falling back to 'global'), so a preview should land
 * close to what the backend will compute once the entry is actually saved.
 * Where the backend has no row for a unit at all, the factor is derived
 * from a unit it does have (density / calorific-value conversion) — those
 * lines are marked "derived" below; treat them as rough estimates only.
 *
 * All unit keys are lowercase; look factors up via getEmissionFactor() (or
 * normalizeUnit() for a raw key) rather than indexing the table directly, so
 * a unit like 'GJ', 'Gj', or 'gj' always resolves to the same factor.
 */

export const EMISSION_FACTORS = {
  // Scope 1 — stationary combustion
  natural_gas: {
    'm³': 2.02, m3: 2.02,             // backend: natural-gas-m3
    kwh: 0.18316,                     // backend: natural-gas-kwh
    gj: 56.211,                       // backend: natural-gas (turkey)
    mcf: 57.2,                        // derived: 2.02 kg/m³ × 28.3168 m³/MCF — no backend row
  },
  diesel: {
    litre: 2.68, liter: 2.68, l: 2.68, // backend: diesel (turkey)
    kwh: 0.24882,                      // backend: diesel-kwh
    gj: 74.1,                          // backend: gas-diesel-oil-energy
    kg: 3.22, ton: 3220, tonne: 3220,  // derived: ÷ 0.832 kg/l density — no backend row
  },
  lpg: {
    litre: 1.51468, liter: 1.51468,    // backend: lpg (turkey)
    kg: 2.97, ton: 2970, tonne: 2970,  // derived: ÷ 0.51 kg/l LPG density — no backend row
  },
  fuel_oil: {
    litre: 3.18,                       // backend: fuel-oil (turkey)
    kg: 3.31, ton: 3310, tonne: 3310,  // derived: ÷ 0.96 kg/l density — no backend row
  },
  coal: {
    kg: 2.42, ton: 2420, tonne: 2420,  // backend: coal (global)
  },
  biomass: {
    // backend: wood-pellets (DEFRA 2024). Deliberately much lower than fossil
    // fuels — DEFRA treats combustion CO2 from biomass as biogenic/carbon-neutral
    // and excludes it, counting only the non-CO2 combustion gases.
    kg: 0.01553, ton: 15.53, tonne: 15.53,
  },
  // Scope 2 — purchased electricity
  electricity: { kwh: 0.4199, mwh: 419.9 }, // backend: turkey-grid

  // Scope 3 Cat 5 — business travel
  flight_domestic:   { pkm: 0.232, km: 0.232 },   // backend: flight-domestic (turkey)
  flight_short_haul: { pkm: 0.255, km: 0.255 },   // backend: flight-short (global, <500km)
  flight_long_haul:  { pkm: 0.150, km: 0.150 },   // backend: flight-long (global, >3700km)
  rail_travel:       { pkm: 0.035, km: 0.035 },   // backend: train (turkey)
  car_rental:        { km: 0.1698, vkm: 0.1698 }, // backend: road-travel (turkey, business travel)

  // Scope 3 Cat 4 — upstream transport
  road_hgv:     { tkm: 0.823134 },   // backend: truck-freight (turkey)
  road_lgv:     { tkm: 0.823134 },   // backend has no separate LGV row — same as HGV (turkey)
  sea_bulk:     { tkm: 0.01611857 }, // backend: sea-freight (turkey)
  rail_freight: { tkm: 0.022 },      // backend: rail-freight (global — no turkey row)
  air_freight:  { tkm: 0.602 },      // backend: air-freight (global — no turkey row)
};

export const EF_SOURCE = {
  natural_gas: 'DEFRA 2024', diesel: 'IPCC 2006', lpg: 'DEFRA 2024',
  fuel_oil: 'IPCC 2006', coal: 'IPCC 2006', biomass: 'DEFRA 2024',
  electricity: 'ATOM KABLO ISO 14064-1 2023',
  flight_domestic: 'Turkish Airlines 2025', flight_short_haul: 'GHG Protocol',
  flight_long_haul: 'GHG Protocol', rail_travel: 'TCDD',
  car_rental: 'ATOM KABLO ISO 14064-1 2023',
  road_hgv: 'ATOM KABLO ISO 14064-1 2023', road_lgv: 'ATOM KABLO ISO 14064-1 2023',
  sea_bulk: 'ATOM KABLO ISO 14064-1 2023',
  rail_freight: 'GHG Protocol', air_freight: 'GHG Protocol',
};

export const EF_ELECTRICITY = EMISSION_FACTORS.electricity.kwh;

/** Canonicalizes any unit spelling/case ('GJ', 'Gj', 'KWH', 'm^3'...) to a lowercase lookup key. */
export function normalizeUnit(unit) {
  if (!unit) return '';
  return String(unit).trim().toLowerCase().replace(/^m\^3$/, 'm³');
}

/** Looks up the factor for a fuel/mode + unit, falling back to the first known unit for that type. */
export function getEmissionFactor(type, unit) {
  const table = EMISSION_FACTORS[type];
  if (!table) return 0;
  const key = normalizeUnit(unit);
  if (table[key] != null) return table[key];
  const firstKey = Object.keys(table)[0];
  return table[firstKey] ?? 0;
}

export function calcScope1Kg(fields) {
  const fuel = fields['rf.3a.fuel_type'];
  const amt = parseFloat(fields['rf.3a.consumption']);
  if (!fuel || isNaN(amt) || amt <= 0) return 0;
  return Math.round(amt * getEmissionFactor(fuel, fields['rf.3a.unit']));
}

export function calcScope2Kg(fields) {
  const kwh = parseFloat(fields['rf.4a.consumption_kwh']);
  if (isNaN(kwh) || kwh <= 0) return 0;
  const ef = parseFloat(fields['rf.4a.emission_factor']) || EF_ELECTRICITY;
  const renewable = parseFloat(fields['rf.4a.renewable_on_site']) || 0;
  return Math.round(Math.max(kwh - renewable, 0) * ef);
}

export function calcK4Kg(fields) {
  return parseFloat(fields['rf.k4.total_emission_kgco2e']) || 0;
}

// Business travel (K5) distance fields, used to derive a total when the
// rolled-up 'rf.k5.total_emission_kgco2e' field hasn't been computed yet.
const K5_DISTANCE_FIELDS = [
  ['rf.k5.air_domestic_pkm', 'flight_domestic'],
  ['rf.k5.air_short_haul_pkm', 'flight_short_haul'],
  ['rf.k5.air_long_haul_pkm', 'flight_long_haul'],
  ['rf.k5.rail_pkm', 'rail_travel'],
  ['rf.k5.car_km', 'car_rental'],
];

export function calcK5Kg(fields) {
  const total = parseFloat(fields['rf.k5.total_emission_kgco2e']);
  if (!isNaN(total) && total > 0) return total;
  let sum = 0;
  for (const [field, type] of K5_DISTANCE_FIELDS) {
    const v = parseFloat(fields[field]);
    if (!isNaN(v) && v > 0) sum += v * getEmissionFactor(type, 'pkm');
  }
  return sum;
}

export function calcScope3Kg(fields) {
  return calcK4Kg(fields) + calcK5Kg(fields);
}

/** Builds the same shape as a backend summary, from raw chatbot field values. */
export function computeLocalSummaryFromFields(fields) {
  const s1Kg = calcScope1Kg(fields);
  const s2Kg = calcScope2Kg(fields);
  const s3Kg = calcScope3Kg(fields);
  const totalKg = s1Kg + s2Kg + s3Kg;
  if (totalKg <= 0) return null;
  return {
    total_tonne:  totalKg / 1000,
    scope1_tonne: s1Kg / 1000,
    scope2_tonne: s2Kg / 1000,
    scope3_tonne: s3Kg / 1000,
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total_kg: 0 })),
    _isLocalPreview: true,
  };
}
