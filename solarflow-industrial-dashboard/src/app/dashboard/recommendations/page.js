import Card from "@/components/Card";
import { recoList } from "@/lib/mock-data";

export default function RecommendationsPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Smart Recommendations</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">AI-generated actions to cut costs and increase energy revenue</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recoList.map((r) => (
          <Card key={r.title} className="p-[22px] flex flex-col">
            <div className="flex justify-between items-start gap-3 mb-3">
              <h3 className="m-0 text-[15.5px] font-extrabold text-[#0F172A] leading-snug">{r.title}</h3>
              <span
                className="text-[11.5px] font-bold px-[11px] py-[3px] rounded-full whitespace-nowrap"
                style={{ color: r.color, background: r.color + "1a" }}
              >
                {r.type}
              </span>
            </div>
            <p className="m-0 mb-[18px] text-[13.5px] text-[#475569] leading-relaxed flex-1">{r.desc}</p>
            <div className="flex items-center gap-[22px] py-3.5 border-t border-b border-[#F1F5F9] mb-4">
              <div>
                <div className="text-[11px] text-[#94A3B8] font-semibold mb-0.5">Potential value</div>
                <div className="font-display text-[17px] font-bold text-[#15803d]">
                  {r.saving}
                  <span className="text-[11px] text-[#94A3B8] font-sans"> Toman</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-[#94A3B8] font-semibold mb-[5px]">Confidence · {r.conf}%</div>
                <div className="h-1.5 rounded bg-[#E2E8F0] overflow-hidden">
                  <div className="h-full rounded" style={{ width: r.conf + "%", background: r.color }} />
                </div>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="flex-1 h-10 border-none rounded-[10px] bg-[#22C55E] text-white text-[13px] font-bold cursor-pointer hover:bg-[#16a34a] transition-colors"
              >
                Approve
              </button>
              <button
                type="button"
                className="flex-1 h-10 border border-[#E2E8F0] rounded-[10px] bg-white text-[#475569] text-[13px] font-bold cursor-pointer hover:bg-[#F8FAFC] transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                className="h-10 px-[15px] border border-[#E2E8F0] rounded-[10px] bg-white text-[#2563EB] text-[13px] font-bold cursor-pointer hover:bg-[#EFF4FF] transition-colors"
              >
                Details
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
