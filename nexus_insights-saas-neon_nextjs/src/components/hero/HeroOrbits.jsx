import { ANCHORS, LEAVES, RINGS, SCOPES, STAGE, TICK_R } from './heroContent';

/* -- The decorative layers of the hero stage (all aria-hidden, none take pointer events; see hero.css) --
   Everything is positioned in the stage's own units (heroContent.js: STAGE), so it stays aligned with the Earth
   at every size. The Earth never moves; the rings, nodes, leaves and cards do. */

const { cx, cy, w: SW, h: SH } = STAGE;
const polar = (angle, r) => [cx + r * Math.cos(angle * Math.PI / 180), cy + r * Math.sin(angle * Math.PI / 180)];

/* Where each card's inner edge stands, in units from the stage centre (hero.css uses the same numbers), and the
   y of its anchor: the connector is the straight run between the two. */
export const CARD_EDGE = { s1: 310, s2: 346, s3: 300 };

/* Rings, ticks and anchor nodes. */
export function HeroRings() {
  return (
    <svg aria-hidden="true" focusable="false" data-testid="hero-orbits" className="hero-orbits" viewBox={`0 0 ${SW} ${SH}`}>
      <defs>
        <radialGradient id="hero-node-glow">
          <stop offset="0" stopColor="#2abd41" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#2abd41" stopOpacity="0.18" />
          <stop offset="1" stopColor="#2abd41" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hero-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2abd41" stopOpacity="0" />
          <stop offset="1" stopColor="#1d9c31" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* measurement ticks: a fine scale every 3 degrees, a longer mark every 15 */}
      <g data-testid="hero-ticks" className="hero-spin hero-ticks" style={{ '--T': '260s', '--dir': 'reverse' }}>
        <circle cx={cx} cy={cy} r={TICK_R} pathLength="360" className="hero-tick-minor" />
        <circle cx={cx} cy={cy} r={TICK_R} pathLength="360" className="hero-tick-major" />
      </g>

      {RINGS.map(ring => (
        <g key={ring.id} data-testid="hero-ring" className={`hero-spin hero-ring hero-ring-${ring.id}`}
          style={{ '--T': `${Math.abs(ring.T)}s`, '--dir': ring.T < 0 ? 'reverse' : 'normal' }}>
          <circle cx={cx} cy={cy} r={ring.r} fill="none" className="hero-ring-line" />
          {ring.id === 'b' && <circle cx={cx} cy={cy} r={ring.r} fill="none" pathLength="360" className="hero-ring-arc" />}
          {ring.nodes.map(([angle, size], i) => {
            const [x, y] = polar(angle, ring.r);
            return (
              <g key={i} className="hero-node" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                <circle r={26 * size} fill="url(#hero-node-glow)" />
                <circle r={5.5 * size} className="hero-node-core" />
              </g>
            );
          })}
        </g>
      ))}

      {SCOPES.map(({ key }, i) => {
        const [x, y] = polar(ANCHORS[key].angle, ANCHORS[key].r);
        return (
          <g key={key} className="hero-anchor" style={{ '--dl': `${-i * 1.3}s` }} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle r="30" fill="url(#hero-node-glow)" className="hero-anchor-glow" />
            <circle r="7" className="hero-node-core" />
          </g>
        );
      })}
    </svg>
  );
}

/* The thin line from each anchor node out to its card (wide layouts only). */
export function HeroLinks() {
  return (
    <svg aria-hidden="true" focusable="false" data-testid="hero-links" className="hero-links" viewBox={`0 0 ${SW} ${SH}`}>
      {SCOPES.map(({ key }) => {
        const [x, y] = polar(ANCHORS[key].angle, ANCHORS[key].r);
        const edge = ANCHORS[key].angle > -90 && ANCHORS[key].angle < 90 ? cx + CARD_EDGE[key] : cx - CARD_EDGE[key];
        return <path key={key} d={`M ${edge} ${y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`} className="hero-link" />;
      })}
    </svg>
  );
}

/* The three Scope cards: real text, localised, glass-white. Each is a button that opens its Scope panel
   (onOpen gets the key and the button, so focus can go back to it). */
export function HeroCards({ copy, label, opens, active, mode, popover, onOpen }) {
  return (
    <ul aria-label={label} data-testid="hero-scopes" className="hero-cards">
      {SCOPES.map(({ key, icon: Icon }, i) => (
        <li key={key} data-testid={`hero-scope-${key}`} className={`hero-card-slot hero-card-${key}`}>
          <button type="button" className="hero-card" style={{ '--dl': `${-i * 1.7}s` }} aria-haspopup="dialog" aria-expanded={active === key} onClick={e => onOpen(key, e.currentTarget)}>
            <span aria-hidden="true" className="hero-card-icon"><Icon strokeWidth={1.6} /></span>
            <span className="hero-card-text">
              <span className="hero-card-title">{copy[key].title}</span>
              <span className="hero-card-sub">{copy[key].sub}</span>
            </span>
            <span className="sr-only">{opens}</span>
          </button>
          {mode === 'phone' && active === key && popover}
        </li>
      ))}
      {mode === 'tablet' && active && <li className="hero-pop-row">{popover}</li>}
    </ul>
  );
}

/* A few soft leaves drifting around the globe. */
export function HeroLeaves() {
  return (
    <div aria-hidden="true" data-testid="hero-leaves" className="hero-leaves">
      {LEAVES.map((l, i) => (
        <span key={i} className={`hero-leaf hero-leaf-${i}`}
          style={{ '--lx': l.x, '--ly': l.y, '--ls': l.s, '--lr': `${l.rot}deg`, '--ld': `${l.d}s`, '--dl': `${-l.t}s` }}>
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 1.5C19.5 5 22.5 14 12 22.5 1.5 14 4.5 5 12 1.5Z" fill="#3aa84a" />
            <path d="M12 1.5C19.5 5 22.5 14 12 22.5Z" fill="#79d283" opacity="0.55" />
            <path d="M12 4v18" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

/* Very soft clouds: stacks of radial puffs, drifting a few pixels. */
const CLOUDS = [
  { x: 20, y: 300, w: 300, h: 150, d: 46, dl: 0 },
  { x: 900, y: 400, w: 330, h: 170, d: 58, dl: -20 },
  { x: 930, y: 60, w: 230, h: 110, d: 52, dl: -9 },
  { x: 40, y: 520, w: 270, h: 120, d: 64, dl: -30 },
];
export function HeroClouds() {
  return (
    <div aria-hidden="true" className="hero-clouds">
      {CLOUDS.map((c, i) => (
        <span key={i} className="hero-cloud" style={{ '--cx': c.x, '--cy': c.y, '--cw': c.w, '--ch': c.h, '--cd': `${c.d}s`, '--dl': `${c.dl}s` }} />
      ))}
    </div>
  );
}
