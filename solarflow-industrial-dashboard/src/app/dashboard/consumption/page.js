import Card from "@/components/Card";
import ChartAxis from "@/components/ChartAxis";
import { consAreaChart, consLines } from "@/lib/mock-data";

export default function ConsumptionPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Factory Consumption</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Where the plant&apos;s energy is going today</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="p-5 sm:p-[20px_22px]">
          <div className="flex justify-between items-center mb-1.5">
            <div>
              <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Consumption · Last 24h</h3>
              <p className="m-0 mt-[3px] text-xs text-[#94A3B8]">Total today: 4,400 kWh · peak 1,140 kWh at 16:00</p>
            </div>
          </div>
          <svg viewBox="0 0 1000 240" className="w-full h-[220px] block" preserveAspectRatio="none">
            <defs>
              <linearGradient id="consFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2563EB" stopOpacity="0.2" />
                <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="40" y1="63" x2="960" y2="63" stroke="#F1F5F9" />
            <line x1="40" y1="131" x2="960" y2="131" stroke="#F1F5F9" />
            <line x1="40" y1="200" x2="960" y2="200" stroke="#E2E8F0" />
            <path d={consAreaChart.area} fill="url(#consFill)" />
            <path d={consAreaChart.line} fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ChartAxis />
        </Card>

        <Card className="p-5 sm:p-[20px_22px]">
          <h3 className="m-0 mb-4 text-[15px] font-extrabold text-[#0F172A]">Breakdown by line</h3>
          {consLines.map((c) => (
            <div key={c.name} className="mb-[15px]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-semibold text-[#334155]">{c.name}</span>
                <span className="text-[12.5px] text-[#64748B]">
                  {c.kwh} · {c.pct}
                </span>
              </div>
              <div className="h-2 rounded-[5px] bg-[#F1F5F9] overflow-hidden">
                <div className="h-full rounded-[5px]" style={{ width: c.w, background: c.color }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
