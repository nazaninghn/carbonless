import Link from "next/link";
import Card from "@/components/Card";
import ChartAxis from "@/components/ChartAxis";
import { IconProduction, IconRecommendations, IconSun, IconPartlyCloudy, IconCloudy } from "@/components/icons";
import { dashboardChart, weather } from "@/lib/mock-data";

const weatherIcon = { sun: IconSun, partly: IconPartlyCloudy, cloudy: IconCloudy };
const weatherBg = { sun: "#FEF3C7", partly: "#EFF4FF", cloudy: "#F1F5F9" };

export default function DashboardPage() {
  return (
    <div className="animate-fade-up">
      {/* HERO */}
      <div
        className="rounded-[18px] p-6 flex items-center gap-[22px] mb-[22px] relative overflow-hidden"
        style={{ background: "linear-gradient(120deg,#0F172A 0%,#16233f 60%,#132a4d 100%)" }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(400px 200px at 90% 0%,rgba(37,99,235,.35),transparent 65%)" }}
        />
        <div className="w-[52px] h-[52px] rounded-2xl bg-[#F59E0B]/20 flex items-center justify-center shrink-0 relative z-10" style={{ background: "rgba(245,158,11,.18)" }}>
          <IconProduction stroke="#FBBF24" width="26" height="26" />
        </div>
        <div className="relative z-10">
          <div className="text-xs font-bold text-[#60a5fa] tracking-[0.4px] uppercase mb-1">Today&apos;s outlook · Stable</div>
          <p className="m-0 text-[15.5px] leading-relaxed text-[#E2E8F0] max-w-[820px]">
            Energy status is <strong className="text-[#4ade80]">stable today</strong>. Tomorrow, due to increased cloud cover, solar
            production is expected to drop by about <strong className="text-[#fbbf24]">28%</strong>. We recommend keeping the battery
            charged to <strong className="text-white">at least 80%</strong> by end of day.
          </p>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-[22px]">
        <Card className="p-[18px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#FEF3C7] flex items-center justify-center">
              <IconSun size={16} />
            </span>
            <span className="text-xs text-[#64748B] font-semibold">Solar today</span>
          </div>
          <div className="font-display text-2xl font-bold text-[#0F172A] tracking-[-0.5px]">
            3,850<span className="text-[13px] text-[#94A3B8] font-semibold font-sans"> kWh</span>
          </div>
          <div className="text-[11.5px] text-[#16794a] font-semibold mt-[5px]">▲ 6% vs yesterday</div>
        </Card>

        <Card className="p-[18px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#EFF4FF] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
              </svg>
            </span>
            <span className="text-xs text-[#64748B] font-semibold">Consumption</span>
          </div>
          <div className="font-display text-2xl font-bold text-[#0F172A] tracking-[-0.5px]">
            4,400<span className="text-[13px] text-[#94A3B8] font-semibold font-sans"> kWh</span>
          </div>
          <div className="text-[11.5px] text-[#b45309] font-semibold mt-[5px]">▲ 3% vs yesterday</div>
        </Card>

        <Card className="p-[18px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#ECFDF3] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="17" height="10" rx="2.5" />
                <path d="M22 10v4" />
              </svg>
            </span>
            <span className="text-xs text-[#64748B] font-semibold">Battery</span>
          </div>
          <div className="font-display text-2xl font-bold text-[#0F172A] tracking-[-0.5px]">
            72<span className="text-[15px] text-[#94A3B8] font-semibold font-sans">%</span>
          </div>
          <div className="h-1.5 rounded bg-[#EEF2F6] mt-[9px] overflow-hidden">
            <div className="w-[72%] h-full rounded" style={{ background: "linear-gradient(90deg,#22C55E,#16a34a)" }} />
          </div>
        </Card>

        <Card className="p-[18px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#FEE4E2] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <span className="text-xs text-[#64748B] font-semibold">Grid cost</span>
          </div>
          <div className="font-display text-xl font-bold text-[#0F172A] tracking-[-0.5px]">18,500,000</div>
          <div className="text-[11.5px] text-[#94A3B8] font-semibold mt-[5px]">Toman · today</div>
        </Card>

        <Card className="p-[18px] col-span-2 lg:col-span-1" style={{ background: "linear-gradient(135deg,#ECFDF3,#fff)", borderColor: "#D1FADF" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-[#22C55E] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span className="text-xs text-[#16794a] font-bold">Savings</span>
          </div>
          <div className="font-display text-xl font-bold text-[#15803d] tracking-[-0.5px]">9,200,000</div>
          <div className="text-[11.5px] text-[#16794a] font-semibold mt-[5px]">Toman saved today</div>
        </Card>
      </div>

      {/* CHART + WEATHER ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.75fr_1fr] gap-4 mb-[22px]">
        <Card className="p-5 sm:p-[20px_22px]">
          <div className="flex justify-between items-start mb-1.5">
            <div>
              <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Today&apos;s Energy Status</h3>
              <p className="m-0 mt-[3px] text-xs text-[#94A3B8]">Hourly production, consumption, battery &amp; grid price</p>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap my-3 mb-1.5">
            <Legend color="#22C55E" label="Solar" block />
            <Legend color="#2563EB" label="Consumption" />
            <Legend color="#F59E0B" label="Battery %" />
            <Legend color="#94A3B8" label="Grid price" />
          </div>
          <svg viewBox="0 0 1000 300" className="w-full h-[270px] block" preserveAspectRatio="none">
            <defs>
              <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#22C55E" stopOpacity="0.28" />
                <stop offset="1" stopColor="#22C55E" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="40" y1="70" x2="960" y2="70" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="40" y1="140" x2="960" y2="140" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="40" y1="210" x2="960" y2="210" stroke="#F1F5F9" strokeWidth="1" />
            <line x1="40" y1="260" x2="960" y2="260" stroke="#E2E8F0" strokeWidth="1" />
            <path d={dashboardChart.solarArea} fill="url(#solarFill)" />
            <path d={dashboardChart.priceLine} fill="none" stroke="#94A3B8" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={dashboardChart.battLine} fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeDasharray="6 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <path d={dashboardChart.solarLine} fill="none" stroke="#22C55E" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <path d={dashboardChart.consLine} fill="none" stroke="#2563EB" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <ChartAxis />
        </Card>

        <Card className="p-5 sm:p-[20px_22px]">
          <h3 className="m-0 mb-0.5 text-[15px] font-extrabold text-[#0F172A]">Weather &amp; Irradiance</h3>
          <p className="m-0 mb-4 text-xs text-[#94A3B8]">3-day solar forecast</p>
          {weather.map((w) => {
            const Icon = weatherIcon[w.kind];
            return (
              <div key={w.day} className="flex items-center gap-[13px] py-3 border-b border-[#F1F5F9] last:border-b-0">
                <div className="w-10 h-10 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: weatherBg[w.kind] }}>
                  <Icon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold text-[#0F172A]">{w.day}</div>
                  <div className="text-xs text-[#64748B]">
                    {w.cond} · {w.cloud} cloud
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#0F172A]">{w.temp}</div>
                  <div className="text-[11px] text-[#F59E0B] font-semibold">{w.irr}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* SMART RECOMMENDATION */}
      <Card
        className="p-6 sm:p-[22px_24px]"
        style={{ background: "linear-gradient(120deg,#EFF4FF 0%,#fff 55%)", borderColor: "#DBE7FF" }}
      >
        <div className="flex gap-[18px] items-start flex-col sm:flex-row">
          <div className="w-[46px] h-[46px] rounded-[13px] bg-[#2563EB] flex items-center justify-center shrink-0 shadow-[0_10px_22px_-10px_rgba(37,99,235,.7)]">
            <IconRecommendations stroke="#fff" width="23" height="23" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-[9px] mb-[7px] flex-wrap">
              <h3 className="m-0 text-[15px] font-extrabold text-[#0F172A]">Smart Recommendation · Today</h3>
              <span className="text-[11px] font-bold text-[#2563EB] bg-[#DBE7FF] px-[9px] py-[2px] rounded-full">Load shift</span>
            </div>
            <p className="m-0 mb-4 text-sm leading-relaxed text-[#334155] max-w-[760px]">
              Given the forecasted drop in solar irradiance this evening, we recommend keeping the battery at{" "}
              <strong>≥80% until 2 PM</strong> and shifting <strong>Production Line 2</strong>&apos;s load into the 11 AM–3 PM window while
              solar output is highest.
            </p>
            <div className="flex items-center gap-7 flex-wrap">
              <div>
                <div className="text-[11px] text-[#94A3B8] font-semibold mb-0.5">Potential savings</div>
                <div className="font-display text-lg font-bold text-[#15803d]">
                  12,400,000 <span className="text-xs text-[#94A3B8] font-sans">Toman</span>
                </div>
              </div>
              <div className="w-px h-[34px] bg-[#DBE7FF] hidden sm:block" />
              <div>
                <div className="text-[11px] text-[#94A3B8] font-semibold mb-1">Forecast confidence</div>
                <div className="flex items-center gap-2">
                  <div className="w-[90px] h-1.5 rounded bg-[#E2E8F0] overflow-hidden">
                    <div className="w-[87%] h-full bg-[#2563EB] rounded" />
                  </div>
                  <span className="text-[13px] font-bold text-[#2563EB]">87%</span>
                </div>
              </div>
              <div className="flex-1" />
              <Link
                href="/dashboard/recommendations"
                className="h-[42px] px-5 inline-flex items-center rounded-[11px] bg-[#0F172A] text-white text-[13.5px] font-bold hover:bg-[#1e293b] transition-colors"
              >
                View recommendation details
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Legend({ color, label, block }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold">
      <span className={`w-3 ${block ? "h-3 rounded-[3px]" : "h-[3px] rounded-[3px]"}`} style={{ background: color }} />
      {label}
    </span>
  );
}
