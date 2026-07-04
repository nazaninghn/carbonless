import Card from "@/components/Card";
import ChartAxis from "@/components/ChartAxis";
import { IconWarning } from "@/components/icons";
import { battery } from "@/lib/mock-data";

export default function BatteryPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Battery &amp; Storage</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Live state of charge, health and recommended charge plan</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[.9fr_1.6fr] gap-4 mb-4">
        <div
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-white"
          style={{ background: "linear-gradient(160deg,#0F172A,#16233f)" }}
        >
          <svg viewBox="0 0 140 140" className="w-[170px] h-[170px]">
            <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="14" />
            <circle
              cx="70"
              cy="70"
              r="56"
              fill="none"
              stroke="#22C55E"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="253 352"
              transform="rotate(-90 70 70)"
            />
            <text x="70" y="66" textAnchor="middle" fontFamily="var(--font-space-grotesk)" fontSize="34" fontWeight="700" fill="#fff">
              72%
            </text>
            <text x="70" y="88" textAnchor="middle" fontSize="11" fill="#94A3B8" fontWeight="600">
              Charged
            </text>
          </svg>
          <div className="mt-3.5 text-center">
            <div className="text-[13px] text-[#94A3B8]">3,600 / 5,000 kWh available</div>
            <div className="inline-flex items-center gap-1.5 mt-2.5 px-3.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,.18)" }}>
              <span className="w-[7px] h-[7px] rounded-full bg-[#4ade80]" />
              <span className="text-xs font-bold text-[#4ade80]">Discharging · 220 kW</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Total capacity</div>
            <div className="font-display text-[26px] font-bold text-[#0F172A]">
              5,000<span className="text-[13px] text-[#94A3B8] font-sans"> kWh</span>
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Usable capacity</div>
            <div className="font-display text-[26px] font-bold text-[#0F172A]">
              3,600<span className="text-[13px] text-[#94A3B8] font-sans"> kWh</span>
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Battery health</div>
            <div className="font-display text-[26px] font-bold text-[#15803d]">91%</div>
            <div className="h-1.5 rounded bg-[#EEF2F6] mt-2.5 overflow-hidden">
              <div className="w-[91%] h-full bg-[#22C55E] rounded" />
            </div>
          </Card>
          <Card className="p-5">
            <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Charge cycles</div>
            <div className="font-display text-[26px] font-bold text-[#0F172A]">1,240</div>
            <div className="text-[11.5px] text-[#94A3B8] mt-[5px]">of ~6,000 rated</div>
          </Card>
        </div>
      </div>

      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 sm:p-[16px_20px] flex items-center gap-3.5 mb-4">
        <span className="w-9 h-9 rounded-[10px] bg-[#F59E0B] flex items-center justify-center shrink-0">
          <IconWarning />
        </span>
        <div className="text-[13.5px] text-[#92400E] leading-relaxed">
          <strong>Grid prices peak tomorrow 4 PM–8 PM.</strong> We recommend discharging the battery during this window instead of buying
          from the grid — hold charge above 80% until then.
        </div>
      </div>

      <Card className="p-5 sm:p-[20px_22px]">
        <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
          <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">State of Charge</h3>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
              <span className="w-3.5 h-[3px] rounded-[3px] bg-[#2563EB]" />
              Last 24h
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
              <span className="w-3.5 h-[3px] rounded-[3px] bg-[#22C55E]" />
              Suggested tomorrow
            </span>
          </div>
        </div>
        <svg viewBox="0 0 1000 260" className="w-full h-[230px] block" preserveAspectRatio="none">
          <line x1="36" y1="61" x2="964" y2="61" stroke="#F1F5F9" />
          <line x1="36" y1="122" x2="964" y2="122" stroke="#F1F5F9" />
          <line x1="36" y1="183" x2="964" y2="183" stroke="#F1F5F9" />
          <line x1="36" y1="224" x2="964" y2="224" stroke="#E2E8F0" />
          <path d={battery.plan} fill="none" stroke="#22C55E" strokeWidth="2.4" strokeDasharray="6 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={battery.line} fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <ChartAxis />
      </Card>
    </div>
  );
}
