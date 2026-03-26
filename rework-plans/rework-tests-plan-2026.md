# Phase 1 Test Plan

## Context

Phase 1 is purely backend API routes — no UI exists yet. The goal of this plan is to define:
1. What testing approach to use and why
2. What to test for each route (including edge cases)
3. How to handle the parts that normally require Twitch (JWT auth, Bits transactions)
4. Whether a mock data consumer / debug UI is needed

---

## TDD Basics (Unity C# dev framing)

In Unity you might write `Assert.AreEqual(expected, actual)` in a test and run it from the Test Runner window. TDD just means writing that assertion *before* writing the code that makes it true, then writing the minimum code to make it pass.

For a web API, each "assertion" is an HTTP request + expected response:
- **Red:** Write a test that says "POST /api/drawings with a valid session should return 201 and a row in the DB." Run it — it fails because the route doesn't exist yet.
- **Green:** Write the route. Run the test — it passes.
- **Refactor:** Clean up without breaking the test.

The value isn't the ritual. It's that every edge case you think about upfront gets locked in as a failing test that can never silently regress.

---

## Integration Tests, Not Unit Tests

**The analogy:** In Unity, a unit test tests one script in isolation (with fake dependencies injected). An integration test runs the whole game loop with real GameObjects and checks the outcome.

For this API, unit tests would test the JWT-verification function with a fake token. But the real bugs will be:
- RLS blocking a route it shouldn't
- A DB constraint firing unexpectedly
- A status transition that the code allows but the business logic shouldn't
- JWT validation passing for a token from the wrong extension

None of those are caught by testing functions in isolation. We want **integration tests** that fire a real HTTP request → hit real routes → hit a real local Postgres database → assert the response *and* the DB state.

**What we DO mock (only one thing):** The Twitch external API call in `POST /api/bits/confirm` (the transaction verification call to `https://api.twitch.tv/helix/extensions/transactions`). We can't call the real Twitch API in tests. This is already handled by the plan's `PUBLIC_DEV_MODE=true` flag — transaction IDs starting with `test_` skip the Twitch verification call entirely.

Everything else is real: real Supabase (local), real JWT generation, real DB constraints.

---

## Toolchain

| Tool | Role | Unity analogy |
|------|------|---------------|
| **Vitest** | Test runner | Unity Test Runner |
| **Local Supabase** (`supabase start`) | Real test database | A local headless game instance |
| **`@sveltejs/kit/test-utils`** or raw `fetch` | Fire HTTP requests at local dev server | `TestClientUtils` |
| **`jose`** | Generate test JWTs (same library as production) | Replicate signing logic in test environment |
| **Bruno** (HTTP client) | Manual exploratory testing, not automated | Playing in the editor manually between test runs |

No mock UI needed for Phase 1. The routes are fully testable without any browser involvement.

---

## Project Test Structure

```
web/
  tests/
    helpers/
      auth.ts        # Generate valid/invalid JWTs for tests
      seed.ts        # Insert known DB states (e.g., a user with pending submission)
      reset.ts       # Truncate tables between test suites
    api/
      drawings.test.ts
      queue.test.ts
      bits.test.ts
      review.test.ts
      settings.test.ts
      moderators.test.ts
      cron.test.ts
      auth-handoff.test.ts
  vitest.config.ts
```

Each test file follows the pattern:
```typescript
beforeAll(async () => { await resetDb(); });
afterEach(async () => { await resetDb(); });

test('POST /api/drawings: valid session → 201 + pending_review in DB', async () => {
  const session = await createTestSession({ twitch_user_id: 'user_1', username: 'alice' });
  const res = await fetch('/api/drawings', {
    method: 'POST',
    headers: { Cookie: `session=${session}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ strokes: [{x:1,y:1},{x:2,y:2}], base_width: 7 })
  });
  expect(res.status).toBe(201);
  const { entry_id } = await res.json();
  const row = await db.from('queue').select('*').eq('entry_id', entry_id).single();
  expect(row.data.status).toBe('pending_review');
});
```

---

## Auth Test Helpers

These helpers generate tokens using the same `jose` library as production — no mocking needed.

```typescript
// helpers/auth.ts

// Generate a valid Extension JWT (mimics what window.Twitch.ext provides)
generateExtJWT({ twitch_user_id, username, expiry = '+5m' })

// Generate an expired Extension JWT
generateExpiredExtJWT({ twitch_user_id })

// Generate a JWT signed with the WRONG secret (simulates tampered token)
generateBadSignatureExtJWT({ twitch_user_id })

// Generate a valid drawing-site session cookie
createTestSession({ twitch_user_id, username, is_mod = false, is_broadcaster = false })

// Generate a mod session cookie
createModSession({ twitch_user_id, username })

// Generate a broadcaster session cookie
createBroadcasterSession({ twitch_user_id, username })
```

---

## Status Machine (Critical)

The queue entry moves through these states. Every arrow is an API call. Anything not on this diagram should be blocked.

```
                         [user cancel]
                               │
[submit drawing] → pending_review ──[mod approve]──→ approved_pending_bits
                        │                                   │           │
                  [mod reject]                   [user cancel]   [bits confirm]
                        │                                   │           │
                    rejected                          cancelled         live
                                                                         │
                                                               [cron expire]
                                                               OR [broadcaster
                                                                  clear canvas]
                                                                         │
                                                                (deleted from
                                                               drawings table,
                                                               archived to
                                                               canvas_history)
```

**Invalid transitions that must be blocked at the API layer:**
- `pending_review` → `live` (bypassing both mod review and Bits)
- `rejected` → anything (can't un-reject)
- `cancelled` → anything (can't un-cancel)
- `live` → `cancelled` (can't cancel what's on stream)
- `approved_pending_bits` → `pending_review` (can't put back in queue)

---

## Test Cases by Route

### `POST /api/drawings`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid session, valid strokes | 201, `status = pending_review` in DB |
| 2 | No session cookie | 401 |
| 3 | Expired session cookie | 401 |
| 4 | Missing `strokes` field | 422 |
| 5 | Empty strokes array `[]` | 422 |
| 6 | User already has a `pending_review` submission | 409 (one active submission per user) |
| 7 | User already has an `approved_pending_bits` submission | 409 |
| 8 | User has a `rejected` submission (should be allowed to resubmit) | 201 |
| 9 | User has a `cancelled` submission (should be allowed to resubmit) | 201 |
| 10 | `base_width` out of range (e.g., 999) | 422 |

### `GET /api/queue/my-status`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid JWT, user has `pending_review` submission | 200, `{status: 'pending_review'}`, no strokes |
| 2 | Valid JWT, user has `approved_pending_bits` | 200, `{status: 'approved_pending_bits', strokes: [...]}` |
| 3 | Valid JWT, user has `live` submission | 200, `{status: 'live'}` |
| 4 | Valid JWT, no submissions at all | 200, `{status: null}` |
| 5 | Expired JWT | 401 |
| 6 | JWT with wrong signature | 401 |
| 7 | JWT with wrong extension `client_id` claim | 401 |
| 8 | No Authorization header | 401 |

### `DELETE /api/queue/my-submission`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Cancel from `pending_review` | 200, status → `cancelled`, row in `canvas_history` |
| 2 | Cancel from `approved_pending_bits` | 200, status → `cancelled`, row in `canvas_history` |
| 3 | No active submission exists | 404 |
| 4 | Submission is `live` (on stream) | 409 |
| 5 | Submission is already `cancelled` | 404 |
| 6 | Submission is `rejected` | 404 |
| 7 | Invalid/expired JWT | 401 |

### `POST /api/bits/confirm`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid JWT, dev mode (`test_` tx ID), submission is `approved_pending_bits` | 200, status → `live`, row inserted into `drawings` |
| 2 | Submission status is `pending_review` (not yet approved) | 409 |
| 3 | Submission belongs to different `twitch_user_id` than JWT | 403 |
| 4 | Same `bits_tx_id` used twice (retry) | 409 (UNIQUE constraint) |
| 5 | Invalid/expired JWT | 401 |
| 6 | `entry_id` does not exist | 404 |
| 7 | Confirm succeeds → `drawings.expires_at` is correctly set from current settings | 200, verify `expires_at = approved_at + grace + fade` |

### `GET /api/queue`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Mod session, 3 items in `pending_review` | 200, array of 3 |
| 2 | Mod session, no items | 200, `[]` |
| 3 | Regular user session (not a mod) | 403 |
| 4 | No session | 401 |

### `POST /api/review`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Approve a `pending_review` submission | 200, status → `approved_pending_bits` |
| 2 | Reject a `pending_review` submission | 200, status → `rejected`, row in `canvas_history` |
| 3 | Try to approve a `rejected` submission | 409 |
| 4 | Try to approve a `live` submission | 409 |
| 5 | `entry_id` does not exist | 404 |
| 6 | Regular user (not a mod) | 403 |
| 7 | No session | 401 |

### `GET /api/cron/expire`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | 2 expired drawings, valid `CRON_SECRET` | 200, both deleted from `drawings`, both in `canvas_history` with `status='expired'` |
| 2 | No expired drawings | 200, nothing changes |
| 3 | Mix: 1 expired, 2 not yet expired | 200, only the 1 expired row deleted |
| 4 | Drawing with `expires_at = NULL` (grace_seconds=0 mode) | 200, not deleted even if `approved_at` is old |
| 5 | Wrong `CRON_SECRET` header | 401 |
| 6 | No `Authorization` header | 401 |

### `GET /api/settings`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No auth, seeded defaults | 200, `{grace_seconds: 1200, fade_seconds: 120, bits_sku: '...', bits_amount: 100}` |

### `PATCH /api/settings`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Broadcaster, update `grace_seconds` to 600 | 200, DB row updated |
| 2 | Broadcaster, update `grace_seconds` to `0` (never expire) | 200, DB row updated — **valid special value** |
| 3 | Broadcaster, update `grace_seconds` to `-1` | 422 — negative values invalid |
| 4 | Mod session (not broadcaster) | 403 |
| 5 | No session | 401 |

### `grace_seconds = 0` behaviour (no-expiry mode)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Approve a drawing when `grace_seconds = 0` → check `expires_at` | `drawings.expires_at` is `NULL` |
| 2 | Cron runs with only `expires_at = NULL` rows | 200, nothing deleted, `canvas_history` unchanged |
| 3 | Mix: 1 row with `expires_at = NULL`, 1 row expired | Only the expired row deleted; NULL row untouched |
| 4 | Broadcaster fires `POST /api/canvas/reset` when `grace_seconds = 0` | All drawings archived with `status = 'expired'`, `drawings` table empty |

### `POST /api/canvas/reset`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Mod session, 3 live drawings | 200, all 3 deleted from `drawings`, all 3 in `canvas_history` with `status = 'expired'` |
| 2 | Broadcaster session | 200 — broadcaster has at least mod-level access |
| 3 | No drawings on canvas | 200, nothing changes, no `canvas_history` rows added |
| 4 | Mix: 1 live drawing + 2 `pending_review` in queue | Only `drawings` cleared; `queue` rows untouched |
| 5 | Live drawing with `expires_at = NULL` (never-expire mode) | 200, deleted from `drawings` and archived — reset overrides never-expire |
| 6 | Regular user session (not a mod) | 403 |
| 7 | No session | 401 |

> **Open question:** `canvas_history.status` currently only allows `'approved' \| 'rejected' \| 'expired' \| 'cancelled'`. A broadcaster reset is semantically distinct from expiry — decide whether to add `'reset'` to the check constraint or keep using `'expired'` before implementing. This affects test case 1 and 5.

---

### `GET /api/moderators`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Broadcaster session, 3 active mods in DB | 200, array of 3 |
| 2 | Broadcaster session, no mods | 200, `[]` |
| 3 | Mod session (not broadcaster) | 403 |
| 4 | Regular user session | 403 |
| 5 | No session | 401 |

### `POST /api/moderators`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Broadcaster, valid `{twitch_user_id, username}` | 201, row in `moderators` with `active = true`, `added_by = broadcaster_twitch_user_id` |
| 2 | Broadcaster, duplicate `twitch_user_id` | 409 |
| 3 | Broadcaster, missing `username` field | 422 |
| 4 | Broadcaster, missing `twitch_user_id` field | 422 |
| 5 | Mod session (not broadcaster) | 403 |
| 6 | No session | 401 |

### `DELETE /api/moderators`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Broadcaster, existing mod `twitch_user_id` | 200, `moderators.active = false` (soft delete — preserves audit trail) |
| 2 | Broadcaster, `twitch_user_id` not in table | 404 |
| 3 | Broadcaster, mod already inactive | 404 (treat as not found) |
| 4 | Mod session (not broadcaster) | 403 |
| 5 | No session | 401 |

> **Note:** Soft delete (`active = false`) is assumed over hard delete to preserve the `added_by` audit trail. Confirm this before implementing.

---

### `POST /api/auth/ext-handoff`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid Extension JWT | 200, `{token: '<signed-jwt>'}`, token verifiable with SESSION_SECRET, exp ~60s |
| 2 | Expired Extension JWT | 401 |
| 3 | JWT signed with wrong secret | 401 |
| 4 | JWT with wrong extension `client_id` | 401 |
| 5 | No Authorization header | 401 |

### `GET /api/auth/callback` and `GET /api/auth/mod-callback`

These routes complete the PKCE flow by exchanging a `code` for a Twitch access token — which requires calling Twitch's token endpoint. This is the second thing we must mock (alongside `bits/confirm` in dev mode). The mock replaces the token exchange function so tests never hit Twitch.

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Valid `code` + matching `state`, mock exchange returns token | Redirects to `/` (or `/mod`), sets signed httpOnly session cookie |
| 2 | Valid flow for mod callback | Redirects to `/mod`, session cookie contains `is_mod = true` |
| 3 | Missing `code` param | Redirects to login page (no error thrown at client) |
| 4 | `state` param missing | 400 — CSRF protection, state is required |
| 5 | `state` param does not match stored value | 400 — CSRF mismatch |
| 6 | Mock exchange returns an error (e.g. code expired) | Redirects to login page with error param |
| 7 | After successful callback, `?code=` and `?state=` are stripped from URL | Verify redirect URL is clean |

> **How to mock:** Inject the Twitch token exchange as a dependency into the callback handler (rather than importing it directly). In tests, provide a stub that returns a known fake token. This is the standard pattern for testing OAuth callbacks without network calls.

---

## DB State Verification

After each mutating test, assert the DB state directly — not just the HTTP response code. Example:

```typescript
// Don't just check res.status === 200
// Also check:
const row = await supabase.from('queue').select('*').eq('entry_id', id).single();
expect(row.data.status).toBe('cancelled');

const history = await supabase.from('canvas_history').select('*').eq('entry_id', id).single();
expect(history.data.status).toBe('cancelled');
```

This catches bugs where the route returns 200 but forgot to write to `canvas_history`, or updated the wrong column.

---

## What to Seed for Tests

A `seed.ts` helper that creates DB rows in any known state:

```typescript
seed.pendingReviewSubmission({ twitch_user_id: 'user_1' })   // → returns entry_id
seed.approvedPendingBitsSubmission({ twitch_user_id: 'user_1' })
seed.liveDrawing({ twitch_user_id: 'user_1', expires_in_seconds: 60 })
seed.expiredDrawing({ twitch_user_id: 'user_1' })  // expires_at in the past
seed.moderator({ twitch_user_id: 'mod_1', username: 'mod_alice' })
```

Each seed function inserts rows directly into Supabase using the service role client (bypassing RLS). This is the fastest way to set up preconditions without going through the API.

---

## What About a Debug UI?

**Short answer: not needed for Phase 1, but a `.http` file is useful now and a `/dev` route will be useful in Phase 2.**

- **Automated tests** (above) cover correctness.
- **Bruno / `.http` file:** A collection of pre-built HTTP requests (like bookmarked `curl` commands) you can fire against the local dev server manually. Good for exploratory testing when you want to look at the raw response without writing a test yet. Add one alongside the tests.
- **`/dev` route in SvelteKit** (Phase 2 only): Once the UI exists, a dev-only page at `/dev` (blocked in production via an env check) can let you trigger flows manually — generate a fake Extension JWT, fire a handoff, seed the DB with test data, reset to clean state. This is the equivalent of a Unity in-editor debug tool. Build it when Phase 2 starts.

---

## Verification Checklist (Phase 1 Complete When)

- [ ] `supabase start` + `pnpm dev` in `web/` runs without errors
- [ ] All migrations applied successfully (`supabase db push`)
- [ ] `pnpm test` runs all test suites and passes (or clearly fails on unimplemented routes — that's fine before routes are written)
- [ ] The status machine transitions are all covered by at least one test each
- [ ] Every `401`/`403`/`404`/`409`/`422` case has a test
- [ ] The `cron/expire` test verifies both the `drawings` deletion AND the `canvas_history` insert
- [ ] The `bits/confirm` test verifies the `drawings` row `expires_at` is correctly computed from current settings
- [ ] `grace_seconds = 0` produces `expires_at = NULL` on approval, and the cron never deletes it
- [ ] `grace_seconds = -1` is rejected by `PATCH /api/settings` with 422
- [ ] `POST /api/canvas/reset` clears drawings with `expires_at = NULL` just as it clears timed drawings
- [ ] `POST /api/canvas/reset` does not touch `queue` rows
- [ ] `GET/POST/DELETE /api/moderators` all return 403 for non-broadcaster sessions
- [ ] `POST /api/moderators` duplicate `twitch_user_id` returns 409
- [ ] `DELETE /api/moderators` is a soft delete (`active = false`), not a hard delete
- [ ] `GET /api/auth/callback` and `GET /api/auth/mod-callback` strip `code`/`state` from the redirect URL
- [ ] PKCE `state` mismatch returns 400 (CSRF protection verified)
- [ ] The `canvas_history.status` value used by `POST /api/canvas/reset` is decided and consistent with the schema check constraint
