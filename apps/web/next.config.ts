import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL ?? 'http://localhost:3333';

const nextConfig: NextConfig = {
  transpilePackages: ['@reading-tracker/shared'],
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
