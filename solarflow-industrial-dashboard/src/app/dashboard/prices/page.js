import Card from "@/components/Card";
import ChartAxis from "@/components/ChartAxis";
import { IconTrendUp, IconTrendDown } from "@/components/icons";
import { prices, priceBands } from "@/lib/mock-data";

export default function PricesPage() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="m-0 text-[22px] font-extrabold text-[#0F172A] tracking-[-0.5px]">Electricity Prices</h1>
        <p className="m-0 mt-[5px] text-[13.5px] text-[#64748B]">Grid buy &amp; sell prices and the best windows to trade energy</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card className="p-5 sm:p-[20px_22px] flex items-center gap-4">
          <span className="w-[46px] h-[46px] rounded-[13px] bg-[#FEE4E2] flex items-center justify-center shrink-0">
            <IconTrendUp width="22" height="22" />
          </span>
          <div>
            <div className="text-[12.5px] text-[#64748B] font-semibold">Buying from grid now</div>
            <div className="font-display text-2xl font-bold text-[#0F172A] mt-0.5">
              3,400 <span className="text-[13px] text-[#94A3B8] font-sans">Toman / kWh</span>
            </div>
            <div className="text-[11.5px] text-[#b91c1c] font-semibold mt-[3px]">High tier · peak hours</div>
          </div>
        </Card>
        <Card className="p-5 sm:p-[20px_22px] flex items-center gap-4">
          <span className="w-[46px] h-[46px] rounded-[13px] bg-[#ECFDF3] flex items-center justify-center shrink-0">
            <IconTrendDown width="22" height="22" />
          </span>
          <div>
            <div className="text-[12.5px] text-[#64748B] font-semibold">Selling surplus now</div>
            <div className="font-display text-2xl font-bold text-[#0F172A] mt-0.5">
              2,850 <span className="text-[13px] text-[#94A3B8] font-sans">Toman / kWh</span>
            </div>
            <div className="text-[11.5px] text-[#15803d] font-semibold mt-[3px]">Feed-in tariff · rising</div>
          </div>
        </Card>
      </div>

      <Card className="p-5 sm:p-[20px_22px] mb-4">
        <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
          <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Grid Price · Next 24 hours</h3>
          <div className="flex gap-3.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#475569] font-semibold">
              <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: "rgba(34,197,94,.5)" }} />
              Cheap
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#475569] font-semibold">
              <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: "rgba(245,158,11,.5)" }} />
              Medium
            </span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-[#475569] font-semibold">
              <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: "rgba(239,68,68,.5)" }} />
              Expensive
            </span>
          </div>
        </div>
        <svg viewBox="0 0 1000 240" className="w-full h-[220px] block" preserveAspectRatio="none">
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2563EB" stopOpacity="0.18" />
              <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
            </linearGradient>
          </defs>
          {priceBands.map((b, i) => (
            <rect key={i} x={b.x} y="16" width={b.w} height="184" fill={b.fill} />
          ))}
          <line x1="40" y1="63" x2="960" y2="63" stroke="#F1F5F9" />
          <line x1="40" y1="131" x2="960" y2="131" stroke="#F1F5F9" />
          <line x1="40" y1="200" x2="960" y2="200" stroke="#E2E8F0" />
          <path d={prices.area} fill="url(#priceFill)" />
          <path d={prices.line} fill="none" stroke="#2563EB" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <ChartAxis />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 sm:p-[20px_22px] border border-[#D1FADF]" style={{ background: "linear-gradient(120deg,#ECFDF3,#fff)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span className="text-xs font-bold text-[#16794a] uppercase tracking-[0.4px]">Best time to buy</span>
          </div>
          <div className="text-[19px] font-extrabold text-[#0F172A]">2:00 AM – 5:00 AM</div>
          <p className="mt-1.5 mb-0 text-[13px] text-[#475569] leading-relaxed">
            Off-peak tariff at its lowest. Charge the battery and run deferrable loads here.
          </p>
        </div>
        <div className="rounded-2xl p-5 sm:p-[20px_22px] border border-[#DBE7FF]" style={{ background: "linear-gradient(120deg,#EFF4FF,#fff)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
            <span className="text-xs font-bold text-[#2563EB] uppercase tracking-[0.4px]">Best time to sell</span>
          </div>
          <div className="text-[19px] font-extrabold text-[#0F172A]">6:00 PM – 9:00 PM</div>
          <p className="mt-1.5 mb-0 text-[13px] text-[#475569] leading-relaxed">
            Feed-in tariff peaks in the evening. Export stored and surplus solar for maximum revenue.
          </p>
        </div>
      </div>
    </div>
  );
}
