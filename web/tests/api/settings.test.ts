import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createBroadcasterSession, createModSession, createTestSession } from '../helpers/auth.js';
import { resetDb } from '../helpers/reset.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('GET /api/settings', () => {
  test('1: no auth, returns seeded defaults', async () => {
    const res = await api('/api/settings');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grace_seconds).toBe(1200);
    expect(body.fade_seconds).toBe(120);
    expect(body.bits_sku).toBe('submit_100');
    expect(body.bits_amount).toBe(100);
  });
});

describe('PATCH /api/settings', () => {
  test('1: broadcaster updates grace_seconds to 600 → 200, DB updated', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/settings', {
      method: 'PATCH',
      cookie: session,
      body: { grace_seconds: 600 }
    });
    expect(res.status).toBe(200);

    const check = await api('/api/settings');
    const body = await check.json();
    expect(body.grace_seconds).toBe(600);
  });

  test('2: broadcaster sets grace_seconds to 0 (never expire) → 200', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/settings', {
      method: 'PATCH',
      cookie: session,
      body: { grace_seconds: 0 }
    });
    expect(res.status).toBe(200);
    const check = await api('/api/settings');
    expect((await check.json()).grace_seconds).toBe(0);
  });

  test('3: grace_seconds = -1 → 422', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/settings', {
      method: 'PATCH',
      cookie: session,
      body: { grace_seconds: -1 }
    });
    expect(res.status).toBe(422);
  });

  test('4: mod session (not broadcaster) → 403', async () => {
    const session = await createModSession();
    const res = await api('/api/settings', {
      method: 'PATCH',
      cookie: session,
      body: { grace_seconds: 600 }
    });
    expect(res.status).toBe(403);
  });

  test('5: no session → 401', async () => {
    const res = await api('/api/settings', {
      method: 'PATCH',
      body: { grace_seconds: 600 }
    });
    expect(res.status).toBe(401);
  });
});

describe('grace_seconds = 0 behavior', () => {
  test('1: approve drawing when grace_seconds=0 → expires_at is NULL in drawings', async () => {
    // Set grace_seconds to 0 first
    const broadcaster = await createBroadcasterSession();
    await api('/api/settings', { method: 'PATCH', cookie: broadcaster, body: { grace_seconds: 0 } });

    // Seed an approved_pending_bits entry and confirm Bits
    const { seedApprovedPendingBits } = await import('../helpers/seed.js');
    const { generateExtJWT } = await import('../helpers/auth.js');
    const { testDb } = await import('../helpers/reset.js');
    const entryId = await seedApprovedPendingBits({ twitch_user_id: 'user_grace0' });
    const jwt = await generateExtJWT({ twitch_user_id: 'user_grace0' });
    await api('/api/bits/confirm', {
      method: 'POST', extJwt: jwt,
      body: { entry_id: entryId, transaction_id: 'test_tx_grace0', bits_amount: 100 }
    });

    const { data } = await testDb.from('drawings').select('expires_at').eq('entry_id', entryId).single();
    expect(data?.expires_at).toBeNull();
  });
});
