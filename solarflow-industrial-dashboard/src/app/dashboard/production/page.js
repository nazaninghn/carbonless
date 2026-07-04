import Card from "@/components/Card";
import ChartAxis from "@/components/ChartAxis";
import { prodAreaChart, inverters } from "@/lib/mock-data";

export default function ProductionPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Solar Production</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Output from the plant&apos;s 2.4 MWp rooftop &amp; ground array</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Produced today</div>
          <div className="font-display text-2xl font-bold text-[#0F172A]">
            3,850<span className="text-[13px] text-[#94A3B8] font-sans"> kWh</span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">This month</div>
          <div className="font-display text-2xl font-bold text-[#0F172A]">
            92,400<span className="text-[13px] text-[#94A3B8] font-sans"> kWh</span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2">Capacity factor</div>
          <div className="font-display text-2xl font-bold text-[#15803d]">21.4%</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="p-5 sm:p-[20px_22px]">
          <h3 className="m-0 mb-1.5 text-[15px] font-extrabold text-[#0F172A]">Production · Last 24h</h3>
          <svg viewBox="0 0 1000 240" className="w-full h-[220px] block" preserveAspectRatio="none">
            <defs>
              <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#22C55E" stopOpacity="0.28" />
                <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="40" y1="63" x2="960" y2="63" stroke="#F1F5F9" />
            <line x1="40" y1="131" x2="960" y2="131" stroke="#F1F5F9" />
            <line x1="40" y1="200" x2="960" y2="200" stroke="#E2E8F0" />
            <path d={prodAreaChart.area} fill="url(#prodFill)" />
            <path d={prodAreaChart.line} fill="none" stroke="#16a34a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ChartAxis />
        </Card>

        <Card className="p-5 sm:p-[20px_22px]">
          <h3 className="m-0 mb-3.5 text-[15px] font-extrabold text-[#0F172A]">Inverter status</h3>
          {inverters.map((v) => (
            <div key={v.name} className="flex items-center gap-[11px] py-[11px] border-b border-[#F1F5F9] last:border-b-0">
              <span className="w-2 h-2 rounded-full" style={{ background: v.ok ? "#22C55E" : "#F59E0B" }} />
              <div className="flex-1 text-[13px] font-semibold text-[#334155]">{v.name}</div>
              <div className="text-[12.5px] text-[#64748B] font-display">{v.kw}</div>
              <div className="text-[11px] font-bold" style={{ color: v.ok ? "#16794a" : "#b45309" }}>
                {v.ok ? "Normal" : "Derated"}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
