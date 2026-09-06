import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
};

export default nextConfig;
