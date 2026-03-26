import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { generateExtJWT, generateExpiredExtJWT } from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedApprovedPendingBits, seedPendingReview, seedLiveDrawing } from '../helpers/seed.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('POST /api/bits/confirm', () => {
  test('1: valid JWT, test_ tx ID, approved_pending_bits → 200, live in queue, row in drawings', async () => {
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/bits/confirm', {
      method: 'POST',
      extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_001', bits_amount: 100 }
    });
    expect(res.status).toBe(200);

    const { data: qRow } = await testDb.from('queue').select('status, bits_tx_id').eq('entry_id', entryId).single();
    expect(qRow?.status).toBe('live');
    expect(qRow?.bits_tx_id).toBe('test_tx_001');

    const { data: dRow } = await testDb.from('drawings').select('entry_id, expires_at').eq('entry_id', entryId).single();
    expect(dRow).toBeTruthy();
  });

  test('2: submission is pending_review (not yet approved) → 409', async () => {
    const entryId = await seedPendingReview({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/bits/confirm', {
      method: 'POST',
      extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_002', bits_amount: 100 }
    });
    expect(res.status).toBe(409);
  });

  test('3: submission belongs to different user → 403', async () => {
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_2' }); // different user
    const res = await api('/api/bits/confirm', {
      method: 'POST',
      extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_003', bits_amount: 100 }
    });
    expect(res.status).toBe(403);
  });

  test('4: same bits_tx_id used twice → 409 (replay protection)', async () => {
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_replay', bits_amount: 100 }
    });
    // Second request with the same transaction_id
    const res = await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_replay', bits_amount: 100 }
    });
    expect(res.status).toBe(409);
  });

  test('5: invalid/expired JWT → 401', async () => {
    const jwt = await generateExpiredExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: 'x', transaction_id: 'test_tx_x', bits_amount: 100 }
    });
    expect(res.status).toBe(401);
  });

  test('6: entry_id does not exist → 404', async () => {
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: 'nonexistent', transaction_id: 'test_tx_y', bits_amount: 100 }
    });
    expect(res.status).toBe(404);
  });

  test('7: expires_at computed correctly from current settings (grace=1200, fade=120)', async () => {
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_1' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });

    const beforeReq = Date.now();
    await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_exp', bits_amount: 100 }
    });
    const afterReq = Date.now();

    const { data } = await testDb.from('drawings').select('expires_at').eq('entry_id', entryId).single();
    const expiresAt = new Date(data!.expires_at).getTime();
    const expectedMs = (1200 + 120) * 1000;

    // expires_at should be approximately now + grace + fade
    expect(expiresAt).toBeGreaterThanOrEqual(beforeReq + expectedMs);
    expect(expiresAt).toBeLessThanOrEqual(afterReq + expectedMs + 2000);
  });
});
