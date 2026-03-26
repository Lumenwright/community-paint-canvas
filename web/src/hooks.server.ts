// Server hooks: parse the session cookie into event.locals.session on every request,
// and add CORS headers to allow requests from the Twitch Extension CDN.
import type { Handle } from '@sveltejs/kit';
import { parseSessionCookie, COOKIE_NAME } from '$lib/server/session.js';

const ALLOWED_ORIGINS = [
  // Twitch Extension CDN (replace <client-id> with actual extension client ID in prod)
  /^https:\/\/[a-z0-9]+\.ext-twitch\.tv$/,
  // Twitch Extension Developer Rig
  /^https:\/\/localhost\.rig\.twitch\.tv(:\d+)?$/,
  // Local dev
  /^http:\/\/localhost(:\d+)?$/
];

export const handle: Handle = async ({ event, resolve }) => {
  // Populate session from signed cookie
  const cookieValue = event.cookies.get(COOKIE_NAME);
  event.locals.session = cookieValue ? await parseSessionCookie(cookieValue) : null;

  const response = await resolve(event);

  // CORS for API routes accessed from the Extension panel
  const origin = event.request.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.some((re) => re.test(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Vary', 'Origin');
  }

  return response;
};
