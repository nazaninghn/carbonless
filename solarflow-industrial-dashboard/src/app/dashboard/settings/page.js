"use client";

import { useState } from "react";

const ALL_LINES = ["Production Line 1", "Production Line 2", "Production Line 3", "Production Line 4"];

export default function SettingsPage() {
  const [sellSurplus, setSellSurplus] = useState(true);
  const [shiftable, setShiftable] = useState(["Production Line 2", "Production Line 4"]);
  const [saved, setSaved] = useState(false);

  const toggleLine = (line) => {
    setShiftable((prev) => (prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]));
  };

  return (
    <div className="animate-fade-up max-w-[820px]">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Factory Settings</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">System configuration for Aria Steel Plant</p>
      </div>

      <div className="bg-white border border-[#EEF2F6] rounded-2xl p-6 sm:p-[26px] shadow-[0_1px_3px_rgba(15,23,42,.04)]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-[18px]">
          <Field label="Factory name" defaultValue="Aria Steel Plant" />
          <Field label="Location" defaultValue="Isfahan, Iran · 32.65°N, 51.67°E" />
          <Field label="Solar array capacity" defaultValue="2.4 MWp" />
          <Field label="Battery capacity" defaultValue="5,000 kWh" />
          <div>
            <label className="block text-[12.5px] font-bold text-[#334155] mb-[7px]">Electricity tariff</label>
            <select className="w-full h-11 px-3.5 border border-[#E2E8F0] rounded-[10px] text-[13.5px] bg-[#F8FAFC] outline-none cursor-pointer focus:border-[#2563EB] focus:bg-white transition-colors">
              <option>Industrial three-tier (peak / mid / off-peak)</option>
              <option>Flat industrial rate</option>
              <option>Time-of-use</option>
            </select>
          </div>
          <Field label="Working hours" defaultValue="06:00 – 22:00" />
        </div>

        <div className="flex justify-between items-center py-[18px] mt-1.5 border-t border-[#F1F5F9]">
          <div>
            <div className="text-[13.5px] font-bold text-[#0F172A]">Sell surplus energy to the grid</div>
            <div className="text-[12.5px] text-[#94A3B8] mt-0.5">Automatically export surplus solar during high feed-in tariff windows</div>
          </div>
          <button
            type="button"
            onClick={() => setSellSurplus((v) => !v)}
            className="w-[46px] h-[26px] rounded-full relative shrink-0 cursor-pointer transition-colors"
            style={{ background: sellSurplus ? "#22C55E" : "#CBD5E1" }}
            aria-pressed={sellSurplus}
          >
            <span
              className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-all"
              style={{ left: sellSurplus ? "23px" : "3px" }}
            />
          </button>
        </div>

        <div className="py-[18px] border-t border-[#F1F5F9]">
          <div className="text-[13.5px] font-bold text-[#0F172A] mb-2.5">Shiftable production lines</div>
          <div className="flex gap-2.5 flex-wrap">
            {ALL_LINES.map((line) => {
              const active = shiftable.includes(line);
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => toggleLine(line)}
                  className="text-[12.5px] font-bold px-3.5 py-[7px] rounded-full cursor-pointer transition-colors"
                  style={active ? { background: "#EFF4FF", color: "#2563EB" } : { background: "#F1F5F9", color: "#94A3B8" }}
                >
                  {line} {active ? "✓" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2.5 mt-2.5">
          <button
            type="button"
            className="h-11 px-5 border border-[#E2E8F0] rounded-[11px] bg-white text-[#475569] text-[13.5px] font-bold cursor-pointer hover:bg-[#F8FAFC] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="h-11 px-6 border-none rounded-[11px] bg-[#2563EB] text-white text-[13.5px] font-bold cursor-pointer shadow-[0_8px_18px_-8px_rgba(37,99,235,.7)] hover:bg-[#1d4ed8] transition-colors"
          >
            {saved ? "Saved ✓" : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }) {
  return (
    <div>
      <label className="block text-[12.5px] font-bold text-[#334155] mb-[7px]">{label}</label>
      <input
        defaultValue={defaultValue}
        className="w-full h-11 px-3.5 border border-[#E2E8F0] rounded-[10px] text-[13.5px] bg-[#F8FAFC] outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
      />
    </div>
  );
}
