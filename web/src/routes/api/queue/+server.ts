// GET /api/queue — full pending_review queue for the mod dashboard.
// Auth: mod (or broadcaster) session.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireMod } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  requireMod(event);

  const { data, error: dbError } = await db
    .from('queue')
    .select('entry_id, strokes, line_widths, username, submitted_at')
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true });

  if (dbError) throw error(500, dbError.message);

  return json(data);
};
