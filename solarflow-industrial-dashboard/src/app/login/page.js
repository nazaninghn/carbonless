"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("energy@ariasteel.com");
  const [password, setPassword] = useState("123456789");
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const doLogin = (e) => {
    e.preventDefault();
    localStorage.setItem("sf_loggedIn", "1");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex flex-row-reverse">
      {/* illustration panel */}
      <div className="flex-1 min-h-screen relative overflow-hidden hidden lg:flex items-center justify-center p-14 bg-gradient-to-br from-[#0F172A] via-[#15233f] to-[#0b1220]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 400px at 78% 18%,rgba(37,99,235,.28),transparent 60%),radial-gradient(500px 380px at 20% 88%,rgba(34,197,94,.16),transparent 60%)",
          }}
        />
        <svg viewBox="0 0 520 460" className="w-full max-w-[520px] relative z-10" fill="none">
          <circle cx="392" cy="96" r="52" fill="#F59E0B" opacity="0.16" />
          <circle cx="392" cy="96" r="30" fill="#FBBF24" />
          <g stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" opacity="0.8">
            <line x1="392" y1="30" x2="392" y2="16" />
            <line x1="392" y1="176" x2="392" y2="162" />
            <line x1="326" y1="96" x2="312" y2="96" />
            <line x1="472" y1="96" x2="458" y2="96" />
            <line x1="345" y1="49" x2="335" y2="39" />
            <line x1="449" y1="143" x2="439" y2="133" />
            <line x1="439" y1="49" x2="449" y2="39" />
            <line x1="335" y1="143" x2="345" y2="133" />
          </g>
          <g transform="translate(150 210) skewX(-16)">
            <rect x="0" y="0" width="230" height="120" rx="6" fill="#1e3a8a" stroke="#3b62d6" strokeWidth="1.5" />
            <g stroke="#3b62d6" strokeWidth="1.2" opacity="0.9">
              <line x1="57" y1="0" x2="57" y2="120" />
              <line x1="115" y1="0" x2="115" y2="120" />
              <line x1="172" y1="0" x2="172" y2="120" />
              <line x1="0" y1="40" x2="230" y2="40" />
              <line x1="0" y1="80" x2="230" y2="80" />
            </g>
            <rect x="4" y="4" width="49" height="32" fill="#2563EB" opacity="0.55" />
            <rect x="119" y="44" width="49" height="32" fill="#60a5fa" opacity="0.45" />
            <rect x="176" y="84" width="49" height="32" fill="#2563EB" opacity="0.4" />
          </g>
          <line x1="255" y1="205" x2="255" y2="150" stroke="#334155" strokeWidth="5" />
          <g transform="translate(70 250)" fill="#22C55E">
            <rect x="0" y="40" width="86" height="70" rx="4" fill="#134e2f" />
            <path d="M0 40 L22 22 L22 40 Z M22 40 L22 22 L44 40 Z M44 40 L44 22 L66 40 Z" fill="#16a34a" />
            <rect x="8" y="58" width="14" height="14" rx="2" fill="#22C55E" opacity="0.7" />
            <rect x="30" y="58" width="14" height="14" rx="2" fill="#22C55E" opacity="0.7" />
            <rect x="52" y="58" width="14" height="14" rx="2" fill="#22C55E" opacity="0.7" />
            <rect x="64" y="14" width="10" height="30" rx="2" fill="#134e2f" />
          </g>
          <g stroke="#22C55E" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" opacity="0.7">
            <path d="M156 300 C 210 320 260 300 300 270" />
          </g>
        </svg>
      </div>

      {/* form panel */}
      <div className="w-full lg:w-[560px] lg:max-w-[46vw] min-h-screen bg-white flex items-center justify-center p-8 sm:p-12">
        <form onSubmit={doLogin} className="w-full max-w-[360px]">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-[11px] bg-[#2563EB] flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(37,99,235,.7)]">
              <LogoMark size={22} />
            </div>
            <div className="font-display font-bold text-[21px] tracking-[-0.5px] text-[#0F172A]">SolarFlow</div>
          </div>

          <h1 className="text-[26px] font-extrabold tracking-[-0.6px] m-0 mb-2 text-[#0F172A]">Sign in to Energy Console</h1>
          <p className="text-sm text-[#64748B] m-0 mb-8 leading-relaxed">
            Smart management of solar energy consumption, storage and sales.
          </p>

          <label className="block text-[13px] font-semibold text-[#334155] mb-[7px]">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-[46px] px-3.5 border border-[#E2E8F0] rounded-[11px] text-sm text-[#111827] bg-[#F8FAFC] mb-[18px] outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />

          <label className="block text-[13px] font-semibold text-[#334155] mb-[7px]">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-[46px] px-3.5 border border-[#E2E8F0] rounded-[11px] text-sm text-[#111827] bg-[#F8FAFC] mb-3.5 outline-none focus:border-[#2563EB] focus:bg-white transition-colors"
          />

          <div className="flex justify-between items-center mb-[26px]">
            <label className="flex items-center gap-2 text-[13px] text-[#64748B] cursor-pointer">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="w-[15px] h-[15px] accent-[#2563EB]"
              />
              Keep me signed in
            </label>
            <a href="#" className="text-[13px] font-semibold text-[#2563EB] no-underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full h-12 border-none rounded-[11px] bg-[#2563EB] text-white text-[15px] font-bold cursor-pointer shadow-[0_10px_24px_-10px_rgba(37,99,235,.8)] hover:bg-[#1d4ed8] transition-colors"
          >
            Sign in to dashboard
          </button>

          <p className="text-xs text-[#94A3B8] mt-7 mb-0 text-center">SolarFlow Industrial Energy Dashboard · Aria Steel Plant</p>
        </form>
      </div>
    </div>
  );
}
