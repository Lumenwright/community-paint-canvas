import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { jwtVerify } from 'jose';
import { api } from '../helpers/fetch.js';
import {
  generateExtJWT, generateExpiredExtJWT, generateBadSignatureExtJWT,
  generateWrongClientIdExtJWT, TEST_SESSION_SECRET
} from '../helpers/auth.js';
import { resetDb } from '../helpers/reset.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('POST /api/auth/ext-handoff', () => {
  test('1: valid Extension JWT → 200, signed handoff token with ~60s TTL', async () => {
    const jwt = await generateExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/auth/ext-handoff', { method: 'POST', extJwt: jwt });
    expect(res.status).toBe(200);

    const { token } = await res.json();
    expect(typeof token).toBe('string');

    // Token must be verifiable with SESSION_SECRET and expire in ~60s
    const key = Buffer.from(TEST_SESSION_SECRET);
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    expect(payload.twitch_user_id).toBe('user_1');
    const ttl = (payload.exp as number) - (payload.iat as number);
    expect(ttl).toBeGreaterThanOrEqual(55);
    expect(ttl).toBeLessThanOrEqual(65);
  });

  test('2: expired Extension JWT → 401', async () => {
    const jwt = await generateExpiredExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/auth/ext-handoff', { method: 'POST', extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('3: JWT signed with wrong secret → 401', async () => {
    const jwt = await generateBadSignatureExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/auth/ext-handoff', { method: 'POST', extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('4: JWT with wrong extension client_id → 401', async () => {
    const jwt = await generateWrongClientIdExtJWT({ twitch_user_id: 'user_1' });
    const res = await api('/api/auth/ext-handoff', { method: 'POST', extJwt: jwt });
    expect(res.status).toBe(401);
  });

  test('5: no Authorization header → 401', async () => {
    const res = await api('/api/auth/ext-handoff', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// GET /api/auth/callback and /api/auth/mod-callback are tested separately.
// They require mocking the Twitch token exchange — covered in auth-callback.test.ts
// (to be added in Phase 2 when the full PKCE flow is wired up and mockable).
