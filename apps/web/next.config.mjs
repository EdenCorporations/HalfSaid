/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source; Next transpiles them.
  transpilePackages: [
    '@halfsaid/shared-types',
    '@halfsaid/safety-policy',
    '@halfsaid/ui-tokens',
    '@halfsaid/pcg',
    '@halfsaid/retrieval',
    '@halfsaid/api',
  ],
  // PGlite ships a WASM bundle; keep it external to the server build (mock-mode DB).
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
