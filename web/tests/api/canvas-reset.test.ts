import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createModSession, createBroadcasterSession, createTestSession } from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedLiveDrawing, seedPendingReview } from '../helpers/seed.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('POST /api/canvas/reset', () => {
  test('1: mod, 3 live drawings → 200, all deleted from drawings, all in canvas_history with status=reset', async () => {
    const id1 = await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const id2 = await seedLiveDrawing({ twitch_user_id: 'user_2' });
    const id3 = await seedLiveDrawing({ twitch_user_id: 'user_3' });
    const session = await createModSession();

    const res = await api('/api/canvas/reset', { method: 'POST', cookie: session });
    expect(res.status).toBe(200);
    expect((await res.json()).cleared).toBe(3);

    const { data: remaining } = await testDb.from('drawings').select('entry_id');
    expect(remaining).toHaveLength(0);

    const { data: hist } = await testDb.from('canvas_history').select('status').in('entry_id', [id1, id2, id3]);
    expect(hist).toHaveLength(3);
    expect(hist!.every((h) => h.status === 'reset')).toBe(true);
  });

  test('2: broadcaster session → 200', async () => {
    await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const session = await createBroadcasterSession();
    const res = await api('/api/canvas/reset', { method: 'POST', cookie: session });
    expect(res.status).toBe(200);
  });

  test('3: no drawings on canvas → 200, nothing changes', async () => {
    const session = await createModSession();
    const res = await api('/api/canvas/reset', { method: 'POST', cookie: session });
    expect(res.status).toBe(200);
    expect((await res.json()).cleared).toBe(0);
  });

  test('4: mix — 1 live drawing + 2 pending_review in queue → only drawings cleared, queue untouched', async () => {
    await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const q1 = await seedPendingReview({ twitch_user_id: 'user_2' });
    const q2 = await seedPendingReview({ twitch_user_id: 'user_3' });

    const session = await createModSession();
    const res = await api('/api/canvas/reset', { method: 'POST', cookie: session });
    expect((await res.json()).cleared).toBe(1);

    const { data: queueRows } = await testDb.from('queue').select('entry_id').in('entry_id', [q1, q2]);
    expect(queueRows).toHaveLength(2); // queue untouched
  });

  test('5: live drawing with expires_at = NULL → still cleared and archived as reset', async () => {
    const id = await seedLiveDrawing({ twitch_user_id: 'user_1', expires_in_seconds: null });
    const session = await createModSession();

    await api('/api/canvas/reset', { method: 'POST', cookie: session });

    const { data: hist } = await testDb.from('canvas_history').select('status').eq('entry_id', id).single();
    expect(hist?.status).toBe('reset');
  });

  test('6: regular user → 403', async () => {
    const session = await createTestSession();
    const res = await api('/api/canvas/reset', { method: 'POST', cookie: session });
    expect(res.status).toBe(403);
  });

  test('7: no session → 401', async () => {
    const res = await api('/api/canvas/reset', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
