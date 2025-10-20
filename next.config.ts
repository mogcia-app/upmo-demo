import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Firebase Functionsを除外
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'firebase-functions': 'commonjs firebase-functions',
      'firebase-admin': 'commonjs firebase-admin'
    });
    return config;
  },
};

export default nextConfig;
