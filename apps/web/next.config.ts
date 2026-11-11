import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
if (process.env.VERCEL && (!apiUrl.trim() || apiUrl.includes('localhost'))) {
  throw new Error(
    'Set NEXT_PUBLIC_API_URL on Vercel (Production + Preview) to https://play-around-bikf.onrender.com or https://play-around-bikf.onrender.com/api/v1 — then Redeploy. localhost is only for local next dev.',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@playaround/api-client', '@playaround/contracts', '@playaround/design-tokens', '@clerk/nextjs'],
};

export default nextConfig;
