// Thin typed wrappers around fetch for test cases.
// BASE_URL defaults to the local dev server; override via env for CI.
export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:5173';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookie?: string;
  extJwt?: string;
}

// Make a request against the local dev server
export async function api(path: string, opts: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, headers = {}, cookie, extJwt } = opts;

  if (cookie) headers['Cookie'] = `session=${cookie}`;
  if (extJwt) headers['Authorization'] = `Bearer ${extJwt}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual' // don't follow redirects — test them explicitly
  });
}
