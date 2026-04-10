import { describe, test, expect } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createTestSession, createModSession, createBroadcasterSession } from '../helpers/auth.js';

describe('GET /mod — auth redirect (MOD-01)', () => {
  test('1: no session → 303 redirect to /mod-login', async () => {
    const res = await api('/mod');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/mod-login');
  });

  test('2: regular user session → 303 redirect to /mod-login', async () => {
    const session = await createTestSession();
    const res = await api('/mod', { cookie: session });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/mod-login');
  });

  test('3: mod session → 200 (not redirected)', async () => {
    const session = await createModSession();
    const res = await api('/mod', { cookie: session });
    expect(res.status).toBe(200);
  });

  test('4: broadcaster session → 200 (not redirected)', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/mod', { cookie: session });
    expect(res.status).toBe(200);
  });
});

describe('GET /mod/settings — broadcaster auth redirect', () => {
  test('5: no session → 303 redirect to /mod-login', async () => {
    const res = await api('/mod/settings');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/mod-login');
  });

  test('6: mod (non-broadcaster) session → 303 redirect to /mod-login', async () => {
    const session = await createModSession();
    const res = await api('/mod/settings', { cookie: session });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/mod-login');
  });

  test('7: broadcaster session → 200 (not redirected)', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/mod/settings', { cookie: session });
    expect(res.status).toBe(200);
  });
});
