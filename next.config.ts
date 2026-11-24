import type { NextConfig } from "next";

const supabaseHostname = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return raw ? new URL(raw).hostname : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
