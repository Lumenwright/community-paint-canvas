// POST /api/review — mod approves or rejects a pending_review submission.
// Approve: status → approved_pending_bits (no DB write to drawings yet; user must spend Bits).
// Reject:  status → rejected + archive to canvas_history.
// Auth: mod session.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireMod } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
  const session = requireMod(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  const { entry_id, status } = body;

  if (!entry_id || typeof entry_id !== 'string') throw error(422, 'entry_id required');
  if (status !== 'approved' && status !== 'rejected') {
    throw error(422, 'status must be "approved" or "rejected"');
  }

  // Fetch current submission — must be in pending_review to act on
  const { data: submission, error: fetchError } = await db
    .from('queue')
    .select('id, entry_id, strokes, line_widths, username, status')
    .eq('entry_id', entry_id)
    .maybeSingle();

  if (fetchError) throw error(500, fetchError.message);
  if (!submission) throw error(404, 'Submission not found');
  if (submission.status !== 'pending_review') {
    throw error(409, `Cannot review a submission with status "${submission.status}"`);
  }

  const newStatus = status === 'approved' ? 'approved_pending_bits' : 'rejected';

  if (newStatus === 'rejected') {
    // Archive immediately on rejection — no Bits were ever involved
    const { error: historyError } = await db.from('canvas_history').insert({
      entry_id: submission.entry_id,
      strokes: submission.strokes,
      line_widths: submission.line_widths,
      username: submission.username,
      status: 'rejected'
    });
    if (historyError) throw error(500, historyError.message);
  }

  const { error: updateError } = await db
    .from('queue')
    .update({
      status: newStatus,
      reviewed_by: session.twitch_user_id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submission.id);

  if (updateError) throw error(500, updateError.message);

  return json({ ok: true, status: newStatus });
};
