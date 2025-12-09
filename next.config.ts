import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignorera ESLint-fel vid build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ignorera TypeScript-fel vid build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
