/** @type {import('tailwindcss').Config} */
            module.exports = {
              darkMode: 'class',
              content: [
                './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
                './src/components/**/*.{js,ts,jsx,tsx,mdx}',
                './src/app/**/*.{js,ts,jsx,tsx,mdx}',
              ],
              theme: {
                extend: {
                  colors: {
                    primary: '#10b981', // green-500
                    secondary: '#059669', // green-600
                    accent: '#34d399', // green-400
                    dark: '#1a1a1a',
                  },
                  fontFamily: {
        "inter": [
                "Inter",
                "sans-serif"
        ]
},
                },
              },
              plugins:  [],
            };
