import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
if (process.env.VERCEL && (!apiUrl.trim() || apiUrl.includes('localhost'))) {
  throw new Error(
    'Set NEXT_PUBLIC_API_URL on this Vercel project (Production + Preview) to https://play-around-bikf.onrender.com/api/v1 — then Redeploy. localhost is only for local next dev.',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@playaround/api-client', '@playaround/contracts', '@playaround/design-tokens'],
};

export default nextConfig;
