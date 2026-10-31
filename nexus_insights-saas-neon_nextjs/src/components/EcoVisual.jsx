'use client';

import ArtVisual from './ArtVisual';

/* -- The Carbonless AI page's picture: public/eco.png --
   1536 x 1024, transparent, visible art x 298-1535 (the left 19% is empty, cropped via cropLeft = 280); it runs off the right, top
   and bottom edges of its canvas, so those three edges are faded (eco.css, .eco-mask). Entrance and float: see ArtVisual. */
export default function EcoVisual({ alt, className = '' }) {
  return <ArtVisual src="/eco.png" natW={1536} natH={1024} cropLeft={280} alt={alt} testId="eco" className={className} />;
}
