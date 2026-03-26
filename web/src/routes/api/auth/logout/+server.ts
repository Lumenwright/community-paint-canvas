// POST /api/auth/logout — clears the session cookie.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { COOKIE_NAME } from '$lib/server/session.js';

export const POST: RequestHandler = async (event) => {
  event.cookies.delete(COOKIE_NAME, { path: '/' });
  return json({ ok: true });
};
