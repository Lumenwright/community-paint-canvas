# Codebase Structure

**Analysis Date:** 2026-04-06

A pnpm monorepo with two deployable packages (`web/` and `extension/`) plus a `supabase/` directory for database migrations. Phase 1 (EBS API + integration tests) is complete and on disk. Phase 2 (overlay, mod dashboard UI) and Phase 3 (drawing site UI) and Phase 4 (`extension/`) are planned but not yet implemented. The `extension/` package does not exist on disk yet.

---

## Directory Layout

```
community-paint-canvas/
├── CLAUDE.md                     # Project context + coding guidelines
├── package.json                  # pnpm workspace root (scripts: test, db:start, etc.)
├── pnpm-workspace.yaml           # Declares workspaces: [web, extension]
├── pnpm-lock.yaml                # Lockfile
│
├── .planning/                    # GSD planning documents (not committed to main workflow)
│   └── codebase/                 # Codebase map documents (this file lives here)
│
├── rework-plans/                 # Planning docs for the 2026 rework
│   ├── rework-plan-2026.md       # Full architecture + UX flow + schema + phase breakdown
│   └── rework-tests-plan-2026.md # Phase 1 integration test plan
│
├── supabase/                     # Local Supabase configuration + migrations
│   ├── config.toml               # Local dev config (ports shifted to 44xxx for Windows)
│   └── migrations/
│       ├── 001_initial_schema.sql  # All tables: drawings, queue, settings, moderators, canvas_history
│       ├── 002_rls_policies.sql    # Row-level security (public reads, service-role writes)
│       └── 003_seed_data.sql       # Default settings rows + moderator whitelist from data.json
│
├── extension/                    # [MISSING — Phase 4] Twitch Extension Panel
│                                 # Will be: Svelte 5 + Vite, static build for Twitch CDN
│                                 # See rework-plans/rework-plan-2026.md for planned structure
│
└── web/                          # SvelteKit app — drawing site, EBS API, overlay, mod dashboard
    ├── package.json
    ├── svelte.config.js
    ├── tsconfig.json
    ├── vite.config.ts
    ├── vitest.config.ts          # Vitest config for integration tests
    ├── vercel.json               # Cron: { path: /api/cron/expire, schedule: "*/1 * * * *" }
    ├── .env.example              # Documents all required env vars
    │
    └── src/
        ├── app.html              # SvelteKit HTML shell
        ├── app.d.ts              # SessionData interface + App.Locals type augmentation
        ├── hooks.server.ts       # Session cookie parsing + CORS headers (runs on every request)
        │
        ├── lib/
        │   ├── server/           # Server-only modules (never bundled into client)
        │   │   ├── supabase.ts   # Service-role Supabase client (`db` export); bypasses RLS
        │   │   ├── auth.ts       # Auth guards: requireSession, requireMod, requireBroadcaster,
        │   │   │                 #              requireExtJWT, requireCronSecret
        │   │   ├── session.ts    # HS256 session cookie: createSessionCookie, parseSessionCookie
        │   │   ├── twitch-jwt.ts # verifyExtJWT (Extension JWT), signHandoffToken / verifyHandoffToken
        │   │   └── twitch-oauth.ts # PKCE token exchange helpers (viewer + mod login flows)
        │   │
        │   └── client/           # Browser-safe modules
        │       └── supabase.ts   # Anon-key Supabase client for Realtime subscriptions
        │
        └── routes/
            ├── +page.svelte      # [STUB] Drawing site — "coming in Phase 3"
            │
            ├── overlay/          # [MISSING — Phase 2] OBS browser source
            │                     # Will need: +page.svelte (transparent bg, Realtime canvas)
            │
            ├── mod/              # [MISSING — Phase 2] Mod dashboard UI
            │                     # Will need: +page.svelte, +page.server.ts (requireMod guard)
            │
            ├── (auth)/           # [MISSING — Phase 2/3] PKCE login pages
            │                     # Will need: login/+page.svelte, mod-login/+page.svelte
            │
            └── api/              # [COMPLETE — Phase 1] All EBS API endpoints
                │
                ├── auth/
                │   ├── ext-handoff/+server.ts   # POST — Extension JWT → 60s handoff token
                │   ├── callback/+server.ts       # GET  — PKCE callback for viewers
                │   ├── mod-callback/+server.ts   # GET  — PKCE callback for mods
                │   └── logout/+server.ts         # POST — clears session cookie
                │
                ├── drawings/
                │   └── +server.ts               # POST — save new submission (free, pending_review)
                │
                ├── queue/
                │   ├── +server.ts               # GET  — full pending_review queue (mod only)
                │   ├── my-status/+server.ts      # GET  — user's latest status (Extension polls)
                │   └── my-submission/+server.ts  # GET  — user's full submission data
                │
                ├── review/
                │   └── +server.ts               # POST — approve → approved_pending_bits
                │                                #         reject  → rejected + archive
                │
                ├── bits/
                │   └── confirm/+server.ts        # POST — Bits tx confirmed → live + insert drawings
                │
                ├── canvas/
                │   └── reset/+server.ts          # POST — delete all drawings (mod only)
                │
                ├── settings/
                │   └── +server.ts               # GET (public) / PATCH (broadcaster only)
                │
                ├── moderators/
                │   └── +server.ts               # GET/POST/DELETE mod list (broadcaster only)
                │
                └── cron/
                    └── expire/+server.ts         # GET — archive + delete expired drawings
                                                  #       protected by CRON_SECRET header
```

---

## Directory Purposes

**`web/src/lib/server/`:**
- Purpose: Server-only business logic. Never exposed to the browser.
- Key files: `auth.ts` (guards), `session.ts` (cookie crypto), `twitch-jwt.ts` (JWT ops), `supabase.ts` (DB client)
- Import alias: `$lib/server/...`

**`web/src/lib/client/`:**
- Purpose: Browser-safe utilities — currently only the anon Supabase client for Realtime.
- Import alias: `$lib/client/...`

**`web/src/routes/api/`:**
- Purpose: All HTTP API routes. One `+server.ts` per logical group. No HTML rendering.
- Auth pattern: Call the appropriate guard at the top of every handler.
- All routes return JSON. Errors thrown via SvelteKit `error()`.

**`web/tests/`:**
- Purpose: Integration tests against a running dev server + local Supabase.
- Structure: `api/` (one test file per route group) + `helpers/` (auth, seed, reset, fetch utilities)

**`supabase/migrations/`:**
- Purpose: Applied in order by `supabase db push` / `supabase start`. Append-only.
- `001` — schema; `002` — RLS; `003` — seed

---

## Key File Locations

**Entry Points:**
- `web/src/hooks.server.ts` — first code that runs on every server request
- `web/src/app.d.ts` — TypeScript types for `event.locals.session`

**Auth System:**
- `web/src/lib/server/auth.ts` — all auth guard functions
- `web/src/lib/server/session.ts` — session cookie creation/parsing
- `web/src/lib/server/twitch-jwt.ts` — Extension JWT verification + handoff token signing

**Database:**
- `web/src/lib/server/supabase.ts` — server-side `db` client (service role)
- `web/src/lib/client/supabase.ts` — browser `supabase` client (anon key, Realtime)
- `supabase/migrations/001_initial_schema.sql` — canonical table definitions

**Configuration:**
- `web/vercel.json` — Cron schedule
- `web/.env.example` — all required env var names
- `supabase/config.toml` — local Supabase port config

---

## Naming Conventions

**Files:**
- Route files follow SvelteKit convention: `+server.ts`, `+page.svelte`, `+page.server.ts`
- Library files: `kebab-case.ts` (e.g., `twitch-jwt.ts`, `twitch-oauth.ts`)
- Test files: `kebab-case.test.ts` mirroring the route group they test

**Directories:**
- Route groups: `kebab-case` (e.g., `ext-handoff/`, `my-status/`, `canvas/`)
- Library split: `server/` vs `client/` inside `lib/`

---

## Where to Add New Code

**New API endpoint:**
- Create `web/src/routes/api/<group>/+server.ts`
- Add auth guard call at the top of each handler
- Add integration test at `web/tests/api/<group>.test.ts`

**New server utility/helper:**
- Add to `web/src/lib/server/` as a new `kebab-case.ts` file

**New client-side Svelte component (overlay, mod dashboard, drawing site):**
- Shared canvas components: `web/src/lib/canvas/` (create this directory)
- Route-specific components: co-locate as `ComponentName.svelte` beside the `+page.svelte`

**New database table:**
- Add a new numbered migration: `supabase/migrations/00N_description.sql`
- Never modify existing migration files

**Shared stroke renderer (used by both web and extension):**
- Planned location per rework plan: `web/src/lib/canvas/StrokeRenderer.ts`
- Also referenced in `extension/src/lib/canvas/StrokeRenderer.ts` (when extension/ is created)

---

## Phase Status

| Phase | Content | Status |
|-------|---------|--------|
| Phase 1 | EBS API routes + integration tests | Complete — all files on disk |
| Phase 2 | Overlay (`/overlay/`), Mod dashboard (`/mod/`), PKCE login pages | Not started — directories missing |
| Phase 3 | Drawing site UI (`/+page.svelte` fully implemented) | Stub only (`<h1>` placeholder) |
| Phase 4 | Twitch Extension panel (`extension/` package) | Not started — directory missing |

---

## Special Directories

**`supabase/`:**
- Contains: Local Supabase config + migration SQL files
- Generated: No
- Committed: Yes

**`.planning/`:**
- Contains: GSD codebase map documents
- Generated: By GSD tooling
- Committed: No (not in standard git workflow)

**`web/.svelte-kit/`** (not shown — gitignored):
- Contains: SvelteKit build artifacts and generated types
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-04-06*
