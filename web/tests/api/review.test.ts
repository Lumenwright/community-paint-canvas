import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createModSession, createTestSession } from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedPendingReview, seedApprovedPendingBits, seedLiveDrawing } from '../helpers/seed.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('POST /api/review', () => {
  test('1: approve pending_review → 200, status = approved_pending_bits', async () => {
    const entryId = await seedPendingReview({ twitch_user_id: 'user_1' });
    const session = await createModSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: entryId, status: 'approved' }
    });
    expect(res.status).toBe(200);
    const { data } = await testDb.from('queue').select('status').eq('entry_id', entryId).single();
    expect(data?.status).toBe('approved_pending_bits');
  });

  test('2: reject pending_review → 200, status = rejected, canvas_history row created', async () => {
    const entryId = await seedPendingReview({ twitch_user_id: 'user_1' });
    const session = await createModSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: entryId, status: 'rejected' }
    });
    expect(res.status).toBe(200);

    const { data: row } = await testDb.from('queue').select('status').eq('entry_id', entryId).single();
    expect(row?.status).toBe('rejected');

    const { data: hist } = await testDb.from('canvas_history').select('status').eq('entry_id', entryId).single();
    expect(hist?.status).toBe('rejected');
  });

  test('3: approve a rejected submission → 409', async () => {
    const entryId = await seedPendingReview({ twitch_user_id: 'user_1' });
    // Fast-reject it first
    await testDb.from('queue').update({ status: 'rejected' }).eq('entry_id', entryId);
    const session = await createModSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: entryId, status: 'approved' }
    });
    expect(res.status).toBe(409);
  });

  test('4: approve a live submission → 409', async () => {
    const entryId = await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const session = await createModSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: entryId, status: 'approved' }
    });
    expect(res.status).toBe(409);
  });

  test('5: entry_id does not exist → 404', async () => {
    const session = await createModSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: 'nonexistent_id', status: 'approved' }
    });
    expect(res.status).toBe(404);
  });

  test('6: regular user → 403', async () => {
    const entryId = await seedPendingReview();
    const session = await createTestSession();
    const res = await api('/api/review', {
      method: 'POST',
      cookie: session,
      body: { entry_id: entryId, status: 'approved' }
    });
    expect(res.status).toBe(403);
  });

  test('7: no session → 401', async () => {
    const res = await api('/api/review', {
      method: 'POST',
      body: { entry_id: 'x', status: 'approved' }
    });
    expect(res.status).toBe(401);
  });
});
