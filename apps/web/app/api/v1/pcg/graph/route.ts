import { handleGraph } from '@halfsaid/api';
import { getApiDeps } from '@/lib/api-deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return handleGraph(req, getApiDeps());
}
