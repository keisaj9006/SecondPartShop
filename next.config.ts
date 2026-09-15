import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
const supabaseWebSocketOrigin = supabaseOrigin?.replace(/^https:/, "wss:").replace(/^http:/, "ws:") ?? null;
const isPreview = process.env.VERCEL_ENV === "preview";
const isDevelopment = process.env.NODE_ENV === "development";

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ...(isPreview ? ["https://vercel.live"] : []),
];

const styleSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isPreview ? ["https://vercel.live"] : []),
];

const imageSources = [
  "'self'",
  "data:",
  "blob:",
  ...(supabaseOrigin ? [supabaseOrigin] : []),
  ...(isPreview ? ["https://vercel.live", "https://vercel.com"] : []),
];

const fontSources = [
  "'self'",
  "data:",
  ...(isPreview ? ["https://vercel.live", "https://assets.vercel.com"] : []),
];

const connectSources = [
  "'self'",
  ...(supabaseOrigin ? [supabaseOrigin] : []),
  ...(supabaseWebSocketOrigin ? [supabaseWebSocketOrigin] : []),
  ...(isPreview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
];

const frameSources = isPreview ? ["https://vercel.live"] : ["'none'"];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${scriptSources.join(" ")}`,
  `style-src ${styleSources.join(" ")}`,
  `img-src ${imageSources.join(" ")}`,
  `font-src ${fontSources.join(" ")}`,
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  `frame-src ${frameSources.join(" ")}`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Listing forms support up to 6 product images at 5 MB each plus multipart overhead.
      bodySizeLimit: "35mb",
    },
  },
  images: {
    remotePatterns: supabaseUrl
      ? [{ protocol: "https", hostname: new URL(supabaseUrl).hostname }]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
