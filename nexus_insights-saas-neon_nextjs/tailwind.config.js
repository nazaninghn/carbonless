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
        // Carbonless brand palette — Citron + Mint + White Smoke
        citron:    '#C9C858',   // Primary accent — CTAs, badges, highlights
        'citron-light': '#d6d67a',
        'citron-dark': '#a8a73a',
        mint:      '#53A67F',   // Primary — AI, success, nature
        'mint-light': '#6dba95',
        'mint-dark': '#3d8564',
        smoke:     '#F5F5F5',   // Background
        'smoke-dark': '#ebebeb',
        // Legacy aliases (for backward compat with existing components)
        primary:   '#53A67F',
        secondary: '#C9C858',
        accent:    '#3d8564',
        // Neutral UI tokens
        graphite:  '#475569',
        slate:     '#1E293B',
        mist:      '#F5F5F5',
        sky:       '#F5F5F5',
        dark:      '#1a1a1a',
      },
      fontFamily: {
        "inter": ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -4px rgba(0, 0, 0, 0.03)',
        'card': '0 4px 25px -5px rgba(0, 0, 0, 0.06), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        'glow': '0 0 30px rgba(34, 197, 94, 0.1)',
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
