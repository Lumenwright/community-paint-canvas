// GET /api/cron/expire — archive and delete expired drawings.
// Called by Vercel Cron every minute. Protected by CRON_SECRET header.
// Skips drawings where expires_at IS NULL (grace_seconds = 0, never-expire mode).
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireCronSecret } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
  requireCronSecret(event);

  const now = new Date().toISOString();

  // Find expired drawings (expires_at is set AND in the past)
  const { data: expired, error: fetchError } = await db
    .from('drawings')
    .select('entry_id, strokes, line_widths, username')
    .not('expires_at', 'is', null)
    .lt('expires_at', now);

  if (fetchError) throw error(500, fetchError.message);
  if (!expired || expired.length === 0) return json({ ok: true, expired: 0 });

  // Archive first — preserve the record even if delete partially fails
  const { error: historyError } = await db.from('canvas_history').insert(
    expired.map((d) => ({
      entry_id: d.entry_id,
      strokes: d.strokes,
      line_widths: d.line_widths,
      username: d.username,
      status: 'expired'
    }))
  );
  if (historyError) throw error(500, historyError.message);

  const { error: deleteError } = await db
    .from('drawings')
    .delete()
    .in('entry_id', expired.map((d) => d.entry_id));

  if (deleteError) throw error(500, deleteError.message);

  return json({ ok: true, expired: expired.length });
};
