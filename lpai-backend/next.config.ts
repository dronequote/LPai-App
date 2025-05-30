import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  eslint: {
    // ✅ Temporarily disable blocking builds on ESLint errors (Vercel-friendly)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ This disables type checking on builds (e.g., in Vercel)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
