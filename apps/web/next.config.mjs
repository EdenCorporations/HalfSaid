import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Secrets live in the monorepo-root .env (see .env.example). Next only reads env
// files from the app dir, so load the root .env / .env.local here. Shell env wins.
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
for (const file of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(join(rootDir, file), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[1] && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* file absent — fine */
  }
}

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
  // PGlite (WASM, mock DB) and pg (native-ish, real DB) stay external to the server
  // build.
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
};

export default nextConfig;
