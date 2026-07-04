import Card from "@/components/Card";
import { IconDownload, IconSummary } from "@/components/icons";
import { finBars } from "@/lib/mock-data";

export default function FinancialPage() {
  return (
    <div className="animate-fade-up">
      <div className="flex justify-between items-start mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Financial Reports</h1>
          <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Solar savings, grid costs and surplus energy revenue</p>
        </div>
        <button
          type="button"
          className="h-[42px] px-[18px] border-none rounded-[11px] bg-[#0F172A] text-white text-[13px] font-bold cursor-pointer flex items-center gap-2 hover:bg-[#1e293b] transition-colors"
        >
          <IconDownload />
          Download PDF report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="rounded-2xl p-5 border border-[#D1FADF]" style={{ background: "linear-gradient(135deg,#ECFDF3,#fff)" }}>
          <div className="text-[12.5px] text-[#16794a] font-bold mb-2.5">Savings this month</div>
          <div className="font-display text-[22px] font-bold text-[#15803d]">125,000,000</div>
          <div className="text-[11.5px] text-[#16794a] font-semibold mt-[5px]">▲ 4% vs last month</div>
        </div>
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2.5">Surplus sale revenue</div>
          <div className="font-display text-[22px] font-bold text-[#0F172A]">42,300,000</div>
          <div className="text-[11.5px] text-[#16794a] font-semibold mt-[5px]">▲ 11% vs last month</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2.5">Grid purchase cost</div>
          <div className="font-display text-[22px] font-bold text-[#0F172A]">121,000,000</div>
          <div className="text-[11.5px] text-[#15803d] font-semibold mt-[5px]">▼ 8% vs last month</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-[#64748B] font-semibold mb-2.5">Cost reduction</div>
          <div className="font-display text-[22px] font-bold text-[#2563EB]">18%</div>
          <div className="text-[11.5px] text-[#94A3B8] font-semibold mt-[5px]">vs no-solar baseline</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card className="p-5 sm:p-[22px_24px]">
          <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
            <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Cost &amp; Savings · 6 months</h3>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
                <span className="w-3 h-3 rounded-[3px] bg-[#EF4444]" />
                Grid cost
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
                <span className="w-3 h-3 rounded-[3px] bg-[#22C55E]" />
                Savings
              </span>
            </div>
          </div>
          <div className="flex items-end gap-[22px] h-[210px] pt-4 px-1.5">
            {finBars.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-[9px] h-full">
                <div className="flex-1 w-full flex items-end justify-center gap-1.5">
                  <div className="w-[42%] rounded-t-[6px]" style={{ background: "linear-gradient(#f87171,#dc2626)", minHeight: "4px", height: m.costPct }} />
                  <div className="w-[42%] rounded-t-[6px]" style={{ background: "linear-gradient(#4ade80,#16a34a)", minHeight: "4px", height: m.savePct }} />
                </div>
                <span className="text-xs font-bold text-[#475569]">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-[#94A3B8] text-center mt-2">Figures in million Toman</div>
        </Card>

        <div className="rounded-2xl p-6 text-white flex flex-col justify-center" style={{ background: "linear-gradient(160deg,#0F172A,#16233f)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,.2)" }}>
            <IconSummary />
          </div>
          <div className="text-[13px] text-[#94A3B8] font-bold uppercase tracking-[0.5px] mb-2.5">Monthly summary</div>
          <p className="m-0 text-[15.5px] leading-relaxed text-[#E2E8F0]">
            This month, SolarFlow reduced electricity costs by <strong className="text-[#4ade80]">18%</strong> and generated{" "}
            <strong className="text-white">125 million Toman</strong> in total savings across production, storage and surplus sales.
          </p>
        </div>
      </div>
    </div>
  );
}
