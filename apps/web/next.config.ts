import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
if (process.env.VERCEL && (!apiUrl || apiUrl.includes('localhost') || !apiUrl.includes('/api/v1'))) {
  throw new Error(
    'Set NEXT_PUBLIC_API_URL on Vercel to your Render API including /api/v1, e.g. https://your-api.onrender.com/api/v1 — then Redeploy. localhost is only for local next dev.',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@playaround/api-client', '@playaround/contracts', '@playaround/design-tokens'],
};

export default nextConfig;
