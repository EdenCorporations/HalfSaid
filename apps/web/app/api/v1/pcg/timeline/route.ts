import { handleTimeline } from '@halfsaid/api';
import { getApiDeps } from '@/lib/api-deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request): Promise<Response> {
  return handleTimeline(req, getApiDeps());
}
