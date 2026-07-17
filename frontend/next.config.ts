import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the multi-stage Docker build (copies minimal standalone server)
  output: "standalone",
};

export default nextConfig;

