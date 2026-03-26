import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import {
  generateExtJWT, generateExpiredExtJWT, generateBadSignatureExtJWT,
  generateWrongClientIdExtJWT, createModSession, createTestSession
} from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedPendingReview, seedApprovedPendingBits, seedLiveDrawing } from '../helpers/seed.js';

beforeAll(resetDb);
beforeEach(resetDb);

// ── GET /api/queue/my-status ──────────────────────────────────────────────────

describe('GET /api/queue/my-status', () => {
  test('1: pending_review — status returned, no strokes', async () => {
    await seedPendingReview({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pending_review');
    expect(body.strokes).toBeUndefined();
  });

  test('2: approved_pending_bits — status + strokes returned', async () => {
    await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    const body = await res.json();
    expect(body.status).toBe('approved_pending_bits');
    expect(Array.isArray(body.strokes)).toBe(true);
  });

  test('3: live submission — status returned', async () => {
    await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    const body = await res.json();
    expect(body.status).toBe('live');
  });

  test('4: no submissions → { status: null }', async () => {
    const jwt = await generateExtJWT({ twitch_user_id: 'user_no_sub' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    const body = await res.json();
    expect(body.status).toBeNull();
  });

  test('5: expired JWT → 401', async () => {
    const jwt = await generateExpiredExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('6: wrong signature → 401', async () => {
    const jwt = await generateBadSignatureExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('7: wrong client_id → 401', async () => {
    const jwt = await generateWrongClientIdExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-status', { extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('8: no Authorization header → 401', async () => {
    const res = await api('/api/queue/my-status');
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/queue/my-submission ──────────────────────────────────────────

describe('DELETE /api/queue/my-submission', () => {
  test('1: cancel from pending_review → 200, status = cancelled, canvas_history row created', async () => {
    const entryId = await seedPendingReview({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(200);

    const { data: row } = await testDb.from('queue').select('status').eq('entry_id', entryId).single();
    expect(row?.status).toBe('cancelled');

    const { data: hist } = await testDb.from('canvas_history').select('status').eq('entry_id', entryId).single();
    expect(hist?.status).toBe('cancelled');
  });

  test('2: cancel from approved_pending_bits → 200, status = cancelled, canvas_history row created', async () => {
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(200);

    const { data: row } = await testDb.from('queue').select('status').eq('entry_id', entryId).single();
    expect(row?.status).toBe('cancelled');

    const { data: hist } = await testDb.from('canvas_history').select('status').eq('entry_id', entryId).single();
    expect(hist?.status).toBe('cancelled');
  });

  test('3: no active submission → 404', async () => {
    const jwt = await generateExtJWT({ twitch_user_id: 'user_no_sub' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(404);
  });

  test('4: submission is live → 409', async () => {
    await seedLiveDrawing({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(409);
  });

  test('5: submission already cancelled → 404', async () => {
    await testDb.from('queue').insert({
      strokes: [{x:1,y:1},{x:2,y:2}], line_widths: [7,7], base_width: 7,
      twitch_user_id: 'user_1', username: 'u', status: 'cancelled'
    });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(404);
  });

  test('6: submission is rejected → 404', async () => {
    await testDb.from('queue').insert({
      strokes: [{x:1,y:1},{x:2,y:2}], line_widths: [7,7], base_width: 7,
      twitch_user_id: 'user_1', username: 'u', status: 'rejected'
    });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(404);
  });

  test('7: invalid/expired JWT → 401', async () => {
    const jwt = await generateExpiredExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/queue/my-submission', { method: 'DELETE', extJwt: jwt });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/queue (mod queue) ────────────────────────────────────────────────

describe('GET /api/queue', () => {
  test('1: mod session, 3 pending_review items → 200, array of 3', async () => {
    await seedPendingReview({ twitch_user_id: 'user_1' });
    await seedPendingReview({ twitch_user_id: 'user_2' });
    await seedPendingReview({ twitch_user_id: 'user_3' });
    const session = await createModSession();
    const res = await api('/api/queue', { cookie: session });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  test('2: no pending items → 200, empty array', async () => {
    const session = await createModSession();
    const res = await api('/api/queue', { cookie: session });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  test('3: regular user → 403', async () => {
    const session = await createTestSession();
    const res = await api('/api/queue', { cookie: session });
    expect(res.status).toBe(403);
  });

  test('4: no session → 401', async () => {
    const res = await api('/api/queue');
    expect(res.status).toBe(401);
  });
});
