"use client";

import { usePathname, useRouter } from "next/navigation";
import { IconBell } from "./icons";

const TITLES = {
  "/dashboard": "Dashboard",
  "/dashboard/forecast": "Energy Forecast",
  "/dashboard/consumption": "Factory Consumption",
  "/dashboard/production": "Solar Production",
  "/dashboard/battery": "Battery & Storage",
  "/dashboard/prices": "Electricity Prices",
  "/dashboard/recommendations": "Smart Recommendations",
  "/dashboard/financial": "Financial Reports",
  "/dashboard/settings": "Factory Settings",
};

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] || "Dashboard";

  const handleLogout = () => {
    localStorage.removeItem("sf_loggedIn");
    router.push("/login");
  };

  return (
    <header className="h-[72px] shrink-0 bg-white/85 backdrop-blur-md border-b border-[#EEF2F6] flex items-center justify-between px-8 sticky top-0 z-20">
      <div className="flex items-center gap-3.5">
        <div>
          <div className="flex items-center gap-[9px]">
            <h2 className="m-0 text-[16px] font-extrabold text-[#0F172A] tracking-[-0.3px]">{title}</h2>
            <span className="text-[11px] font-bold text-[#2563EB] bg-[#EFF4FF] px-[9px] py-[2px] rounded-full">Aria Steel Plant</span>
          </div>
          <div className="text-[12.5px] text-[#64748B] mt-0.5">Saturday · July 4, 2026 · 10:24 AM</div>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-[7px] h-9 px-[13px] rounded-full bg-[#ECFDF3] border border-[#D1FADF]">
          <span className="w-[7px] h-[7px] rounded-full bg-[#22C55E] animate-pulse-dot" />
          <span className="text-[12.5px] font-bold text-[#16794a]">Online</span>
        </div>
        <button
          type="button"
          className="w-[38px] h-[38px] rounded-[11px] border border-[#EEF2F6] bg-white flex items-center justify-center cursor-pointer relative hover:bg-[#F8FAFC] transition-colors"
        >
          <IconBell />
          <span className="absolute top-2 right-[9px] w-2 h-2 bg-[#EF4444] rounded-full border-2 border-white" />
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className="flex items-center gap-2.5 h-[38px] pl-[13px] pr-1.5 rounded-full border border-[#EEF2F6] bg-white cursor-pointer hover:bg-[#F8FAFC] transition-colors"
        >
          <div className="text-right">
            <div className="text-[12.5px] font-bold text-[#0F172A] leading-tight">Kian Ahmadi</div>
            <div className="text-[10.5px] text-[#94A3B8]">Energy Manager</div>
          </div>
          <div className="w-[30px] h-[30px] rounded-full bg-gradient-to-br from-[#2563EB] to-[#22C55E] flex items-center justify-center text-white text-xs font-bold">
            KA
          </div>
        </button>
      </div>
    </header>
  );
}
