import { ACCENTS } from './heroContent';

/* Small round category icon that sits on an orbit path. It is a real <button>
   that opens the same detail dialog as its metric card, but it is a pointer /
   touch shortcut only: it is hidden from assistive tech and left out of the Tab
   order (tabIndex -1), because the card beside it is the keyboard and screen
   reader control for the very same action — twelve tab stops for six actions
   would just be noise. A transparent ::before pads the hit area by 8px so a
   30-44px circle is still a comfortable touch target. Positioned by its centre
   with the `translate` property, so hero.css can scale it (ping / pop) and
   hover/press can scale it too without moving it. `index` staggers the
   animations. */
export default function CategoryNode({ icon: Icon, accent, index = 0, className = '', style, active = false, onSelect, onActiveChange }) {
  const a = ACCENTS[accent];
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      data-active={active ? 'true' : 'false'}
      onClick={onSelect}
      onPointerEnter={() => onActiveChange(true)}
      onPointerLeave={() => onActiveChange(false)}
      className={`hero-node pointer-events-auto absolute flex aspect-square -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-manipulation items-center justify-center rounded-full border-[1.5px] bg-white shadow-[0_6px_18px_rgba(7,44,14,0.10)] transition duration-200 before:absolute before:-inset-2 before:rounded-full before:content-[''] hover:scale-110 hover:shadow-[0_10px_24px_rgba(7,44,14,0.18)] active:scale-95 data-[active=true]:scale-110 data-[active=true]:shadow-[0_10px_24px_rgba(7,44,14,0.18)] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:data-[active=true]:scale-100 ${className}`}
      style={{ borderColor: a.ring, color: a.ink, '--i': index, '--hero-ping': a.bar, ...style }}
    >
      <Icon className="h-[52%] w-[52%]" strokeWidth={2} />
    </button>
  );
}
