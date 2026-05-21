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
        // Carbonless brand palette
        primary:   '#95A847',   // Brand olive green — CTAs, icons, badges
        secondary: '#B4BE6A',   // Brand light olive — gradient midpoints
        accent:    '#75863B',   // Brand dark olive — gradient endpoints, hover
        mint:      '#B4BE6A',   // Alias of secondary (legacy compat)
        // Neutral UI tokens (unchanged)
        graphite:  '#475569',   // Body text
        slate:     '#1E293B',   // Deep text
        mist:      '#F1F5F9',   // Subtle bg sections
        sky:       '#F8FAFC',   // Main bg
        dark:      '#302817',   // App-specific dark brown
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
