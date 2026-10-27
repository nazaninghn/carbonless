'use client';

import { useRef } from 'react';
import Image from 'next/image';

const clamp = v => Math.max(-1, Math.min(1, v));

/* The Earth centrepiece: the project's own 3D-rendered hero artwork
   (public/herosection..png, 1536x1024 RGBA — shipped as herosection-earth.webp,
   a near-lossless WebP of the same pixels with the alpha kept exact, so the
   hero doesn't download a 2.2 MB PNG; the original file is untouched). It is a
   single rendered still — an isolated globe with trees, wind turbines, solar
   panels, clouds and a flag — not a 3D model, so it is never spun or mapped
   onto a sphere. The "living" feel comes from independent, stacked motions
   (hero.css):
     float  (outer)   a slow vertical drift
     rock   (middle)  a slow CLOCKWISE conical precession, <=7deg — a lean that
                      travels round the globe, not a spin
     tilt   (inner)   the short reaction played when the Earth is activated
   plus a lit/shaded side that travels clockwise in step with the lean, a
   breathing glow and a pulsing marker. Each motion sits on its own element so
   their transforms multiply and never overwrite each other.

   Geometry measured from the artwork (1536x1024): the planet body is ~900px
   across, centred at (752, 542); the visible art (trees, turbines, panels —
   ignoring a few tiny bird specks) spans x 256-1330, so it sits ~41px right of
   the body's centre. The image is sized from the body diameter D, which is what
   the orbit nodes/arcs are laid out around (cqw = 1% of the Earth box):
     below lg  D = 56cqw, body centre at (47.5, 55)cqw  (art centred in the box)
     lg+       D = 100cqw (the box), body centre at (50, 50)cqw; the box itself is
               shifted 4.6cqw left in HeroSection so the visible art, not the
               body, is centred on the stage.

   Interaction: a transparent <button> covers the body. It is a real control
   (keyboard Enter/Space, touch, mouse, visible focus ring) with an accessible
   name; the picture itself stays decorative (alt=""). */
export default function EarthIllustration({ label, onActivate }) {
  const tiltRef = useRef(null);

  const handleClick = e => {
    const box = e.currentTarget.getBoundingClientRect();
    // Pointer clicks tilt toward where they landed (the pressed side dips away);
    // keyboard activation (detail === 0) uses a fixed, gentle tilt.
    let nx = 0.5;
    let ny = -0.3;
    if (e.detail > 0 && box.width > 0 && box.height > 0) {
      nx = clamp((e.clientX - (box.left + box.width / 2)) / (box.width / 2));
      ny = clamp((e.clientY - (box.top + box.height / 2)) / (box.height / 2));
    }
    onActivate(() => {
      const el = tiltRef.current;
      if (!el) return;
      el.style.setProperty('--hero-ry', `${(nx * 8).toFixed(2)}deg`);
      el.style.setProperty('--hero-rx', `${(-ny * 8).toFixed(2)}deg`);
    });
  };

  return (
    <>
      {/* soft green glow behind the sphere (breathes slowly) */}
      <div
        aria-hidden="true"
        className="hero-glow pointer-events-none absolute left-[47.5%] top-[21cqw] h-[68cqw] w-[68cqw] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(42,189,65,0.14),rgba(42,189,65,0)_68%)] lg:top-[-6cqw] lg:h-[112cqw] lg:w-[112cqw]"
      />

      {/* glow ring that radiates from the sphere on activation */}
      <div
        aria-hidden="true"
        className="hero-burst pointer-events-none absolute left-[19.5cqw] top-[27cqw] h-[56cqw] w-[56cqw] rounded-full border-2 border-[#2ABD41]/60 shadow-[0_0_40px_rgba(42,189,65,0.45)] lg:left-0 lg:top-0 lg:h-[100cqw] lg:w-[100cqw]"
      />

      {/* the artwork. Its box is reserved via aspect-ratio, so nothing here can
          shift the layout. */}
      <div className="hero-earth-float pointer-events-none absolute left-[0.7cqw] top-[21.3cqw] aspect-[1536/1024] w-[95.6cqw] lg:left-[-33.5cqw] lg:top-[-10.2cqw] lg:w-[170.7cqw]">
        <div className="hero-earth-rock">
          <div ref={tiltRef} className="hero-tilt relative">
            <Image
              src="/herosection-earth.webp"
              alt=""
              width={1536}
              height={1024}
              priority
              sizes="(min-width: 1024px) 40vw, 95vw"
              className="block h-auto w-full max-w-none select-none"
            />

            {/* light and shade that travel clockwise round the globe: a circle just
                inside the body (55.1% of the artwork wide) clips a layer that turns
                once per rock cycle, so the lit side follows the lean. Light only
                ever crosses the planet, never the empty space around it. */}
            <div aria-hidden="true" className="hero-sheen pointer-events-none absolute left-[21.4%] top-[11.6%] aspect-square w-[55.1%] overflow-hidden rounded-full">
              <div className="hero-sheen-spin absolute inset-0" />
            </div>

            {/* "touch here" marker over Europe (the flag stays unobscured) */}
            <span
              aria-hidden="true"
              className="hero-hotspot pointer-events-none absolute left-[50.1%] top-[25.6%] aspect-square w-[1.8%] min-w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgba(255,255,255,0.45),0_0_12px_rgba(255,255,255,0.9)]"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label={label}
        onClick={handleClick}
        className="absolute left-[19.5cqw] top-[27cqw] h-[56cqw] w-[56cqw] cursor-pointer touch-manipulation rounded-full outline-offset-[6px] transition-shadow hover:shadow-[0_0_0_2px_rgba(42,189,65,0.28)] lg:left-0 lg:top-0 lg:h-[100cqw] lg:w-[100cqw]"
      />
    </>
  );
}
