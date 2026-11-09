import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@playaround/api-client', '@playaround/contracts', '@playaround/design-tokens'],
};

export default nextConfig;
