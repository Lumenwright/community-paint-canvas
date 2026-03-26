// POST /api/drawings — save a new drawing for free, status: pending_review.
// The user must be logged in. Blocked if they already have an active (pending or approved) submission.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireSession } from '$lib/server/auth.js';

const MIN_STROKES = 2;
const MIN_WIDTH = 1;
const MAX_WIDTH = 15;

// Statuses that block a new submission — one active drawing per user at a time.
const ACTIVE_STATUSES = ['pending_review', 'approved_pending_bits'];

export const POST: RequestHandler = async (event) => {
  const session = requireSession(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  const { strokes, line_widths, base_width = 7 } = body;

  if (!Array.isArray(strokes) || strokes.length < MIN_STROKES) {
    throw error(422, 'strokes must be an array with at least 2 points');
  }
  if (!Array.isArray(line_widths) || line_widths.length === 0) {
    throw error(422, 'line_widths must be a non-empty array');
  }
  if (typeof base_width !== 'number' || base_width < MIN_WIDTH || base_width > MAX_WIDTH) {
    throw error(422, `base_width must be between ${MIN_WIDTH} and ${MAX_WIDTH}`);
  }

  // Check for an existing active submission
  const { data: existing } = await db
    .from('queue')
    .select('id')
    .eq('twitch_user_id', session.twitch_user_id)
    .in('status', ACTIVE_STATUSES)
    .maybeSingle();

  if (existing) {
    throw error(409, 'You already have an active submission');
  }

  const { data, error: dbError } = await db
    .from('queue')
    .insert({
      strokes,
      line_widths,
      base_width,
      twitch_user_id: session.twitch_user_id,
      username: session.username
    })
    .select('entry_id')
    .single();

  if (dbError) throw error(500, dbError.message);

  return json({ entry_id: data.entry_id }, { status: 201 });
};
