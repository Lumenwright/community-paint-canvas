// Mod queue review page server: validates session and guards against unauthenticated access.
// Uses redirect (not requireMod which throws error()) so unauthenticated users get a clean
// redirect to the login page rather than a generic error boundary.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  const session = event.locals.session;
  // Only mod and broadcaster roles may access the queue review page
  if (!session || (!session.is_mod && !session.is_broadcaster)) {
    throw redirect(303, '/mod-login');
  }
  // Return only the fields needed by the page — avoids leaking twitch_user_id or is_mod flag
  return {
    username: session.username,
    is_broadcaster: session.is_broadcaster
  };
};
