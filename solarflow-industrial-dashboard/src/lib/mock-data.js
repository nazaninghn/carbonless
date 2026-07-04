import { linePath, areaPath, sx } from "./chart";

const W = 1000;
const H = 300;
const P = 40;

// ---- Today's hourly series (13 points, every 2h, 00:00 -> 24:00) ----
export const solar = [0, 0, 0, 60, 340, 720, 980, 1050, 860, 430, 90, 0, 0];
export const cons = [520, 480, 470, 560, 720, 880, 1020, 1080, 1140, 980, 820, 690, 600];
export const batt24 = [40, 38, 36, 35, 45, 60, 74, 80, 78, 66, 54, 48, 44];
export const price24 = [1200, 1100, 1000, 1050, 1500, 2200, 2800, 3100, 3400, 4200, 3800, 2600, 1800];

export const hourLabels = ["00", "04", "08", "12", "16", "20", "24"];

export const dashboardChart = {
  solarArea: areaPath(solar, 0, 1200, W, H, P),
  solarLine: linePath(solar, 0, 1200, W, H, P),
  consLine: linePath(cons, 0, 1200, W, H, P),
  battLine: linePath(batt24, 0, 100, W, H, P),
  priceLine: linePath(price24, 800, 4400, W, H, P),
};

export const weather = [
  { day: "Today", cond: "Sunny", cloud: "8%", temp: "34°C", irr: "6.8 kWh/m²", kind: "sun" },
  { day: "Tomorrow", cond: "Partly cloudy", cloud: "45%", temp: "31°C", irr: "4.9 kWh/m²", kind: "partly" },
  { day: "Sun, Jul 6", cond: "Cloudy", cloud: "80%", temp: "28°C", irr: "3.1 kWh/m²", kind: "cloudy" },
];

// ===== ENERGY FORECAST =====
export const forecastLabels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const fSolar = [4200, 3200, 2200, 4400, 4600, 3000, 4100];
const fCons = [3900, 4100, 4000, 3800, 3900, 4000, 4200];
const fMax = 4800;

export const forecastBars = forecastLabels.map((label, i) => ({
  label,
  solarPct: ((fSolar[i] / fMax) * 100).toFixed(1) + "%",
  consPct: ((fCons[i] / fMax) * 100).toFixed(1) + "%",
}));

const conds = ["Sunny", "Partly cloudy", "Cloudy", "Sunny", "Sunny", "Partly cloudy", "Sunny"];
const sugs = ["Sell surplus", "Charge battery", "Reduce peak load", "Sell surplus", "Sell surplus", "Charge battery", "Balanced"];
const sugColors = ["#22C55E", "#F59E0B", "#EF4444", "#22C55E", "#22C55E", "#F59E0B", "#64748B"];

export const forecastRows = forecastLabels.map((label, i) => {
  const s = fSolar[i] - fCons[i];
  const positive = s >= 0;
  return {
    day: label,
    cond: conds[i],
    solar: fSolar[i].toLocaleString() + " kWh",
    cons: fCons[i].toLocaleString() + " kWh",
    surplus: (positive ? "+" : "−") + Math.abs(s).toLocaleString() + " kWh",
    positive,
    sug: sugs[i],
    sugColor: sugColors[i],
  };
});

// ===== BATTERY =====
const bPlanned = [46, 44, 42, 40, 48, 64, 80, 86, 84, 70, 56, 50, 48];
export const battery = {
  line: linePath(batt24, 0, 100, W, 260, 36),
  plan: linePath(bPlanned, 0, 100, W, 260, 36),
};

// ===== PRICES =====
export const prices = {
  line: linePath(price24, 800, 4600, W, 240, 40),
  area: areaPath(price24, 800, 4600, W, 240, 40),
};

const bandDefs = [
  [0, 2.5, "rgba(34,197,94,.12)"],
  [2.5, 8, "rgba(245,158,11,.10)"],
  [8, 10.5, "rgba(239,68,68,.14)"],
  [10.5, 12, "rgba(245,158,11,.10)"],
];
export const priceBands = bandDefs.map(([a, b, fill]) => {
  const x = sx(a, 13, W, 40);
  return { x, w: sx(b, 13, W, 40) - x, fill };
});

// ===== SMART RECOMMENDATIONS =====
export const recoList = [
  {
    title: "Charge battery before cloudy day",
    type: "Storage",
    color: "#2563EB",
    desc: "Solar production is forecast to drop 35% tomorrow. Charge the battery to 85% tonight while grid prices are low.",
    saving: "15,800,000",
    conf: 84,
  },
  {
    title: "Sell surplus at the evening peak",
    type: "Sell energy",
    color: "#22C55E",
    desc: "Grid sell price peaks between 6–9 PM. Export roughly 600 kWh of surplus solar during this window.",
    saving: "11,200,000",
    conf: 88,
  },
  {
    title: "Shift Line 2 load to midday",
    type: "Load shift",
    color: "#F59E0B",
    desc: "Move Production Line 2 into the 11 AM–3 PM window to run on peak solar instead of grid power.",
    saving: "8,600,000",
    conf: 79,
  },
  {
    title: "Avoid grid purchase 4–8 PM",
    type: "Buy avoidance",
    color: "#64748B",
    desc: "Grid prices are high from 4–8 PM. Discharge the battery to cover load instead of buying from the grid.",
    saving: "9,400,000",
    conf: 82,
  },
];

// ===== FINANCIAL =====
const mLabels = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const mCost = [148, 162, 155, 140, 132, 121];
const mSave = [92, 101, 110, 118, 120, 125];
const mMax = 175;
export const finBars = mLabels.map((label, i) => ({
  label,
  costPct: ((mCost[i] / mMax) * 100).toFixed(1) + "%",
  savePct: ((mSave[i] / mMax) * 100).toFixed(1) + "%",
}));

// ===== CONSUMPTION =====
export const consLines = [
  { name: "Production Line 1", kwh: "1,350 kWh", pct: "31%", w: "31%", color: "#2563EB" },
  { name: "Production Line 2", kwh: "1,180 kWh", pct: "27%", w: "27%", color: "#22C55E" },
  { name: "Production Line 3", kwh: "920 kWh", pct: "21%", w: "21%", color: "#F59E0B" },
  { name: "Production Line 4", kwh: "640 kWh", pct: "14%", w: "14%", color: "#8B5CF6" },
  { name: "Auxiliary & HVAC", kwh: "310 kWh", pct: "7%", w: "7%", color: "#64748B" },
];

export const consAreaChart = {
  area: areaPath(cons, 0, 1200, W, 240, 40),
  line: linePath(cons, 0, 1200, W, 240, 40),
};

export const prodAreaChart = {
  area: areaPath(solar, 0, 1200, W, 240, 40),
  line: linePath(solar, 0, 1200, W, 240, 40),
};

export const inverters = [
  { name: "Inverter A1", kw: "412 kW", ok: true },
  { name: "Inverter A2", kw: "398 kW", ok: true },
  { name: "Inverter B1", kw: "405 kW", ok: true },
  { name: "Inverter B2", kw: "221 kW", ok: false },
  { name: "Inverter C1", kw: "388 kW", ok: true },
  { name: "Inverter C2", kw: "401 kW", ok: true },
];
