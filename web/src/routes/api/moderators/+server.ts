// GET    /api/moderators — list active mods (broadcaster only)
// POST   /api/moderators — add a new mod (broadcaster only)
// DELETE /api/moderators — soft-deactivate a mod (broadcaster only; preserves audit trail)
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireBroadcaster } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  requireBroadcaster(event);

  const { data, error: dbError } = await db
    .from('moderators')
    .select('twitch_user_id, username, added_by, added_at')
    .eq('active', true)
    .order('added_at', { ascending: true });

  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async (event) => {
  const session = requireBroadcaster(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  const { twitch_user_id, username } = body;
  if (!twitch_user_id || typeof twitch_user_id !== 'string') {
    throw error(422, 'twitch_user_id required');
  }
  if (!username || typeof username !== 'string') {
    throw error(422, 'username required');
  }

  const { error: dbError } = await db.from('moderators').insert({
    twitch_user_id,
    username,
    added_by: session.twitch_user_id
  });

  if (dbError) {
    if (dbError.code === '23505') throw error(409, 'Moderator already exists');
    throw error(500, dbError.message);
  }

  return json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
  requireBroadcaster(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  const { twitch_user_id } = body;
  if (!twitch_user_id || typeof twitch_user_id !== 'string') {
    throw error(422, 'twitch_user_id required');
  }

  // Only soft-delete if currently active — treat inactive/missing as 404
  const { data, error: dbError } = await db
    .from('moderators')
    .update({ active: false })
    .eq('twitch_user_id', twitch_user_id)
    .eq('active', true)
    .select('twitch_user_id')
    .maybeSingle();

  if (dbError) throw error(500, dbError.message);
  if (!data) throw error(404, 'Moderator not found or already inactive');

  return json({ ok: true });
};
