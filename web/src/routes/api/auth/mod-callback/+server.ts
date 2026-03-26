// GET /api/auth/mod-callback — PKCE callback for moderators.
// Same as /api/auth/callback but checks the DB moderators table and marks is_mod = true.
// Broadcaster gets is_broadcaster = true (and implicitly mod-level access everywhere).
import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { createSessionCookie, COOKIE_NAME } from '$lib/server/session.js';
import {
  exchangeCodeForToken,
  fetchTwitchUser,
  MOD_REDIRECT_URI
} from '$lib/server/twitch-oauth.js';
import { BROADCASTER_TWITCH_ID } from '$env/static/private';

export const GET: RequestHandler = async (event) => {
  const code = event.url.searchParams.get('code');
  const state = event.url.searchParams.get('state');
  const storedState = event.cookies.get('oauth_state');

  if (!state) throw error(400, 'Missing state parameter');
  if (!storedState || state !== storedState) throw error(400, 'State mismatch');

  event.cookies.delete('oauth_state', { path: '/' });

  if (!code) throw redirect(302, '/mod-login?error=missing_code');

  try {
    const tokens = await exchangeCodeForToken(code, MOD_REDIRECT_URI);
    const user = await fetchTwitchUser(tokens.access_token);

    const isBroadcaster = user.id === BROADCASTER_TWITCH_ID;

    // Check moderators table (active only) unless they're the broadcaster
    let isMod = isBroadcaster;
    if (!isMod) {
      const { data } = await db
        .from('moderators')
        .select('twitch_user_id')
        .eq('twitch_user_id', user.id)
        .eq('active', true)
        .maybeSingle();
      isMod = !!data;
    }

    const sessionToken = await createSessionCookie({
      twitch_user_id: user.id,
      username: user.login,
      is_mod: isMod,
      is_broadcaster: isBroadcaster
    });

    event.cookies.set(COOKIE_NAME, sessionToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 7
    });
  } catch (e) {
    // Rethrow redirect/error instances; wrap others
    if (e && typeof e === 'object' && 'status' in e) throw e;
    throw redirect(302, '/mod-login?error=auth_failed');
  }

  throw redirect(302, '/mod');
};
