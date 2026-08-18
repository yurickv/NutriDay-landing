import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy is only applied in production: in dev, Turbopack/HMR
// need inline eval and a websocket connection that a strict CSP would break.
// `'unsafe-inline'` for scripts is retained because the App Router emits inline
// hydration/bootstrap scripts and we have no nonce pipeline; everything else is
// locked to same-origin plus the LiqPay endpoints the checkout flow posts to
// and the GA4/PostHog analytics endpoints (EU PostHog cloud).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://eu-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self' data:",
  "connect-src 'self' https://www.liqpay.ua https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src https://www.liqpay.ua",
  "form-action 'self' https://www.liqpay.ua",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

// Статичні AVIF версіонуються іменем файлу (домовленість: заміна картинки =
// нове ім'я), тому їм безпечно давати immutable-кеш на рік.
const immutableCacheHeader = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  images: {
    // Вихідні AVIF без цього перекодовуються в (частіше більший) WebP.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400, // 31 доба
  },
  async headers() {
    return [
      {
        // Apply to every route.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Лише файли картинок квізу, НЕ сторінки /onboarding/[step].
        source: "/onboarding/:file(.*\\.avif)",
        headers: immutableCacheHeader,
      },
      {
        // Скріншоти слайдера в корені public: /example-1.avif … /example-7.avif.
        source: "/:file(example-.*\\.avif)",
        headers: immutableCacheHeader,
      },
    ];
  },
};

// withPWA is a webpack plugin: applying it under `next dev --turbopack`
// only triggers the "Webpack is configured while Turbopack is not" warning,
// and the plugin is disabled in dev anyway — so wrap the config in prod only.
export default isProd
  ? withPWA({
      dest: "public",
      register: true,
      workboxOptions: {
        skipWaiting: true,
        disableDevLogs: true,
      },
    })(nextConfig)
  : nextConfig;
