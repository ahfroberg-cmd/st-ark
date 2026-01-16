// Copyright (c) 2024 ST-ARK
// All rights reserved.
// Proprietary. See LICENSE for terms.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignorera TypeScript-fel vid build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
