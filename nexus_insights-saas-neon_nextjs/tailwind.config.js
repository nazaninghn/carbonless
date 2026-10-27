/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Carbonless brand palette — single green scale (50-950).
        // Source of truth for every brand color; the legacy citron/mint
        // aliases below map onto this same scale.
        green: {
          50:  '#F1FCF2',
          100: '#DEFAE1',
          200: '#B2F2BB',
          300: '#8BEA99',
          400: '#51D766',
          500: '#2ABD41',
          600: '#1D9C31',
          700: '#1A7B2A',
          800: '#1A6126',
          900: '#175022',
          950: '#072C0E',
        },
        citron:    '#51D766',   // green-400 — secondary accent, badges
        'citron-light': '#8BEA99',
        'citron-dark': '#2ABD41',
        mint:      '#2ABD41',   // green-500 — primary CTAs, AI, success
        'mint-light': '#8BEA99',
        'mint-dark': '#1D9C31',
        smoke:     '#F5F5F5',   // Background (neutral, kept)
        'smoke-dark': '#ebebeb',
        // ── Semantic roles (prefer these over raw hex in components) ──
        // Primary / CTA. `bg-primary`, `text-primary`, `ring-primary` use DEFAULT.
        primary: {
          DEFAULT: '#2ABD41',   // green-500
          hover:   '#1D9C31',   // green-600
          active:  '#1A7B2A',   // green-700
          soft:    '#F1FCF2',   // green-50
        },
        secondary: '#51D766',   // green-400 — secondary accents, badges
        accent:    '#1D9C31',
        ink:       '#072C0E',   // green-950 — deep / ink, dark buttons, footer
        heading:   '#175022',   // green-900 — headings, body text
        line:      '#DEFAE1',   // green-100 — borders & dividers
        glow:      '#8BEA99',   // green-300 — light accent, subtle glow
        surface: {
          DEFAULT: '#FFFFFF',   // cards & panels
          soft:    '#F1FCF2',   // green-50 — soft section backgrounds
          app:     '#F5F5F5',   // app background
        },
        // Status — always pair with an icon or text label, never color alone.
        // Error and warning keep their conventional red / amber hues so they
        // stay distinguishable from success (green) and neutral info.
        success: { DEFAULT: '#2ABD41', soft: '#F1FCF2', border: '#B2F2BB', text: '#1A6126' },
        danger:  { DEFAULT: '#DC2626', hover: '#B91C1C', soft: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
        warning: { DEFAULT: '#F59E0B', soft: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
        info:    { DEFAULT: '#475569', soft: '#F5F5F5', border: 'rgba(71, 85, 105, 0.25)', text: '#1E293B' },
        // Neutral UI tokens
        graphite:  '#475569',   // muted text & icons
        slate:     '#1E293B',   // strong neutral contrast
        mist:      '#F5F5F5',
        sky:       '#F5F5F5',
        dark:      '#072C0E',   // green-950
      },
      fontFamily: {
        "inter": ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
        'card': '0 4px 25px -5px rgba(0, 0, 0, 0.06), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        'glow': '0 0 30px rgba(42, 189, 65, 0.1)',
      },
      backgroundImage: {
        // Brand gradient (also exposed as the `.gradient-text` utility)
        'brand-gradient': 'linear-gradient(135deg, #175022 0%, #8BEA99 100%)',
      },
      keyframes: {
        shimmer: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
