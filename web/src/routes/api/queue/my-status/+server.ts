// GET /api/queue/my-status — returns the current user's latest submission status.
// Auth: Extension JWT. Polled every 10s by the Extension panel to drive its state machine.
// Strokes are included only when status = 'approved_pending_bits' (for the preview in the panel).
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireExtJWT } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  const jwt = await requireExtJWT(event);

  const { data, error: dbError } = await db
    .from('queue')
    .select('entry_id, status, strokes, line_widths')
    .eq('twitch_user_id', jwt.twitch_user_id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dbError) throw error(500, dbError.message);
  if (!data) return json({ status: null });

  // Only send strokes when the panel needs to render the preview
  const payload: Record<string, unknown> = { status: data.status };
  if (data.status === 'approved_pending_bits') {
    payload.entry_id = data.entry_id;
    payload.strokes = data.strokes;
    payload.line_widths = data.line_widths;
  }

  return json(payload);
};
