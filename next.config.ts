import type { NextConfig } from 'next';

/**
 * Security headers per SPEC §7.4. The CSP is deliberately strict; it is relaxed
 * in development only for the Next.js dev overlay and HMR (which need eval).
 *
 * Note: `unsafe-inline` for styles is currently required by Next's inlined
 * critical CSS. Tightening this to a nonce-based style-src is tracked as a
 * known gap in AGENTS.md and will be revisited in M13 (Hardening).
 */
const isDev = process.env.NODE_ENV === 'development';
const publicUrl = process.env['APP_URL'] ?? process.env['AUTH_URL'] ?? '';
const isHttpsDeployment = !isDev && publicUrl.startsWith('https://');

const csp = [
  "default-src 'self'",
  `script-src 'self' ${isDev ? "'unsafe-eval'" : ''} 'unsafe-inline'`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: http://localhost:*' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Only an HTTPS deployment may upgrade requests. Local production previews
  // still use `next start`, but serve plain HTTP and must keep their assets on
  // HTTP as well.
  isHttpsDeployment ? 'upgrade-insecure-requests' : '',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS is valid only when received through HTTPS. A production-mode preview
  // can still be a plaintext LAN server, so NODE_ENV alone is not sufficient.
  ...(isHttpsDeployment
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // OCR renders PDFs with a platform-native canvas. Bundling its .node binary
  // as JavaScript breaks production builds; Next loads it from the server's
  // installed dependencies instead, where it belongs.
  serverExternalPackages: [
    '@napi-rs/canvas',
    '@tesseract.js-data/spa',
    'tesseract.js',
    'unpdf',
  ],
  experimental: {
    // Server Actions are the only mutation entry point (SPEC §3).
    serverActions: {
      // Documents accept 50 MB; leave room for multipart framing while the
      // action itself remains the authoritative 50 MB limit.
      bodySizeLimit: '55mb',
    },
  },
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: securityHeaders }]);
  },
};

export default nextConfig;
