/** Small HTTP helpers over the Web Fetch Response. */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function apiError(message: string, status: number, code?: string): Response {
  return json({ error: message, code }, status);
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: allowed.join(', ') },
  });
}
