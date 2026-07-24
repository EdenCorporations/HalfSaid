import { handleFederatedAggregate } from '@halfsaid/api';
import { getApiDeps } from '@/lib/api-deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function POST(req: Request): Promise<Response> {
  return handleFederatedAggregate(req, getApiDeps());
}
