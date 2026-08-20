/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warnings should not block production deployments
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limit referrer info sent cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Enforce HTTPS for 1 year (production only — harmless in dev)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Disable browser features not needed by the app
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Basic XSS filter for older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Content Security Policy — restricts script/style/connect sources.
          // 'unsafe-inline' for styles is required by Tailwind's runtime utilities.
          // Adjust connect-src if the backend URL changes from the default.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // accounts.google.com serves the Google Identity Services script
              // used by the "Sign in with Google" button on /login.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
              // fonts.googleapis.com/api.fontshare.com serve the CSS that
              // @font-face-declares Space Grotesk / General Sans (see the
              // <link rel="stylesheet"> tags in app/layout.jsx); their actual
              // font FILES are then fetched from fonts.gstatic.com /
              // cdn.fontshare.com — both were missing here, so the browser
              // blocked the stylesheets outright and the whole page silently
              // fell back to the default font with a CSP violation logged.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://*.googleusercontent.com",
              "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
              // Scoped to the actual backend origin — previously "https:" allowed
              // fetch/XHR to ANY https host, which would let a future XSS
              // exfiltrate data (e.g. the localStorage access token) to an
              // attacker-controlled domain instead of being contained here.
              "connect-src 'self' https://carbonless-api-kxsy.onrender.com http://localhost:8000 http://localhost:3000",
              // The rendered Google button + One Tap prompt render inside an iframe.
              "frame-src https://accounts.google.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' mailto:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
