import Image from 'next/image';
import { SAMPLE_REPORT } from './heroContent';

/* -- The report preview: a miniature of the ISO 14064-1 PDF report, tilted a little, beside the Earth --
   Every number is an ILLUSTRATIVE SAMPLE (heroContent.js: SAMPLE_REPORT), says so on the panel and is never customer data;
   nothing here is calculated. The panel is one labelled image for assistive technology (the charts are drawn with
   plain markup, no library). All sizes are in units of the panel's own width (hero.css: --ru = 100cqw / 234), so it
   scales as a whole wherever it stands. The tilt is on the outer box (hero.css), the entrance animation on the sheet. */
const DONUT_COLORS = ['#119a2e', '#3fc257', '#9fe0a9'];

export default function HeroReport({ copy }) {
  const r = copy.report;
  const max = Math.max(...SAMPLE_REPORT.monthly);
  let offset = 0;

  return (
    <div role="img" aria-label={`${r.label}: ${r.total} ${SAMPLE_REPORT.total} tCO₂e`} data-testid="hero-report" className="hero-report">
      <div aria-hidden="true" className="hero-report-sheet">
        <div className="hero-report-top">
          <span className="hero-report-brand">
            <Image src="/carbonless.png" alt="" width={32} height={32} className="hero-report-logo" />Carbonless
          </span>
          <span className="hero-report-iso">{r.standard}</span>
        </div>

        <p className="hero-report-title">{r.title}</p>
        <p className="hero-report-period">{r.period}: {r.periodValue}</p>

        <div className="hero-report-total">
          <div>
            <p className="hero-report-label">{r.total}</p>
            <p className="hero-report-value">{SAMPLE_REPORT.total}<span> tCO₂e</span></p>
          </div>
          <p className="hero-report-delta"><b>↓ {SAMPLE_REPORT.deltaPct}%</b>{r.delta}</p>
        </div>

        <div className="hero-report-split">
          <div className="hero-report-donutbox">
            <svg viewBox="0 0 36 36" className="hero-report-donut">
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#edf5ee" strokeWidth="5" />
              {SAMPLE_REPORT.scopes.map((s, i) => {
                const seg = (
                  <circle key={i} cx="18" cy="18" r="15.9155" fill="none" stroke={DONUT_COLORS[i]} strokeWidth="5"
                    strokeDasharray={`${s.pct - 1} ${101 - s.pct}`} strokeDashoffset={-offset} transform="rotate(-90 18 18)" />
                );
                offset += s.pct;
                return seg;
              })}
            </svg>
            <span className="hero-report-donut-text"><b>{SAMPLE_REPORT.total}</b>tCO₂e</span>
          </div>
          <ul className="hero-report-legend">
            {SAMPLE_REPORT.scopes.map((s, i) => (
              <li key={i}>
                <i style={{ background: DONUT_COLORS[i] }} />
                <span>{r.scopes[i]}</span><span>{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="hero-report-label hero-report-trend">{r.trend}</p>
        <div className="hero-report-bars">
          {SAMPLE_REPORT.monthly.map((v, i) => (
            <span key={i} className="hero-report-bar" data-last={i === SAMPLE_REPORT.monthly.length - 1}>
              <i style={{ height: `${(v / max) * 100}%` }} />
              <em>{r.months[i]}</em>
            </span>
          ))}
        </div>

        <p className="hero-report-sample">{r.sample}</p>
      </div>
    </div>
  );
}
