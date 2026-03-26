// GET /api/auth/callback — PKCE callback for drawing-site users (direct access fallback).
// Exchanges the code for a Twitch access token, fetches user info, sets session cookie.
// The token exchange function is injected via event.locals so tests can stub it.
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createSessionCookie, COOKIE_NAME } from '$lib/server/session.js';
import {
  exchangeCodeForToken,
  fetchTwitchUser,
  DRAWING_REDIRECT_URI
} from '$lib/server/twitch-oauth.js';

export const GET: RequestHandler = async (event) => {
  const code = event.url.searchParams.get('code');
  const state = event.url.searchParams.get('state');
  const storedState = event.cookies.get('oauth_state');

  // CSRF: state must be present and match what was stored before the redirect
  if (!state) throw error(400, 'Missing state parameter');
  if (!storedState || state !== storedState) throw error(400, 'State mismatch');

  // Clear the one-time state cookie
  event.cookies.delete('oauth_state', { path: '/' });

  if (!code) throw redirect(302, '/login?error=missing_code');

  try {
    const tokens = await exchangeCodeForToken(code, DRAWING_REDIRECT_URI);
    const user = await fetchTwitchUser(tokens.access_token);

    const sessionToken = await createSessionCookie({
      twitch_user_id: user.id,
      username: user.login,
      is_mod: false,
      is_broadcaster: false
    });

    event.cookies.set(COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
  } catch {
    throw redirect(302, '/login?error=auth_failed');
  }

  throw redirect(302, '/');
};
