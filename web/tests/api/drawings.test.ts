import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createTestSession } from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedPendingReview, seedApprovedPendingBits } from '../helpers/seed.js';

const STROKES = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
const LINE_WIDTHS = [7, 7, 7];

beforeAll(resetDb);
beforeEach(resetDb);

describe('POST /api/drawings', () => {
  test('1: valid session + valid strokes → 201 + pending_review in DB', async () => {
    const session = await createTestSession({ twitch_user_id: 'user_1', username: 'alice' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS, base_width: 7 }
    });
    expect(res.status).toBe(201);
    const { entry_id } = await res.json();
    expect(entry_id).toBeTruthy();

    const { data } = await testDb.from('queue').select('status').eq('entry_id', entry_id).single();
    expect(data?.status).toBe('pending_review');
  });

  test('2: no session → 401', async () => {
    const res = await api('/api/drawings', {
      method: 'POST',
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(401);
  });

  test('3: expired session → 401', async () => {
    const { createExpiredSession } = await import('../helpers/auth.js');
    const session = await createExpiredSession({ twitch_user_id: 'user_1' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(401);
  });

  test('4: missing strokes field → 422', async () => {
    const session = await createTestSession();
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(422);
  });

  test('5: empty strokes array → 422', async () => {
    const session = await createTestSession();
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: [], line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(422);
  });

  test('6: user already has pending_review → 409', async () => {
    const session = await createTestSession({ twitch_user_id: 'user_1' });
    await seedPendingReview({ twitch_user_id: 'user_1' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(409);
  });

  test('7: user already has approved_pending_bits → 409', async () => {
    const session = await createTestSession({ twitch_user_id: 'user_1' });
    await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(409);
  });

  test('8: user has rejected submission → 201 (resubmit allowed)', async () => {
    // Seed a rejected entry for user_1
    await testDb.from('queue').insert({
      strokes: STROKES, line_widths: LINE_WIDTHS, base_width: 7,
      twitch_user_id: 'user_1', username: 'alice', status: 'rejected'
    });
    const session = await createTestSession({ twitch_user_id: 'user_1' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(201);
  });

  test('9: user has cancelled submission → 201 (resubmit allowed)', async () => {
    await testDb.from('queue').insert({
      strokes: STROKES, line_widths: LINE_WIDTHS, base_width: 7,
      twitch_user_id: 'user_1', username: 'alice', status: 'cancelled'
    });
    const session = await createTestSession({ twitch_user_id: 'user_1' });
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS }
    });
    expect(res.status).toBe(201);
  });

  test('10: base_width out of range → 422', async () => {
    const session = await createTestSession();
    const res = await api('/api/drawings', {
      method: 'POST',
      cookie: session,
      body: { strokes: STROKES, line_widths: LINE_WIDTHS, base_width: 999 }
    });
    expect(res.status).toBe(422);
  });
});
