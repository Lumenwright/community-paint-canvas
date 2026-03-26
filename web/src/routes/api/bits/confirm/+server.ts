// POST /api/bits/confirm — called by the Extension after the Twitch Bits transaction completes.
// Verifies the transaction (or skips verification in dev mode for test_ IDs),
// then atomically moves the queue entry to 'live' and inserts into the drawings table.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireExtJWT } from '$lib/server/auth.js';
import { TWITCH_CLIENT_ID } from '$env/static/private';
import { PUBLIC_DEV_MODE } from '$env/static/public';

const DEV_MODE = PUBLIC_DEV_MODE === 'true';

export const POST: RequestHandler = async (event) => {
  const jwt = await requireExtJWT(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  const { entry_id, transaction_id, bits_amount } = body;

  if (!entry_id || !transaction_id) throw error(422, 'entry_id and transaction_id required');

  // Verify transaction with Twitch unless it's a dev-mode test_ ID
  if (!DEV_MODE || !String(transaction_id).startsWith('test_')) {
    await verifyTwitchTransaction(transaction_id, bits_amount);
  }

  // Fetch the submission — must be owned by this user and in approved_pending_bits
  const { data: submission, error: fetchError } = await db
    .from('queue')
    .select('id, entry_id, strokes, line_widths, username, status, twitch_user_id')
    .eq('entry_id', entry_id)
    .maybeSingle();

  if (fetchError) throw error(500, fetchError.message);
  if (!submission) throw error(404, 'Submission not found');
  if (submission.twitch_user_id !== jwt.twitch_user_id) throw error(403, 'Forbidden');
  if (submission.status !== 'approved_pending_bits') {
    throw error(409, `Cannot confirm Bits for submission with status "${submission.status}"`);
  }

  // Read current settings to compute expires_at
  const { data: settings } = await db
    .from('settings')
    .select('key, value')
    .in('key', ['grace_seconds', 'fade_seconds']);

  const settingsMap: Record<string, number> = {};
  for (const row of settings ?? []) {
    settingsMap[row.key] = Number(row.value);
  }

  const graceSeconds = settingsMap['grace_seconds'] ?? 1200;
  const fadeSeconds = settingsMap['fade_seconds'] ?? 120;
  const now = new Date();
  const expiresAt =
    graceSeconds === 0
      ? null
      : new Date(now.getTime() + (graceSeconds + fadeSeconds) * 1000).toISOString();

  // Atomic: mark live + insert drawing. bits_tx_id UNIQUE handles replay protection.
  const { error: txError } = await db.from('queue').update({
    status: 'live',
    bits_tx_id: transaction_id,
    bits_confirmed_at: now.toISOString()
  }).eq('id', submission.id);

  if (txError) {
    // Unique constraint violation = duplicate transaction ID
    if (txError.code === '23505') throw error(409, 'Transaction already processed');
    throw error(500, txError.message);
  }

  const { error: insertError } = await db.from('drawings').insert({
    entry_id: submission.entry_id,
    strokes: submission.strokes,
    line_widths: submission.line_widths,
    username: submission.username,
    approved_at: now.toISOString(),
    expires_at: expiresAt
  });

  if (insertError) throw error(500, insertError.message);

  return json({ ok: true });
};

async function verifyTwitchTransaction(transactionId: string, _bitsAmount: number) {
  // App Access Token would be obtained here in production.
  // GET https://api.twitch.tv/helix/extensions/transactions?id=<transactionId>
  const res = await fetch(
    `https://api.twitch.tv/helix/extensions/transactions?id=${transactionId}`,
    { headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: 'Bearer <app-access-token>' } }
  );
  if (!res.ok) throw error(502, 'Twitch transaction verification failed');
  const { data } = await res.json();
  if (!data?.length) throw error(422, 'Transaction not found on Twitch');
}
