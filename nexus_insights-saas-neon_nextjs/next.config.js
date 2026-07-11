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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",       // Tailwind requires unsafe-inline
              "img-src 'self' data: blob: https://images.unsplash.com",
              "font-src 'self' data:",
              "connect-src 'self' https: http://localhost:8000 http://localhost:3000",
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
