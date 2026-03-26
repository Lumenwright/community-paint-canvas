// GET /api/settings — public, returns all settings as a flat object.
// PATCH /api/settings — broadcaster only, updates one or more settings.
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/supabase.js';
import { requireBroadcaster } from '$lib/server/auth.js';

export const GET: RequestHandler = async () => {
  const { data, error: dbError } = await db.from('settings').select('key, value');
  if (dbError) throw error(500, dbError.message);

  const result: Record<string, unknown> = {};
  for (const row of data ?? []) result[row.key] = row.value;

  return json(result);
};

const VALID_KEYS = ['grace_seconds', 'fade_seconds', 'bits_sku', 'bits_amount'] as const;

export const PATCH: RequestHandler = async (event) => {
  requireBroadcaster(event);

  const body = await event.request.json().catch(() => {
    throw error(422, 'Invalid JSON body');
  });

  for (const key of Object.keys(body)) {
    if (!VALID_KEYS.includes(key as (typeof VALID_KEYS)[number])) {
      throw error(422, `Unknown setting key: ${key}`);
    }
  }

  if ('grace_seconds' in body) {
    const v = body.grace_seconds;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      throw error(422, 'grace_seconds must be a non-negative integer');
    }
  }

  if ('fade_seconds' in body) {
    const v = body.fade_seconds;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
      throw error(422, 'fade_seconds must be a positive integer');
    }
  }

  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value,  // pass raw value — Supabase client handles jsonb encoding
    updated_at: new Date().toISOString()
  }));

  const { error: dbError } = await db.from('settings').upsert(updates, { onConflict: 'key' });
  if (dbError) throw error(500, dbError.message);

  return json({ ok: true });
};
