// DB seeding helpers: insert rows in known states without going through the API.
// Uses the service role client — bypasses RLS, fastest way to set up preconditions.
import { testDb as db } from './reset.js';

const DEFAULT_STROKES = [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }];
const DEFAULT_LINE_WIDTHS = [7, 7, 7];

interface SeedOptions {
  twitch_user_id?: string;
  username?: string;
}

// Insert a pending_review queue entry, returns entry_id
export async function seedPendingReview({
  twitch_user_id = 'user_001',
  username = 'test_user'
}: SeedOptions = {}): Promise<string> {
  const { data, error } = await db
    .from('queue')
    .insert({
      strokes: DEFAULT_STROKES,
      line_widths: DEFAULT_LINE_WIDTHS,
      base_width: 7,
      twitch_user_id,
      username,
      status: 'pending_review'
    })
    .select('entry_id')
    .single();
  if (error) throw new Error(`seedPendingReview: ${error.message}`);
  return data.entry_id;
}

// Insert an approved_pending_bits queue entry, returns entry_id
export async function seedApprovedPendingBits({
  twitch_user_id = 'user_001',
  username = 'test_user'
}: SeedOptions = {}): Promise<string> {
  const { data, error } = await db
    .from('queue')
    .insert({
      strokes: DEFAULT_STROKES,
      line_widths: DEFAULT_LINE_WIDTHS,
      base_width: 7,
      twitch_user_id,
      username,
      status: 'approved_pending_bits',
      reviewed_by: 'mod_001',
      reviewed_at: new Date().toISOString()
    })
    .select('entry_id')
    .single();
  if (error) throw new Error(`seedApprovedPendingBits: ${error.message}`);
  return data.entry_id;
}

interface LiveDrawingOptions extends SeedOptions {
  expires_in_seconds?: number | null; // null = never expires
}

// Insert a live drawing in the drawings table (after Bits confirmed), returns entry_id
export async function seedLiveDrawing({
  twitch_user_id = 'user_001',
  username = 'test_user',
  expires_in_seconds = 1320 // 22 min
}: LiveDrawingOptions = {}): Promise<string> {
  const now = new Date();
  const expiresAt =
    expires_in_seconds === null
      ? null
      : new Date(now.getTime() + expires_in_seconds * 1000).toISOString();

  const { data: queueRow, error: queueError } = await db
    .from('queue')
    .insert({
      strokes: DEFAULT_STROKES,
      line_widths: DEFAULT_LINE_WIDTHS,
      base_width: 7,
      twitch_user_id,
      username,
      status: 'live',
      bits_tx_id: `test_seed_${Date.now()}_${Math.random()}`,
      bits_confirmed_at: now.toISOString()
    })
    .select('entry_id')
    .single();
  if (queueError) throw new Error(`seedLiveDrawing (queue): ${queueError.message}`);

  const { error: drawingError } = await db.from('drawings').insert({
    entry_id: queueRow.entry_id,
    strokes: DEFAULT_STROKES,
    line_widths: DEFAULT_LINE_WIDTHS,
    username,
    approved_at: now.toISOString(),
    expires_at: expiresAt
  });
  if (drawingError) throw new Error(`seedLiveDrawing (drawings): ${drawingError.message}`);

  return queueRow.entry_id;
}

// Insert a drawing that has already expired (expires_at in the past)
export async function seedExpiredDrawing({
  twitch_user_id = 'user_001',
  username = 'test_user'
}: SeedOptions = {}): Promise<string> {
  const past = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
  return seedLiveDrawing({ twitch_user_id, username, expires_in_seconds: -60 });
}

// Insert an active moderator row
export async function seedModerator({
  twitch_user_id = 'mod_001',
  username = 'mod_user'
}: SeedOptions = {}): Promise<void> {
  const { error } = await db.from('moderators').insert({
    twitch_user_id,
    username,
    added_by: 'broadcaster_001'
  });
  if (error) throw new Error(`seedModerator: ${error.message}`);
}
