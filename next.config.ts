import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The form accepts a 5 MB image plus multipart field overhead.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: supabaseUrl
      ? [{ protocol: "https", hostname: new URL(supabaseUrl).hostname }]
      : [],
  },
};

export default nextConfig;
