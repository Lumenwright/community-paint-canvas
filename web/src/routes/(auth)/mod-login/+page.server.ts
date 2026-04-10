// Mod login page server: checks existing session and initiates PKCE flow.
// If already authenticated as mod/broadcaster, redirects to /mod immediately.
// The default form action sets the oauth_state CSRF cookie and redirects to Twitch authorize URL.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types.js';
import { TWITCH_CLIENT_ID } from '$env/static/private';
import { MOD_REDIRECT_URI } from '$lib/server/twitch-oauth.js';

export const load: PageServerLoad = async (event) => {
  const session = event.locals.session;
  // Already authenticated as mod or broadcaster — skip the login page
  if (session && (session.is_mod || session.is_broadcaster)) {
    throw redirect(303, '/mod');
  }
  return {
    error: event.url.searchParams.get('error')
  };
};

export const actions: Actions = {
  default: async (event) => {
    // Generate a random state value for CSRF protection on the OAuth flow
    const state = crypto.randomUUID();
    event.cookies.set('oauth_state', state, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 10,
      // secure: false for localhost dev; the SvelteKit adapter sets secure in prod
      secure: false
    });
    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      redirect_uri: MOD_REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
      state
    });
    throw redirect(302, `https://id.twitch.tv/oauth2/authorize?${params}`);
  }
};
