// DELETE /api/queue/my-submission — cancel an active submission.
// Auth: Extension JWT. Available from pending_review or approved_pending_bits states.
// Bits are never charged before this point, so cancellation always costs nothing.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireExtJWT } from '$lib/server/auth.js';

const CANCELLABLE_STATUSES = ['pending_review', 'approved_pending_bits'];

export const DELETE: RequestHandler = async (event) => {
  const jwt = await requireExtJWT(event);

  // Fetch the most recent submission that can be cancelled
  const { data: submission, error: fetchError } = await db
    .from('queue')
    .select('id, entry_id, strokes, line_widths, username, status')
    .eq('twitch_user_id', jwt.twitch_user_id)
    .in('status', CANCELLABLE_STATUSES)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw error(500, fetchError.message);

  if (!submission) {
    // Could be no submission at all, already live, or in a terminal state
    const { data: anyActive } = await db
      .from('queue')
      .select('status')
      .eq('twitch_user_id', jwt.twitch_user_id)
      .eq('status', 'live')
      .maybeSingle();

    if (anyActive) throw error(409, 'Cannot cancel a drawing that is live on stream');
    throw error(404, 'No cancellable submission found');
  }

  // Archive then update — keep canvas_history as the permanent record
  const { error: historyError } = await db.from('canvas_history').insert({
    entry_id: submission.entry_id,
    strokes: submission.strokes,
    line_widths: submission.line_widths,
    username: submission.username,
    status: 'cancelled'
  });
  if (historyError) throw error(500, historyError.message);

  const { error: updateError } = await db
    .from('queue')
    .update({ status: 'cancelled' })
    .eq('id', submission.id);
  if (updateError) throw error(500, updateError.message);

  return json({ ok: true });
};
