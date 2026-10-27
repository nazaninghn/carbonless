import { ACCENTS } from './heroContent';

/* One floating emissions card (icon tile, label, illustrative value, mini
   bars). The WHOLE card is one <button> that opens the category's detail dialog
   (MetricDialog), so there is a single interactive element per card and nothing
   nested inside it. Its accessible name starts with the visible label and value
   and says what activating it does. Sized in fixed steps below lg and in
   container units at lg+ (the cqw figures are 0.9306 x the old 1731-unit
   stage's, because the stage is now 1860 units wide, so every size is unchanged
   in pixels). The bars rise in staggered by card and bar `index` (hero.css);
   afterwards only the tallest bar breathes, very slightly. Resting height is
   always the value shown here.
   Feedback: hover lifts 2px and tints the border; pressed settles back with a
   hair of scale; keyboard focus shows the global focus ring. `active` mirrors
   the same highlight when the matching orbit node is hovered. Movement is
   dropped for reduced motion. */
export default function MetricCard({ icon: Icon, label, value, accent, bars, index = 0, className = '', active = false, actionLabel, onSelect, onActiveChange }) {
  const a = ACCENTS[accent];
  return (
    <li className={`list-none ${className}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}, ${value} tCO₂e. ${actionLabel}`}
        data-active={active ? 'true' : 'false'}
        onClick={onSelect}
        onPointerEnter={() => onActiveChange(true)}
        onPointerLeave={() => onActiveChange(false)}
        onFocus={() => onActiveChange(true)}
        onBlur={() => onActiveChange(false)}
        className="hero-card flex h-full w-full cursor-pointer touch-manipulation items-center gap-2.5 rounded-2xl border border-[#DEFAE1] bg-white px-2.5 py-2 text-left shadow-[0_10px_28px_rgba(7,44,14,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-[#B2F2BB] hover:shadow-[0_16px_34px_rgba(7,44,14,0.12)] active:translate-y-0 active:scale-[0.985] data-[active=true]:border-[#B2F2BB] data-[active=true]:shadow-[0_16px_34px_rgba(7,44,14,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 sm:gap-3 sm:px-3.5 sm:py-3 lg:gap-[clamp(8px,0.84cqw,16px)] lg:rounded-[clamp(14px,1.21cqw,22px)] lg:px-[clamp(10px,1.02cqw,20px)] lg:py-[clamp(8px,0.88cqw,16px)]"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 lg:h-[clamp(34px,2.98cqw,56px)] lg:w-[clamp(34px,2.98cqw,56px)]"
          style={{ backgroundColor: a.tint, color: a.ink }}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-[clamp(16px,1.49cqw,28px)] lg:w-[clamp(16px,1.49cqw,28px)]" strokeWidth={2} />
        </span>

        <span aria-hidden="true" className="block min-w-0 flex-1">
          <span className="block text-[11px] font-medium leading-tight text-[#072C0E]/70 sm:text-xs lg:text-[clamp(11px,0.79cqw,15px)]">{label}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[13px] font-bold leading-tight text-[#072C0E] sm:text-[15px] lg:text-[clamp(14px,1.21cqw,23px)]">
            {value}
            <span className="ml-1 text-[0.72em] font-semibold text-[#072C0E]/70">tCO₂e</span>
          </span>
        </span>

        {/* decorative mini bar chart — hidden on the narrowest layouts */}
        <svg aria-hidden="true" viewBox="0 0 38 28" className="hidden h-6 w-9 shrink-0 md:block lg:h-[clamp(18px,1.95cqw,34px)] lg:w-[clamp(26px,2.79cqw,48px)]">
          {bars.map((h, i) => (
            <rect
              key={i}
              className={i === bars.length - 1 ? 'hero-bar hero-bar-live' : 'hero-bar'}
              style={{ '--d': index * 140 + i * 70 }}
              x={i * 8}
              y={28 - 28 * h}
              width="6"
              height={28 * h}
              rx="1.5"
              fill={a.bar}
              opacity={0.4 + i * 0.15}
            />
          ))}
        </svg>
      </button>
    </li>
  );
}
