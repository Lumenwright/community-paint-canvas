// Truncates all test tables between suites. Uses the service role client directly.
// Called in beforeAll / afterEach hooks to keep each test isolated.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Tables and their primary key columns (used for the always-true delete filter)
const TABLES: Array<{ table: string; pk: string; sentinel: unknown }> = [
  { table: 'canvas_history', pk: 'id', sentinel: '00000000-0000-0000-0000-000000000000' },
  { table: 'drawings', pk: 'id', sentinel: '00000000-0000-0000-0000-000000000000' },
  { table: 'queue', pk: 'id', sentinel: '00000000-0000-0000-0000-000000000000' },
  { table: 'moderators', pk: 'twitch_user_id', sentinel: '__never__' }
];

export async function resetDb(): Promise<void> {
  // Delete all rows using a filter that matches every row (neq sentinel value).
  for (const { table, pk, sentinel } of TABLES) {
    const { error } = await (db.from(table) as ReturnType<typeof db.from>)
      .delete()
      .neq(pk, sentinel);
    if (error) throw new Error(`resetDb failed on ${table}: ${error.message}`);
  }

  // Re-seed settings to known defaults after each reset (numbers, not strings)
  await db.from('settings').upsert([
    { key: 'grace_seconds', value: 1200 },
    { key: 'fade_seconds', value: 120 },
    { key: 'bits_sku', value: 'submit_100' },
    { key: 'bits_amount', value: 100 }
  ], { onConflict: 'key' });
}

export { db as testDb };
