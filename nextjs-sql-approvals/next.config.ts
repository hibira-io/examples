import type { NextConfig } from 'next';

// A hosted demo build (NEXT_PUBLIC_DEMO_API set) is a static export for
// GitHub Pages: only the *.demo.tsx files are routes there, so the API
// routes, which need the app secret, are left out.
const demo = Boolean(process.env.NEXT_PUBLIC_DEMO_API);
const basePath = process.env.DEMO_BASE_PATH || '';

const nextConfig: NextConfig = {
  devIndicators: false,
  // sql.js loads its WebAssembly file from the base path.
  env: { NEXT_PUBLIC_BASE_PATH: demo ? basePath : '' },
  ...(demo
    ? {
        output: 'export',
        basePath: basePath || undefined,
        pageExtensions: ['demo.tsx', 'demo.ts'],
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
