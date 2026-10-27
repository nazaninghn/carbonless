import { ACCENTS, CATEGORIES, ORBIT_ARCS } from './heroContent';

/* Dashed orbit arcs + card→node connectors for the desktop stage. The viewBox
   is the same 1860x678 box the stage's aspect-ratio uses (83 units of headroom
   above the sphere area, which the paths are measured from, hence the shifted
   group), so every path lands on its node/card at any width.
   non-scaling-stroke keeps the line weight and dash length constant in screen
   pixels while the stage scales; hero.css drifts the dashes along each path
   (period = 5 + 6 px). The right-hand arcs run top->bottom and the left-hand
   ones (`rev`) bottom->top, so the whole orbit flows clockwise around the Earth. */
export function DesktopOrbits() {
  const line = { fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '5 6', vectorEffect: 'non-scaling-stroke' };
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 1860 678" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <g transform="translate(0 83)">
        {ORBIT_ARCS.map(arc => (
          <path key={arc.d} d={arc.d} stroke={ACCENTS[arc.accent].bar} opacity="0.55" className={arc.rev ? 'hero-dash-rev' : 'hero-dash'} style={{ '--hero-arc-op': 0.55 }} {...line} />
        ))}
        {CATEGORIES.map(c => (
          <path key={c.key} d={c.link} stroke={ACCENTS[c.accent].bar} opacity="0.5" className="hero-dash" style={{ '--hero-arc-op': 0.5 }} {...line} />
        ))}
      </g>
    </svg>
  );
}

/* Simplified orbit ring for narrower layouts: one dashed circle around the
   Earth. 100x79 units == the Earth box (width x aspect), so the circle lines
   up with the container-unit node positions in HeroSection. */
export function MobileOrbitRing() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 100 79" className="absolute inset-0 h-full w-full">
      <circle cx="50" cy="55" r="44.8" fill="none" stroke="#2ABD41" strokeOpacity="0.5" strokeWidth="0.35" strokeDasharray="1.3 1.7" strokeLinecap="round" className="hero-dash-m" />
    </svg>
  );
}
