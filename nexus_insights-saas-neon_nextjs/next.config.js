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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
