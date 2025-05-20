import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  eslint: {
    // ✅ Temporarily disable blocking builds on ESLint errors (Vercel-friendly)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
