import type { NextConfig } from 'next';

// A hosted demo build (NEXT_PUBLIC_DEMO_API set) is a static export for
// GitHub Pages: only the *.demo.tsx files are routes there, so the API
// routes, which need the app secret, are left out.
const demo = Boolean(process.env.NEXT_PUBLIC_DEMO_API);

const nextConfig: NextConfig = demo
  ? {
      env: { NEXT_PUBLIC_BASE_PATH: process.env.DEMO_BASE_PATH || '' },
      output: 'export',
      basePath: process.env.DEMO_BASE_PATH || undefined,
      pageExtensions: ['demo.tsx', 'demo.ts'],
      trailingSlash: true,
    }
  : { devIndicators: false };

export default nextConfig;
