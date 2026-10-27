'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { CATEGORIES, HERO_COPY } from './heroContent';
import EarthIllustration from './EarthIllustration';
import MetricCard from './MetricCard';
import CategoryNode from './CategoryNode';
import MetricDialog from './MetricDialog';
import { DesktopOrbits, MobileOrbitRing } from './OrbitPaths';
import useHeroMotion from './useHeroMotion';
import './hero.css';

/* How long the Earth reaction plays (matches hero.css). Further activations
   are ignored until it has finished, so rapid clicks never stack animations. */
const REACT_MS = 1150;

/* -- Landing-page hero --
   Centered headline + CTAs, then one "stage" holding the Earth, the orbit
   paths/category icons and six illustrative emissions cards.

   Responsive strategy — one DOM, two layouts:
   * lg+ : the stage is a fixed-aspect (1860x678) canvas holding the complete
           Earth; cards, nodes and dashed paths are placed in % of it and
           everything scales together (sizes use container units). The text
           block and the stage are both sized from the viewport HEIGHT (hero.css),
           so headline, CTAs, all six cards and the whole Earth fit one screen.
   * <lg : compact and stacked — a tight text block (the headline scales so
           each line stays whole), the Earth with a simplified orbit ring and
           six icon nodes, the "Illustrative example" label, then the cards in
           a grid (3 rows x 2 cols on phones, 2 rows x 3 cols from sm).

   Interaction: each metric card is one button and so is its orbit node; both
   open the same detail dialog (MetricDialog). The node is a pointer/touch
   shortcut (out of the tab order, hidden from assistive tech); the card is the
   keyboard / screen-reader control.

   Motion (hero.css): the Earth floats and rocks slowly in perspective (never a
   spin) with a passing sheen, a breathing glow and a pulsing marker; when
   activated it also tilts/scales with a glow and an orbit "pop". Nodes ping,
   dashes drift along the orbit paths, and the card bars rise and breathe. data-hero-motion pauses it all off-screen /
   in a hidden tab and switches to a fully static look for reduced motion. */
export default function HeroSection() {
  const { language: lang } = useLanguage();
  const t = HERO_COPY[lang] ?? HERO_COPY.en;

  const sectionRef = useRef(null);
  const motion = useHeroMotion(sectionRef);

  // Which category's detail dialog is open, and which card/node pair is being
  // hovered or focused (so the card and its orbit node light up together).
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const selected = CATEGORIES.find(c => c.key === selectedKey) ?? null;
  const activeFor = key => on => setActiveKey(prev => (on ? key : prev === key ? null : prev));

  // One reaction at a time: `busy` is the lock, `reacting` drives the CSS.
  const [reacting, setReacting] = useState(false);
  const busy = useRef(false);
  const timer = useRef(null);
  const activate = useCallback(applyVars => {
    if (busy.current) return;
    busy.current = true;
    applyVars();
    setReacting(true);
    timer.current = setTimeout(() => {
      busy.current = false;
      setReacting(false);
    }, REACT_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <section
      ref={sectionRef}
      data-hero-motion={motion}
      data-reacting={reacting ? 'true' : 'false'}
      aria-labelledby="hero-heading"
      className="hero-root relative isolate overflow-hidden bg-white pt-3 sm:pt-10"
    >
      {/* soft green atmosphere (top centre + both sides) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_0%,#F1FCF2_0%,rgba(255,255,255,0)_70%),radial-gradient(38%_48%_at_0%_62%,#F1FCF2_0%,rgba(255,255,255,0)_70%),radial-gradient(38%_48%_at_100%_62%,#F1FCF2_0%,rgba(255,255,255,0)_70%)]"
      />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1A7B2A] sm:text-[12px] sm:tracking-[0.25em] xl:text-[13px]">{t.kicker}</p>

        {/* two short lines in both languages. Below sm the size follows the
            viewport width so the longer line always fits on one line (keeps the
            Earth on a phone's first screen); sm-lg use fixed steps; lg+ is sized
            from the viewport height too (hero.css, .hero-h1) */}
        <h1
          id="hero-heading"
          className="hero-h1 mt-2 text-balance text-[length:clamp(24px,calc((100vw-32px)/11.9),36px)] leading-[1.08] tracking-[-0.025em] text-green-950 sm:mt-3 sm:text-[44px]"
          style={{ fontFamily: "'General Sans', sans-serif", fontWeight: 700 }}
        >
          <span className="block">{t.title.line1}</span>{' '}
          <span className="block text-[#1D9C31]">{t.title.line2}</span>
        </h1>



        <div className="hero-ctas mt-3 flex flex-col items-center justify-center gap-2 sm:mt-6 sm:flex-row sm:gap-3">
          <Link
            href="/register"
            className="hero-cta flex w-full max-w-[340px] items-center justify-center gap-2 rounded-full btn-primary px-5 py-3 text-[14px] font-bold transition sm:w-auto sm:max-w-none sm:px-8 sm:py-3.5 xl:px-9 xl:text-[15px]"
          >
            <span className="sm:hidden">{t.ctaPrimaryShort}</span>
            <span className="hidden sm:inline">{t.ctaPrimary}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href="#ai"
            className="hero-cta flex w-full max-w-[340px] items-center justify-center gap-2.5 rounded-full btn-secondary px-5 py-[11px] text-[14px] font-bold transition sm:w-auto sm:max-w-none sm:px-6 sm:py-[13px] xl:px-7 xl:text-[15px]"
          >
            <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#072C0E] text-white">
              <Play className="ml-0.5 h-3 w-3 fill-current" />
            </span>
            {t.ctaSecondary}
          </a>
        </div>
      </div>

      {/* -- Stage: Earth + orbits + cards --
          lg+: a 1860x678 design box that holds the WHOLE Earth (and the turbines
          above it) and is as wide as the viewport height allows (hero.css), so the
          complete composition is in the first screen. Below lg: stacked. */}
      <div className="hero-stage relative mx-auto mt-3 w-full max-w-[1720px] px-4 sm:mt-8 sm:px-6 lg:mt-3 lg:aspect-[1860/678] lg:px-0 lg:[container-type:inline-size]">
        {/* Earth box: its own container so the artwork scales with the box. On a
            short phone the box is also limited by the screen height (about what is
            left under the text) so the Earth never swallows the whole first screen. */}
        <div className="relative mx-auto aspect-[100/79] w-full max-w-[max(200px,min(520px,calc((100svh-340px)*1.15)))] overflow-hidden [container-type:inline-size] lg:absolute lg:left-[32.97%] lg:top-[14.45%] lg:mx-0 lg:aspect-square lg:w-[31.18%] lg:max-w-none lg:overflow-visible">
          <EarthIllustration label={t.earthLabel} onActivate={activate} />

          {/* below lg: dashed ring + six icon nodes around the Earth */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 lg:hidden">
            <MobileOrbitRing />
            {CATEGORIES.map(c => (
              <CategoryNode
                key={c.key}
                icon={c.icon}
                accent={c.accent}
                index={c.order}
                className="w-[clamp(30px,11cqw,44px)]"
                style={{ left: `${c.mobile.x}cqw`, top: `${c.mobile.y}cqw` }}
                active={activeKey === c.key}
                onSelect={() => setSelectedKey(c.key)}
                onActiveChange={activeFor(c.key)}
              />
            ))}
          </div>

          {/* below lg: soften the crop into the next section */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[16%] bg-gradient-to-t from-white to-transparent lg:hidden" />
        </div>

        {/* lg+: dashed orbit arcs, connectors and category nodes in stage coordinates */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] hidden lg:block">
          <DesktopOrbits />
          {CATEGORIES.map(c => (
            <CategoryNode
              key={c.key}
              icon={c.icon}
              accent={c.accent}
              index={c.order}
              className="lg:w-[clamp(34px,3.07cqw,58px)]"
              style={{ left: `${c.node.x}%`, top: `${c.node.y}%` }}
              active={activeKey === c.key}
              onSelect={() => setSelectedKey(c.key)}
              onActiveChange={activeFor(c.key)}
            />
          ))}
        </div>

        <ul
          aria-label={t.groupLabel}
          className="relative z-10 mx-auto mt-3 grid max-w-[760px] grid-flow-col grid-rows-3 gap-2 sm:grid-flow-row sm:grid-cols-3 sm:grid-rows-none sm:gap-3 lg:static lg:mt-0 lg:block lg:max-w-none"
        >
          {CATEGORIES.map(c => (
            <MetricCard
              key={c.key}
              icon={c.icon}
              label={c.label[lang] ?? c.label.en}
              value={c.value}
              accent={c.accent}
              bars={c.bars}
              index={c.order}
              className={`lg:absolute lg:z-10 ${c.card}`}
              active={activeKey === c.key}
              actionLabel={t.openDetails}
              onSelect={() => setSelectedKey(c.key)}
              onActiveChange={activeFor(c.key)}
            />
          ))}
        </ul>
      </div>

      <MetricDialog category={selected} lang={lang} t={t} onClose={() => setSelectedKey(null)} />
    </section>
  );
}
