// POST /api/canvas/reset — broadcaster or mod clears the entire canvas.
// Archives all rows in drawings to canvas_history with status='reset', then deletes them.
// Does NOT touch queue rows. Supabase Realtime fires DELETE events → overlay clears instantly.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireMod } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
  requireMod(event);

  // Fetch all current drawings to archive
  const { data: drawings, error: fetchError } = await db
    .from('drawings')
    .select('entry_id, strokes, line_widths, username');

  if (fetchError) throw error(500, fetchError.message);
  if (!drawings || drawings.length === 0) return json({ ok: true, cleared: 0 });

  // Archive first, then delete — preserves the record if the delete partially fails
  const { error: historyError } = await db.from('canvas_history').insert(
    drawings.map((d) => ({
      entry_id: d.entry_id,
      strokes: d.strokes,
      line_widths: d.line_widths,
      username: d.username,
      status: 'reset'
    }))
  );
  if (historyError) throw error(500, historyError.message);

  const { error: deleteError } = await db
    .from('drawings')
    .delete()
    .in(
      'entry_id',
      drawings.map((d) => d.entry_id)
    );
  if (deleteError) throw error(500, deleteError.message);

  return json({ ok: true, cleared: drawings.length });
};
