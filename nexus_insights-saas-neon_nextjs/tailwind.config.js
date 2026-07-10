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
        // Legacy aliases (for backward compat with existing components)
        primary:   '#2ABD41',
        secondary: '#51D766',
        accent:    '#1D9C31',
        // Neutral UI tokens
        graphite:  '#475569',
        slate:     '#1E293B',
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
