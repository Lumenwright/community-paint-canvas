import { describe, test, expect, beforeEach, beforeAll } from 'vitest';
import { api } from '../helpers/fetch.js';
import { createBroadcasterSession, createModSession, createTestSession } from '../helpers/auth.js';
import { resetDb, testDb } from '../helpers/reset.js';
import { seedModerator } from '../helpers/seed.js';

beforeAll(resetDb);
beforeEach(resetDb);

describe('GET /api/moderators', () => {
  test('1: broadcaster, 3 active mods → 200, array of 3', async () => {
    await seedModerator({ twitch_user_id: 'mod_1', username: 'mod_a' });
    await seedModerator({ twitch_user_id: 'mod_2', username: 'mod_b' });
    await seedModerator({ twitch_user_id: 'mod_3', username: 'mod_c' });
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', { cookie: session });
    expect(res.status).toBe(200);
    expect((await res.json())).toHaveLength(3);
  });

  test('2: broadcaster, no mods → 200, empty array', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', { cookie: session });
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(0);
  });

  test('3: mod session → 403', async () => {
    const session = await createModSession();
    const res = await api('/api/moderators', { cookie: session });
    expect(res.status).toBe(403);
  });

  test('4: regular user → 403', async () => {
    const session = await createTestSession();
    const res = await api('/api/moderators', { cookie: session });
    expect(res.status).toBe(403);
  });

  test('5: no session → 401', async () => {
    const res = await api('/api/moderators');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/moderators', () => {
  test('1: broadcaster, valid body → 201, row in moderators with active=true', async () => {
    const session = await createBroadcasterSession({ twitch_user_id: 'broadcaster_001' });
    const res = await api('/api/moderators', {
      method: 'POST',
      cookie: session,
      body: { twitch_user_id: 'new_mod_1', username: 'new_mod_a' }
    });
    expect(res.status).toBe(201);

    const { data } = await testDb.from('moderators').select('*').eq('twitch_user_id', 'new_mod_1').single();
    expect(data?.active).toBe(true);
    expect(data?.added_by).toBe('broadcaster_001');
  });

  test('2: duplicate twitch_user_id → 409', async () => {
    await seedModerator({ twitch_user_id: 'dup_mod', username: 'dup' });
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'POST',
      cookie: session,
      body: { twitch_user_id: 'dup_mod', username: 'dup' }
    });
    expect(res.status).toBe(409);
  });

  test('3: missing username → 422', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'POST',
      cookie: session,
      body: { twitch_user_id: 'mod_x' }
    });
    expect(res.status).toBe(422);
  });

  test('4: missing twitch_user_id → 422', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'POST',
      cookie: session,
      body: { username: 'mod_y' }
    });
    expect(res.status).toBe(422);
  });

  test('5: mod session → 403', async () => {
    const session = await createModSession();
    const res = await api('/api/moderators', {
      method: 'POST',
      cookie: session,
      body: { twitch_user_id: 'new_mod', username: 'nm' }
    });
    expect(res.status).toBe(403);
  });

  test('6: no session → 401', async () => {
    const res = await api('/api/moderators', {
      method: 'POST',
      body: { twitch_user_id: 'new_mod', username: 'nm' }
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/moderators', () => {
  test('1: broadcaster, existing active mod → 200, active=false (soft delete)', async () => {
    await seedModerator({ twitch_user_id: 'del_mod_1', username: 'del_a' });
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'DELETE',
      cookie: session,
      body: { twitch_user_id: 'del_mod_1' }
    });
    expect(res.status).toBe(200);

    const { data } = await testDb.from('moderators').select('active').eq('twitch_user_id', 'del_mod_1').single();
    expect(data?.active).toBe(false); // soft delete — row preserved
  });

  test('2: twitch_user_id not in table → 404', async () => {
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'DELETE',
      cookie: session,
      body: { twitch_user_id: 'no_such_mod' }
    });
    expect(res.status).toBe(404);
  });

  test('3: mod already inactive → 404', async () => {
    await testDb.from('moderators').insert({
      twitch_user_id: 'inactive_mod', username: 'inact', added_by: 'b', active: false
    });
    const session = await createBroadcasterSession();
    const res = await api('/api/moderators', {
      method: 'DELETE',
      cookie: session,
      body: { twitch_user_id: 'inactive_mod' }
    });
    expect(res.status).toBe(404);
  });

  test('4: mod session → 403', async () => {
    const session = await createModSession();
    const res = await api('/api/moderators', {
      method: 'DELETE',
      cookie: session,
      body: { twitch_user_id: 'any_mod' }
    });
    expect(res.status).toBe(403);
  });

  test('5: no session → 401', async () => {
    const res = await api('/api/moderators', {
      method: 'DELETE',
      body: { twitch_user_id: 'any_mod' }
    });
    expect(res.status).toBe(401);
  });
});
