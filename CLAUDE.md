# Community Paint Canvas — Claude Context

## Project Overview

A community drawing app where Twitch viewers draw doodles on an external website, a mod approves them, then the viewer spends Twitch Bits to put their drawing live on a stream overlay canvas. Drawings fade out after a broadcaster-configurable grace period.

**Stack:** TypeScript/Node.js, SvelteKit + Svelte 5, Supabase (Postgres + Realtime), Twitch Extensions Bits API, Twitch PKCE OAuth.

**Deployment:** Vercel (`web/`), Twitch CDN (`extension/`), Supabase cloud.

---

## Project Structure

```
package.json              # pnpm workspace root
pnpm-workspace.yaml

extension/                # Twitch Extension panel — Svelte 5 + Vite (Phase 4)

web/                      # SvelteKit — drawing site + EBS API + overlay + mod dashboard
  src/
    lib/
      server/
        supabase.ts       # Server-side Supabase client (service role key)
        twitch-jwt.ts     # Extension JWT verification + handoff token signing
        twitch-oauth.ts   # PKCE token exchange helpers
        session.ts        # Signed httpOnly session cookie helpers
        auth.ts           # Shared auth guards (requireSession, requireMod, etc.)
      client/
        supabase.ts       # Browser Supabase client (anon key, for Realtime)
    routes/
      +page.svelte        # Drawing site (Phase 3)
      overlay/            # OBS browser source (Phase 2)
      mod/                # Mod dashboard (Phase 2)
      api/                # All EBS API routes (Phase 1 complete)
    hooks.server.ts       # Session cookie parsing + CORS headers
    app.d.ts              # SessionData type + App.Locals
  tests/
    helpers/              # auth.ts, seed.ts, reset.ts, fetch.ts
    api/                  # Integration test suites (one file per route group)
  vercel.json             # Vercel Cron config (*/1 * * * * → /api/cron/expire)
  .env.example
  .env.test               # Test credentials (gitignored)

supabase/
  config.toml             # Local dev config (ports shifted to 44xxx for Windows)
  migrations/
    001_initial_schema.sql
    002_rls_policies.sql
    003_seed_data.sql     # Default settings + moderator usernames from data.json

rework-plans/
  rework-plan-2026.md
  rework-tests-plan-2026.md
```

---

## Credentials / Secrets (never committed)

`web/.env` (gitignored). See `web/.env.example` for all required keys. Key vars:
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — server-side DB access
- `TWITCH_EXTENSION_CLIENT_ID` + `TWITCH_EXTENSION_SECRET` — Extension JWT verification
- `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` — PKCE OAuth
- `SESSION_SECRET` — signs session cookies and handoff tokens
- `BROADCASTER_TWITCH_ID` — grants broadcaster-level access
- `CRON_SECRET` — protects `/api/cron/expire`

---

## 2026 Rework (branch: `2026-rework`)

The full rework plan is at [rework-plans/rework-plan-2026.md](rework-plans/rework-plan-2026.md).
The Phase 1 test plan is at [rework-plans/rework-tests-plan-2026.md](rework-plans/rework-tests-plan-2026.md).

**Direction:** Replace the entire stack with a pnpm monorepo:
- **`extension/`** — Svelte 5 + Vite, Twitch Extension Panel (payment gateway + status display only, no drawing canvas)
- **`web/`** — SvelteKit + Supabase (drawing site, stream overlay, mod dashboard, EBS API)
- **Database** — Supabase (Postgres + Realtime WebSockets) replaces Firebase
- **Payment** — Twitch Bits via Extensions API replaces Tiltify; **moderation happens BEFORE Bits are spent** (no refund needed on rejection)
- **Auth** — Twitch PKCE replaces implicit OAuth; Extension users get seamlessly auto-logged into the drawing site via a signed 60s handoff token

**Key design decisions:**
- Drawing happens on the external website (full-size canvas), not inside the small Extension panel
- Bits are only spent after mod approval — rejected drawings cost the viewer nothing
- Alpha fading is computed client-side from `approved_at`/`expires_at` timestamps (no backend alpha column)
- Canvas rendering uses OffscreenCanvas bitmap cache + `requestAnimationFrame` (GPU-composited)
- Fade timing and Bits SKU/amount are broadcaster-configurable via the mod dashboard
- Cancel available in both `pending_review` and `approved_pending_bits` states (small text link)

---

## Coding Guidelines

1. **Flag anti-patterns first.** If a requested change goes against modern best practices, say so and confirm before implementing. Suggest alternatives that meet the same goal.
2. **Follow framework conventions.** Use the stack's established patterns (SvelteKit routing, server/client module split, etc.) over custom structures.
3. **Comments describe flow, not mechanics.** Reading only the comments in a file should give the high-level purpose and flow. Comment on *why* and *where this fits*, not what the code does line-by-line.
4. **Human-readable over clever.** Prefer clear, explicit code over terse abstractions or micro-optimisations that don't meaningfully improve performance.
5. **Reuse over duplication. Follow SOLID.** Modularise shared logic, single responsibility per module, avoid copy-paste. Code will be reviewed and extended later.
6. **Security: flag tradeoffs with severity rating.** Implement best security practices. When there is a meaningful UX tradeoff, surface it with a severity rating and confirm before implementing.
7. **Keep documentation in sync.** When code changes affect architecture, API contracts, or flows described in CLAUDE.md or the rework plan files, update them in the same pass.

---

## Development Setup

Prerequisites: Docker Desktop running, Node.js, pnpm.

```bash
pnpm install                    # install all workspace deps
pnpm db:start                   # spin up local Supabase (first run pulls Docker images)
cp web/.env.example web/.env    # fill in credentials
cd web && pnpm dev              # start SvelteKit dev server on :5173
pnpm test                       # run integration tests (needs dev server + Supabase running)
```

Local Supabase Studio: http://127.0.0.1:44323
