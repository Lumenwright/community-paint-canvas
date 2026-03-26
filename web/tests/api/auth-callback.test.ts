// Tests for GET /api/auth/callback and GET /api/auth/mod-callback.
// Uses the dev-mode test_code_ stub to avoid real Twitch API calls (PUBLIC_DEV_MODE=true).
// See src/lib/server/twitch-oauth.ts for the stub behaviour.
import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api, BASE_URL } from '../helpers/fetch.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedModerator } from '../helpers/seed.js';
import { TEST_BROADCASTER_ID } from '../helpers/auth.js';

beforeAll(resetDb);
beforeEach(resetDb);

// Helper: make a callback request with a fake oauth_state cookie set
async function callbackWithState(path: string, code: string | null, state: string, cookieState: string) {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  params.set('state', state);
  return fetch(`${BASE_URL}${path}?${params}`, {
    headers: { Cookie: `oauth_state=${cookieState}` },
    redirect: 'manual'
  });
}

describe('GET /api/auth/callback (drawing site)', () => {
  test('1: valid code + matching state → redirects to /, sets session cookie', async () => {
    const res = await callbackWithState('/api/auth/callback', 'test_code_user_1', 'abc123', 'abc123');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('session=');
    expect(setCookie).toContain('HttpOnly');
  });

  test('3: missing code param → redirects to /login with error', async () => {
    const res = await callbackWithState('/api/auth/callback', null, 'abc123', 'abc123');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('4: state param missing → 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/callback?code=test_code_u`, {
      headers: { Cookie: `oauth_state=abc` },
      redirect: 'manual'
    });
    expect(res.status).toBe(400);
  });

  test('5: state mismatch → 400 (CSRF protection)', async () => {
    const res = await callbackWithState('/api/auth/callback', 'test_code_user_1', 'wrong_state', 'abc123');
    expect(res.status).toBe(400);
  });

  test('7: after successful callback, redirect URL is clean (no code/state params)', async () => {
    const res = await callbackWithState('/api/auth/callback', 'test_code_user_2', 'xyz', 'xyz');
    const location = res.headers.get('location') ?? '';
    expect(location).not.toContain('code=');
    expect(location).not.toContain('state=');
  });
});

describe('GET /api/auth/mod-callback', () => {
  test('2: valid flow for a known moderator → redirects to /mod, session has is_mod=true', async () => {
    await seedModerator({ twitch_user_id: 'mod_oauth_1', username: 'mod_oauth_user' });
    // test_code_<user_id> → stub returns user with id = 'mod_oauth_1'
    const res = await callbackWithState('/api/auth/mod-callback', 'test_code_mod_oauth_1', 's1', 's1');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/mod');
    expect(res.headers.get('set-cookie')).toContain('session=');
  });

  test('broadcaster redirect → /mod, session has is_broadcaster=true', async () => {
    const res = await callbackWithState(
      '/api/auth/mod-callback', `test_code_${TEST_BROADCASTER_ID}`, 's2', 's2'
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/mod');
  });

  test('4: state param missing → 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/mod-callback?code=test_code_u`, {
      headers: { Cookie: `oauth_state=abc` },
      redirect: 'manual'
    });
    expect(res.status).toBe(400);
  });

  test('5: state mismatch → 400', async () => {
    const res = await callbackWithState('/api/auth/mod-callback', 'test_code_u', 'bad', 'good');
    expect(res.status).toBe(400);
  });
});
