// Shared entrance + micro-interaction keyframes for dashboard pages
// (Overview, Emissions, Targets, ...). Injected once per page via
// <style>{DASHBOARD_ANIM_STYLES}</style> — Tailwind's built-in utilities don't
// cover staggered entrance or the pulsing "live" dot.
export const DASHBOARD_ANIM_STYLES = `
@keyframes dashFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.dash-fade-up { animation: dashFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes dashPulseDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
.dash-pulse-dot { animation: dashPulseDot 2s ease-in-out infinite; }
`;
