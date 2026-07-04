"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogoMark,
  IconDashboard,
  IconForecast,
  IconConsumption,
  IconProduction,
  IconBattery,
  IconPrices,
  IconRecommendations,
  IconFinancial,
  IconSettings,
} from "./icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard },
  { href: "/dashboard/forecast", label: "Energy Forecast", icon: IconForecast },
  { href: "/dashboard/consumption", label: "Factory Consumption", icon: IconConsumption },
  { href: "/dashboard/production", label: "Solar Production", icon: IconProduction },
  { href: "/dashboard/battery", label: "Battery & Storage", icon: IconBattery },
  { href: "/dashboard/prices", label: "Electricity Prices", icon: IconPrices },
  { href: "/dashboard/recommendations", label: "Smart Recommendations", icon: IconRecommendations },
  { href: "/dashboard/financial", label: "Financial Reports", icon: IconFinancial },
  { href: "/dashboard/settings", label: "Factory Settings", icon: IconSettings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[250px] shrink-0 bg-[#0F172A] min-h-screen sticky top-0 h-screen flex flex-col p-[22px_16px] overflow-y-auto">
      <div className="flex items-center gap-[11px] px-2 pt-1.5 pb-[22px]">
        <div className="w-[34px] h-[34px] rounded-[9px] bg-[#2563EB] flex items-center justify-center shrink-0">
          <LogoMark size={19} />
        </div>
        <div>
          <div className="font-display font-bold text-[17px] text-white tracking-[-0.4px] leading-none">SolarFlow</div>
          <div className="text-[10.5px] text-[#64748B] font-semibold tracking-[0.3px] mt-1">ENERGY CONSOLE</div>
        </div>
      </div>

      <nav className="flex flex-col gap-[3px] flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-[13px] py-[11px] rounded-[11px] text-[13.5px] font-semibold transition-colors ${
                active
                  ? "text-white bg-[#2563EB] shadow-[0_8px_18px_-8px_rgba(37,99,235,.75)]"
                  : "text-[#94A3B8] hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 p-3.5 rounded-[13px] bg-[#2563EB]/12 border border-[#2563EB]/25" style={{ background: "rgba(37,99,235,.12)", borderColor: "rgba(37,99,235,.25)" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-[#22C55E]" style={{ boxShadow: "0 0 0 3px rgba(34,197,94,.25)" }} />
          <span className="text-xs font-bold text-white">System Online</span>
        </div>
        <div className="text-[11px] text-[#94A3B8] leading-relaxed">All 6 inverters &amp; battery bank reporting normally.</div>
      </div>
    </aside>
  );
}
