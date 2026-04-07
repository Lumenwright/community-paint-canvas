# Testing

Integration tests cover EBS API routes using Vitest with real Supabase and real JWT generation. There are no unit tests, no E2E tests, and no CI pipeline yet — the test suite is entirely integration-focused and requires a running local Supabase instance.

---

## Framework

- **Runner:** Vitest 2.x
- **Mode:** Sequential single-fork (`pool: 'forks'`, `singleFork: true`) — tests run one at a time to avoid DB state conflicts
- **Timeout:** 15 seconds per test
- **Config:** `web/vite.config.ts` (or `web/vitest.config.ts`)

---

## File Layout

```
web/tests/
  setup.ts              # Loads web/.env.test before all suites
  helpers/
    auth.ts             # Real JWT generation via jose (no mocking)
    seed.ts             # Seed helpers — creates drawings, settings, moderators
    reset.ts            # resetDb() — wipes and re-seeds before each test
    fetch.ts            # api() wrapper — fetch with redirect: 'manual', base URL
  api/
    <one file per route group>   # e.g. drawings.test.ts, bits.test.ts, auth.test.ts
```

---

## Environment Setup

- `web/.env.test` — test credentials (gitignored), loaded by `setup.ts` via `dotenv`
- Requires local Supabase running (`pnpm db:start`) and dev server on `:5173`
- `PUBLIC_DEV_MODE=true` — enables test bypass paths (e.g. Bits confirm skipping)

---

## Test Structure Pattern

```typescript
describe('POST /api/drawings', () => {
  beforeAll(resetDb)          // clean slate before suite
  beforeEach(resetDb)         // clean slate before each test

  test('1. rejects unauthenticated requests', async () => { ... })
  test('2. creates drawing for authenticated viewer', async () => { ... })
  // numbered to match the rework-tests-plan-2026.md test plan
})
```

---

## Key Helpers

### `api()` fetch wrapper (`tests/helpers/fetch.ts`)
- Sets base URL to `http://localhost:5173`
- `redirect: 'manual'` — captures 3xx redirects instead of following them (needed for PKCE callback tests)
- Attaches session cookies from auth helpers

### Auth helpers (`tests/helpers/auth.ts`)
- Generates **real JWTs** via `jose` — same library used by production code
- No mocking of JWT verification — tests exercise the real auth path
- Helpers for viewer sessions, mod sessions, and broadcaster sessions

### DB helpers (`tests/helpers/reset.ts`, `seed.ts`)
- `resetDb()` — truncates all tables, re-applies seed data
- `testDb` — direct Supabase client with service role key for assertions
- Seed functions for drawings in each state, moderator records, settings

---

## Mocking Strategy

**Minimal mocking by design:**
- Supabase: real local instance (no mocks)
- JWT verification: real `jose` (no mocks)
- Twitch API calls: skipped via `test_` prefix on `bits_tx_id` + `PUBLIC_DEV_MODE=true`
- No HTTP interceptors (msw, nock, etc.)

---

## Running Tests

```bash
# Prerequisites
pnpm db:start        # local Supabase on port 44xxx
cd web && pnpm dev   # SvelteKit dev server on :5173

# Run tests
cd web && pnpm test
```

---

## Coverage Gaps

| Gap | Status |
|-----|--------|
| Unit tests (lib functions, helpers) | None — not yet written |
| Coverage tooling (c8, istanbul) | Not configured |
| E2E tests (Playwright) | Not yet written |
| CI pipeline | Not configured |
| Extension panel tests | Not yet written |
| Overlay / mod dashboard tests | Not yet written |

---

## Test Plan Reference

The full Phase 1 test plan is at `rework-plans/rework-tests-plan-2026.md`. Test case numbers in test files correspond to numbered items in that document.
