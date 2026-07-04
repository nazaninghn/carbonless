import Card from "@/components/Card";
import { forecastBars, forecastRows } from "@/lib/mock-data";

export default function ForecastPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">7-Day Energy Forecast</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Predicted solar production vs factory consumption for the coming week</p>
      </div>

      <Card className="p-[22px_24px] mb-4">
        <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
          <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Production vs Consumption</h3>
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
              <span className="w-3 h-3 rounded-[3px] bg-[#22C55E]" />
              Solar
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
              <span className="w-3 h-3 rounded-[3px] bg-[#2563EB]" />
              Consumption
            </span>
          </div>
        </div>
        <div className="flex items-end gap-5 h-[210px] pt-4 px-1.5">
          {forecastBars.map((f) => (
            <div key={f.label} className="flex-1 flex flex-col items-center gap-[9px] h-full">
              <div className="flex-1 w-full flex items-end justify-center gap-1.5">
                <div className="w-[42%] rounded-t-[6px]" style={{ background: "linear-gradient(#4ade80,#16a34a)", minHeight: "4px", height: f.solarPct }} />
                <div className="w-[42%] rounded-t-[6px]" style={{ background: "linear-gradient(#60a5fa,#2563EB)", minHeight: "4px", height: f.consPct }} />
              </div>
              <span className="text-xs font-bold text-[#475569]">{f.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div
            className="grid gap-3 py-3.5 px-5 sm:px-[22px] bg-[#F8FAFC] border-b border-[#EEF2F6]"
            style={{ gridTemplateColumns: ".8fr 1.2fr 1.1fr 1.1fr 1.1fr 1.3fr" }}
          >
            {["Day", "Weather", "Solar", "Consumption", "Surplus / Deficit", "System suggestion"].map((h) => (
              <div key={h} className="text-[11.5px] font-bold text-[#94A3B8] uppercase tracking-[0.4px]">
                {h}
              </div>
            ))}
          </div>
          {forecastRows.map((row) => (
            <div
              key={row.day}
              className="grid gap-3 py-[15px] px-5 sm:px-[22px] border-b border-[#F1F5F9] last:border-b-0 items-center"
              style={{ gridTemplateColumns: ".8fr 1.2fr 1.1fr 1.1fr 1.1fr 1.3fr" }}
            >
              <div className="font-bold text-[13.5px] text-[#0F172A]">{row.day}</div>
              <div className="text-[13px] text-[#475569]">{row.cond}</div>
              <div className="text-[13px] text-[#0F172A] font-semibold">{row.solar}</div>
              <div className="text-[13px] text-[#0F172A] font-semibold">{row.cons}</div>
              <div className="font-bold text-[13px]" style={{ color: row.positive ? "#15803d" : "#b91c1c" }}>
                {row.surplus}
              </div>
              <div>
                <span
                  className="inline-flex items-center text-[11.5px] font-bold px-[11px] py-1 rounded-full"
                  style={{ color: row.sugColor, background: row.sugColor + "1a" }}
                >
                  {row.sug}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
