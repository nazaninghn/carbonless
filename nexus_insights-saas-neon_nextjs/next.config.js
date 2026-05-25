/** @type {import('next').NextConfig} */
const nextConfig = {
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
              // Fix 25F: removed 'unsafe-eval' — Next.js 15 only needs unsafe-inline for
              // hydration chunks, not eval. Keeping eval widens the XSS attack surface.
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",       // Tailwind requires unsafe-inline
              "img-src 'self' data: blob: https://images.unsplash.com",
              "font-src 'self' data:",
              "connect-src 'self' https: http://localhost:8000",  // covers backend API + any HTTPS fetch
              "frame-ancestors 'none'",                 // belt-and-suspenders alongside X-Frame-Options
              "base-uri 'self'",
              "form-action 'self' mailto:",             // mailto: needed for contact form
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
