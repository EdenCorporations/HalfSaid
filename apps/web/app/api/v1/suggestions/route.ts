import { handleSuggestions } from '@halfsaid/api';
import { getApiDeps } from '@/lib/api-deps';

// Node runtime — the handler uses node:crypto and (in mock mode) PGlite.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request): Promise<Response> {
  return handleSuggestions(req, getApiDeps());
}
