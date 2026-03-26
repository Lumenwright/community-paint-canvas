// POST /api/auth/ext-handoff — Extension sends its JWT, server returns a 60s signed handoff token.
// The Extension opens https://drawing-site.com/?auth=<token> which sets the session cookie
// and redirects to the clean URL. No separate login prompt for Extension users.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireExtJWT } from '$lib/server/auth.js';
import { signHandoffToken } from '$lib/server/twitch-jwt.js';
import { SESSION_SECRET } from '$env/static/private';

export const POST: RequestHandler = async (event) => {
  const jwt = await requireExtJWT(event);

  // Extensions can send a JWT where twitch_user_id may be absent for anonymous viewers.
  // Only allow logged-in users to obtain a handoff token.
  if (!jwt.twitch_user_id || jwt.role === 'viewer') {
    // In practice the Extension should only call this for logged-in viewers,
    // but guard defensively.
    const userId = jwt.twitch_user_id;
    if (!userId) throw error(401, 'Twitch user ID not present in Extension JWT');
  }

  const token = await signHandoffToken(
    {
      twitch_user_id: jwt.twitch_user_id,
      // opaque_user_id is used when twitch_user_id is absent; here we prefer the real ID
      username: jwt.twitch_user_id
    },
    SESSION_SECRET
  );

  return json({ token });
};
