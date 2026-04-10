// Broadcaster settings page server: validates broadcaster session and loads initial data.
// Uses redirect (not requireBroadcaster which throws error()) for a clean UX redirect.
// Loads settings and active moderators server-side — these change infrequently vs. the queue.
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { db } from '$lib/server/supabase.js';

export const load: PageServerLoad = async (event) => {
  const session = event.locals.session;
  // Only the broadcaster can access settings — mods are redirected (T-2-02)
  if (!session || !session.is_broadcaster) {
    throw redirect(303, '/mod-login');
  }

  // Load current settings as a key-value map for easy form initialization
  const { data: settingsRows } = await db.from('settings').select('*');
  const settings: Record<string, unknown> = {};
  for (const row of settingsRows ?? []) {
    settings[row.key] = row.value;
  }

  // Load active moderators ordered by when they were added
  const { data: mods } = await db
    .from('moderators')
    .select('twitch_user_id, username, added_at, active')
    .eq('active', true)
    .order('added_at', { ascending: true });

  return {
    username: session.username,
    settings,
    moderators: mods ?? []
  };
};
