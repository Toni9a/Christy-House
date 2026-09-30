import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Product images come from all over the web; render them as plain <img>.
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "60mb" } },
};

export default nextConfig;
