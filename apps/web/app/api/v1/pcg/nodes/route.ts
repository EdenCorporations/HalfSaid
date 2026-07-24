import { handleNodes } from '@halfsaid/api';
import { getApiDeps } from '@/lib/api-deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request): Promise<Response> {
  return handleNodes(req, getApiDeps());
}
export function POST(req: Request): Promise<Response> {
  return handleNodes(req, getApiDeps());
}
export function PATCH(req: Request): Promise<Response> {
  return handleNodes(req, getApiDeps());
}
export function DELETE(req: Request): Promise<Response> {
  return handleNodes(req, getApiDeps());
}
