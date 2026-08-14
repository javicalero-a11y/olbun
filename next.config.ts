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
  // Production only. Over a plaintext dev server this tells the browser to
  // rewrite every http:// request to https://, which nothing is listening for.
  isDev ? '' : 'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Also production only, and for a sharper reason: sent from a plaintext dev
  // server it pins localhost to HTTPS in the browser for two years, and
  // `includeSubDomains` drags every other local project down with it. The
  // browser keeps honouring it long after the server stops sending it, so the
  // only cure is clearing the browser's HSTS store by hand.
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
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
