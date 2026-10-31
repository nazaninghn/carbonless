'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { HERO_COPY } from './heroContent';
import { HeroCards, HeroClouds, HeroLeaves, HeroLinks, HeroRings } from './HeroOrbits';
import ScopePopover from './ScopePopover';
import useHeroMotion from './useHeroMotion';
import './hero.css';

/* -- Landing-page hero --
   A centred composition: the Earth (public/globalnew-hero.webp) in the upper middle, wrapped in measurement ticks and three
   slowly turning orbital rings, with the three Scope cards around it; the eyebrow, headline, text and the two
   calls to action centred below; a quiet scroll cue at the bottom.

   The stage (.hero-visual) has a fixed aspect ratio and everything in it is placed in the stage's own units (see
   heroContent.js, STAGE / EARTH), so the Earth, the rings and the connector lines stay aligned at every size and
   nothing shifts while the image loads. The Earth never animates; the rings, nodes, leaves, clouds and cards do
   (hero.css), and all of it pauses when the hero is off screen or the tab is hidden (useHeroMotion -> data-hero-motion)
   and is removed with prefers-reduced-motion.

   Layout: 1024+ the cards stand around the globe; below that the stage is the globe alone and the cards follow it
   in a row (768-1023) or a short column (phones). */
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
    const wide = window.matchMedia('(min-width: 1024px)'), tablet = window.matchMedia('(min-width: 600px)');
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

  return (
    <section
      ref={sectionRef}
      data-hero-motion={motion}
      data-lang={lang}
      aria-labelledby="hero-heading"
      className="hero-root relative isolate"
    >
      <div aria-hidden="true" className="hero-bg" />

      <div className="hero-inner">
        <div ref={visualRef} className="hero-visual">
          {/* Decorative stage, centred on the globe. The headline and cards carry all the meaning. */}
          <div data-testid="hero-stage" className="hero-stage">
            <div aria-hidden="true" className="hero-halos" />
            <HeroClouds />
            <HeroRings />
            <div data-testid="hero-earth" className="hero-earth" data-zoomed={zoomed}>
              {/* only the picture turns (about its round body's centre); the box, the glow and the button stay put */}
              <div data-testid="hero-earth-spin" className="hero-earth-spin">
                <Image
                  src="/globalnew-hero.webp"
                  alt=""
                  width={1254}
                  height={1254}
                  priority
                  sizes="(min-width: 1024px) 600px, 90vw"
                  className="block h-auto w-full max-w-none select-none"
                />
              </div>
              {/* a round hit area on the globe itself (not its transparent corners), so it never fights the rings or cards */}
              <button type="button" data-testid="hero-earth-btn" className="hero-earth-btn" aria-label={t.ui.earthOpen} aria-pressed={zoomed}
                onClick={() => setZoomed(z => !z)} />
            </div>
            <HeroLeaves />
          </div>

          <HeroLinks />
          <HeroCards copy={t.scopes} label={t.scopesLabel} opens={t.ui.opens} active={scope} mode={mode} popover={popover} onOpen={openScope} />
          {mode === 'wide' && popover}
        </div>

        <div className="hero-copy">
          <p data-testid="hero-eyebrow" className="hero-eyebrow">{t.eyebrow}</p>

          <h1 id="hero-heading" data-testid="hero-h1" className="hero-h1">
            <span className="hero-line block">{t.title.line1}</span>{' '}
            <span className="hero-line block text-[#119A2E]">{t.title.line2}</span>
          </h1>

          <p className="hero-desc">
            {t.desc.map((line, i) => <span key={i} className="hero-desc-line">{line}{' '}</span>)}
          </p>

          <div className="hero-ctas">
            <Link
              href="/register"
              className="hero-cta flex items-center justify-center gap-2 rounded-full btn-primary-dark px-6 text-[15px] font-bold transition sm:px-8"
            >
              <span className="sm:hidden">{t.ctaPrimaryShort}</span>
              <span className="hidden sm:inline">{t.ctaPrimary}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href="#ai" className="hero-cta-secondary group flex items-center gap-3 text-[15px] font-semibold text-green-950">
              <span aria-hidden="true" className="hero-play flex items-center justify-center rounded-full bg-[#119A2E] text-white">
                <Play className="ml-0.5 h-[46%] w-[46%] fill-current" />
              </span>
              {t.ctaSecondary}
            </a>
          </div>
        </div>
      </div>

      <a href="#about" data-testid="hero-scroll" className="hero-scroll">
        <span aria-hidden="true" className="hero-mouse"><span className="hero-mouse-wheel" /></span>
        <span>{t.scroll}</span>
      </a>
    </section>
  );
}
