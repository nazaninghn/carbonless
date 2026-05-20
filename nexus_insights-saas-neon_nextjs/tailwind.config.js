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
        // Clean Atmosphere + Minimalist Tech
        primary: '#22C55E',       // Leaf Green - CTAs, success
        mint: '#2DD4BF',          // Mint Tech - accent
        indigo: '#818CF8',        // Soft Indigo - secondary accent
        sky: '#F8FAFC',           // Sky White - main bg
        glacier: '#E0F2FE',       // Glacier Blue - card bg
        graphite: '#475569',      // Graphite Grey - body text
        slate: '#1E293B',         // Deep text
        mist: '#F1F5F9',         // Subtle bg sections
        // Backward compat
        secondary: '#2DD4BF',
        accent: '#22C55E',
        dark: '#1E293B',
      },
      fontFamily: {
        "inter": ["Inter", "sans-serif"],
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
