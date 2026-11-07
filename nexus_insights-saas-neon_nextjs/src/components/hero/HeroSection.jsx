'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HERO_COPY } from './heroContent';
import { HeroCards, HeroLinks, HeroRings } from './HeroOrbits';
import HeroReport from './HeroReport';
import ScopePopover from './ScopePopover';
import useHeroMotion from './useHeroMotion';
import './hero.css';

/* -- Landing-page hero (pure white) --
   Left: the label, the two-line headline, one short sentence and the two calls to action, nothing else. At the foot, a quiet
   mouse-shaped scroll cue that leads to About. Right: one stage
   with the three Scope cards, the Earth (public/globalnew-hero.webp) inside measurement ticks and three slowly turning
   orbital rings, and the tilted sample report preview beside it.

   The stage (.hero-visual) has a fixed aspect ratio and everything in it is placed in the stage's own units (see
   heroContent.js, STAGE / EARTH), so the Earth, the rings and the connector lines stay aligned at every size and
   nothing shifts while the image loads. The Earth floats a few pixels and the rings turn (hero.css); all of it pauses
   when the hero is off screen or the tab is hidden (useHeroMotion -> data-hero-motion) and is removed with
   prefers-reduced-motion.

   Layout: 1240+ the cards stand left of the globe and the report right of it; below that the stage is the globe alone,
   and the cards (a row from 600, a short column on phones) and then the report follow it. */
export default function HeroSection() {
  const { language: lang } = useLanguage();
  const t = HERO_COPY[lang] ?? HERO_COPY.en;

  const sectionRef = useRef(null);
  const motion = useHeroMotion(sectionRef);

  // a click on the globe enlarges it in place, only slightly (12%, hero.css); clicking it again, Escape, or a click
  // anywhere outside the globe puts it back. No overlay: the page, the cards and the Header stay as they are.
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    if (!zoomed) return undefined;
    const onDown = e => { if (!e.target.closest('[data-testid="hero-earth-btn"]')) setZoomed(false); };
    const onKey = e => { if (e.key === 'Escape') setZoomed(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [zoomed]);
  const openerRef = useRef(null);

  // the Scope popover (non-modal): which Scope is open, and the layout it sits in (beside the card / under the row / under the card)
  const visualRef = useRef(null);
  const [scope, setScope] = useState(null);
  const [mode, setMode] = useState('phone');
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1240px)'), tablet = window.matchMedia('(min-width: 600px)');
    const update = () => setMode(wide.matches ? 'wide' : tablet.matches ? 'tablet' : 'phone');
    update();
    wide.addEventListener('change', update); tablet.addEventListener('change', update);
    return () => { wide.removeEventListener('change', update); tablet.removeEventListener('change', update); };
  }, []);
  const openScope = (key, opener) => { openerRef.current = opener; setScope(cur => (cur === key ? null : key)); };
  useEffect(() => {
    if (!scope) return undefined;
    const onDown = e => { if (!e.target.closest('.hero-pop, .hero-card')) setScope(null); };           // a click outside
    const onKey = e => {
      if (e.key !== 'Escape') return;
      const inside = document.activeElement?.closest?.('.hero-pop');
      setScope(null);
      if (inside) openerRef.current?.focus({ preventScroll: true });                                     // focus was in the popover: back to its card
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [scope]);
  const closePop = () => { setScope(null); openerRef.current?.focus({ preventScroll: true }); };
  const popover = scope && <ScopePopover key={scope} scope={scope} lang={lang} copy={t} mode={mode} visualRef={visualRef} onClose={closePop} />;

  // the scroll cue: a smooth scroll to the top of About (instant with reduced motion); without script the #about link still jumps there
  const goAbout = e => {
    const target = document.getElementById('about');
    if (!target) return;
    e.preventDefault();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#about');
  };

  return (
    <section
      ref={sectionRef}
      data-hero-motion={motion}
      data-lang={lang}
      aria-labelledby="hero-heading"
      className="hero-root relative isolate"
    >
      <div className="hero-inner">
        <div className="hero-grid">
          <div className="hero-copy">
            <p data-testid="hero-eyebrow" className="hero-eyebrow">{t.eyebrow}</p>

            <h1 id="hero-heading" data-testid="hero-h1" className="hero-h1">
              <span className="hero-line block">{t.title.line1}</span>
              {' '}
              <span className="hero-line hero-line-2 block">
                {t.title.line2}
                <svg aria-hidden="true" focusable="false" viewBox="0 0 220 14" preserveAspectRatio="none" className="hero-swoosh">
                  <path d="M3 10 C 52 3, 130 2, 217 8" fill="none" stroke="#2abd41" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="hero-desc">{t.desc}</p>

            <div className="hero-ctas">
              <Link
                href="/register"
                className="hero-cta flex items-center justify-center gap-2 rounded-full btn-primary-dark px-6 text-[15px] font-bold transition sm:px-8"
              >
                {t.ctaPrimary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/features" className="hero-cta-secondary flex items-center justify-center text-[15px] font-semibold text-green-950">
                {t.ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="hero-vcell">
            <div ref={visualRef} className="hero-visual">
              {/* Decorative stage, centred on the globe. The headline and cards carry all the meaning. */}
              <div data-testid="hero-stage" className="hero-stage">
                <HeroRings />
                <div data-testid="hero-earth" className="hero-earth" data-zoomed={zoomed}>
                  {/* only the picture floats; the box and the button stay put */}
                  <div data-testid="hero-earth-spin" className="hero-earth-spin">
                    <Image
                      src="/globalnew-hero.webp"
                      alt=""
                      width={1254}
                      height={1254}
                      priority
                      sizes="(min-width: 1240px) 430px, 90vw"
                      className="block h-auto w-full max-w-none select-none"
                    />
                  </div>
                  {/* a round hit area on the globe itself (not its transparent corners), so it never fights the rings or cards */}
                  <button type="button" data-testid="hero-earth-btn" className="hero-earth-btn" aria-label={t.ui.earthOpen} aria-pressed={zoomed}
                    onClick={() => setZoomed(z => !z)} />
                </div>
              </div>

              <HeroLinks />
              <HeroCards copy={t.scopes} label={t.scopesLabel} opens={t.ui.opens} active={scope} mode={mode} popover={popover} onOpen={openScope} />
              {mode === 'wide' && popover}
              <HeroReport copy={t} />
            </div>
          </div>
        </div>

        <a href="#about" data-testid="hero-scroll" className="hero-scroll" onClick={goAbout}>
          <span aria-hidden="true" className="hero-mouse"><span className="hero-mouse-wheel" /></span>
          <span className="hero-scroll-label">{t.scroll}</span>
        </a>
      </div>
    </section>
  );
}
