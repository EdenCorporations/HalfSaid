/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source; Next transpiles them.
  transpilePackages: ['@halfsaid/shared-types', '@halfsaid/safety-policy', '@halfsaid/ui-tokens'],
};

export default nextConfig;
