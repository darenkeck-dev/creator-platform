import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@media-manager/contracts", "@media-manager/shared"],
};

export default nextConfig;
