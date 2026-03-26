import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedLiveDrawing } from '../helpers/seed.js';
import { TEST_CRON_SECRET } from '../helpers/auth.js';

function cronHeaders() {
  return { headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } };
}

beforeAll(resetDb);
beforeEach(resetDb);

// Insert a drawing with expires_at in the past (expired)
async function seedExpiredRaw(username = 'user_exp'): Promise<string> {
  const past = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await testDb.from('drawings').insert({
    entry_id: `expired_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    strokes: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
    line_widths: [7, 7],
    username,
    approved_at: new Date(Date.now() - 120_000).toISOString(),
    expires_at: past
  }).select('entry_id').single();
  if (error) throw new Error(error.message);
  return data.entry_id;
}

describe('GET /api/cron/expire', () => {
  test('1: 2 expired drawings + valid secret → both deleted from drawings, both in canvas_history', async () => {
    const id1 = await seedExpiredRaw('u1');
    const id2 = await seedExpiredRaw('u2');

    const res = await api('/api/cron/expire', {
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expired).toBe(2);

    const { data: remaining } = await testDb.from('drawings').select('entry_id').in('entry_id', [id1, id2]);
    expect(remaining).toHaveLength(0);

    const { data: hist } = await testDb.from('canvas_history').select('entry_id, status').in('entry_id', [id1, id2]);
    expect(hist).toHaveLength(2);
    expect(hist!.every((h) => h.status === 'expired')).toBe(true);
  });

  test('2: no expired drawings → 200, nothing changes', async () => {
    await seedLiveDrawing({ expires_in_seconds: 3600 }); // not expired
    const res = await api('/api/cron/expire', {
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }
    });
    expect(res.status).toBe(200);
    expect((await res.json()).expired).toBe(0);
  });

  test('3: mix — 1 expired, 2 not yet expired → only 1 deleted', async () => {
    const expiredId = await seedExpiredRaw('u_expired');
    await seedLiveDrawing({ expires_in_seconds: 3600 });
    await seedLiveDrawing({ twitch_user_id: 'user_002', expires_in_seconds: 7200 });

    const res = await api('/api/cron/expire', {
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }
    });
    expect((await res.json()).expired).toBe(1);

    const { data: still } = await testDb.from('drawings').select('entry_id').eq('entry_id', expiredId);
    expect(still).toHaveLength(0);
  });

  test('4: drawing with expires_at = NULL → not deleted even if approved_at is old', async () => {
    const entryId = await seedLiveDrawing({ expires_in_seconds: null });

    const res = await api('/api/cron/expire', {
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }
    });
    expect((await res.json()).expired).toBe(0);

    const { data } = await testDb.from('drawings').select('entry_id').eq('entry_id', entryId);
    expect(data).toHaveLength(1); // still there
  });

  test('5: wrong CRON_SECRET → 401', async () => {
    const res = await api('/api/cron/expire', {
      headers: { Authorization: 'Bearer wrong_secret' }
    });
    expect(res.status).toBe(401);
  });

  test('6: no Authorization header → 401', async () => {
    const res = await api('/api/cron/expire');
    expect(res.status).toBe(401);
  });
});
