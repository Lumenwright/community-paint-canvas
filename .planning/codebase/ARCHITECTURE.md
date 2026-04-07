# Architecture

**Analysis Date:** 2026-04-06

Community Paint Canvas is a pnpm monorepo with two deployable packages: `extension/` (Twitch CDN) and `web/` (Vercel). Viewers draw on the SvelteKit web app, mods approve submissions via an API, then the Twitch Extension Panel handles Bits payment — only after approval — so rejected drawings cost viewers nothing. The stream overlay reads live drawing state from Supabase Realtime.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│  Twitch Platform                                                      │
│  ┌──────────────────────────────────┐                                │
│  │  Extension Panel (extension/)    │  Twitch CDN                    │
│  │  Svelte 5 + Vite static build    │                                │
│  │  • "Open Drawing Site" button    │                                │
│  │  • Polls /api/queue/my-status    │                                │
│  │  • Shows approved preview        │                                │
│  │  • Triggers Bits purchase        │                                │
│  └─────────────┬────────────────────┘                                │
└────────────────│────────────────────────────────────────────────────-┘
                 │  HTTPS / Extension JWT
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  web/ — SvelteKit on Vercel                                         │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Drawing Site │  │ EBS API      │  │  Overlay   │  │ Mod Dash  │ │
│  │ /+page.svelte│  │ /api/**      │  │ /overlay/  │  │ /mod/     │ │
│  │ (Phase 3)    │  │ (complete)   │  │ (Phase 2)  │  │ (Phase 2) │ │
│  └─────────────┘  └──────────────┘  └────────────┘  └───────────┘ │
│                                                                      │
│  hooks.server.ts — session cookie parsing + CORS on every request   │
└─────────────────────────────────────────┬──────────────────────────┘
                                          │ service role key
                                          ▼
                          ┌───────────────────────────┐
                          │  Supabase (Postgres +      │
                          │  Realtime WebSockets)      │
                          │  • drawings (live canvas)  │
                          │  • queue (submissions)     │
                          │  • settings                │
                          │  • moderators              │
                          │  • canvas_history (archive)│
                          └───────────────────────────┘
                                   ▲
                                   │ anon key + Realtime
                          ┌────────┴──────────┐
                          │  OBS Overlay       │
                          │  (browser source)  │
                          └───────────────────┘
```

---

## Auth Flows

### Flow A — Extension Handoff (primary path for viewers)

```
Extension Panel                  EBS API                Drawing Site
     │                              │                         │
     │  POST /api/auth/ext-handoff  │                         │
     │  Authorization: Bearer <ext-jwt>                       │
     │─────────────────────────────►│                         │
     │                              │ verifyExtJWT()          │
     │                              │ signHandoffToken (60s)  │
     │◄─────────────────────────────│                         │
     │  { token: "<handoff-jwt>" }  │                         │
     │                              │                         │
     │  Opens: drawing-site.com/?auth=<token>                 │
     │────────────────────────────────────────────────────────►
     │                              │  verifyHandoffToken()   │
     │                              │  createSessionCookie()  │
     │                              │  redirect (strips ?auth)│
     │                        session cookie set (7d, httpOnly)
```

- Extension JWT is HS256, signed by Twitch with the Extension Secret (base64-decoded)
- Handoff token is HS256, signed with `SESSION_SECRET`, 60s TTL
- Session cookie is HS256 JWT, `SESSION_SECRET`, 7d TTL, httpOnly, signed
- No DB lookup needed for session validation — stateless JWT

### Flow B — PKCE OAuth (fallback for direct browser navigation)

```
User (browser)                   EBS API                  Twitch OAuth
     │  GET /auth/login           │                              │
     │  redirect_uri + code       │                              │
     │────────────────────────────────────────────────────────►  │
     │                            │  callback/+server.ts         │
     │                            │  POST /token (code exchange) │
     │                            │◄─────────────────────────────│
     │                            │  createSessionCookie()       │
     │◄──────────────────────────-│  Set-Cookie: session=...     │
```

Two separate PKCE flows: `callback/` for viewers, `mod-callback/` for mods. Mods get `is_mod: true` in their session by checking the `moderators` table during the callback.

### Extension API Auth (no session cookie)

The Extension panel cannot send cookies cross-origin. All Extension-facing API endpoints (`/api/queue/my-status`, `/api/bits/confirm`) accept an Extension JWT in the `Authorization: Bearer` header and call `requireExtJWT()` directly.

---

## Core Data Flow — Drawing Submission to Canvas

```
Drawing Site                EBS API               Extension Panel    OBS Overlay
     │                          │                        │                │
     │  POST /api/drawings      │                        │                │
     │  { strokes, line_widths }│                        │                │
     │─────────────────────────►│                        │                │
     │  { entry_id }            │ queue: pending_review  │                │
     │◄─────────────────────────│                        │                │
     │                          │                        │                │
     │          [Moderator acts via mod dashboard]       │                │
     │                          │                        │                │
     │                          │  POST /api/review      │                │
     │                          │◄───────────────────────│ (mod session)  │
     │                          │ queue: approved_pending_bits            │
     │                          │                        │                │
     │                          │        GET /api/queue/my-status (poll) │
     │                          │◄───────────────────────│                │
     │                          │  { status, strokes }   │                │
     │                          │───────────────────────►│                │
     │                          │  Shows preview + Bits button            │
     │                          │                        │                │
     │                          │  POST /api/bits/confirm│                │
     │                          │◄───────────────────────│                │
     │                          │ queue: live            │                │
     │                          │ drawings: INSERT       │                │
     │                          │                        │  Realtime push │
     │                          │────────────────────────────────────────►
     │                          │                        │  Render drawing│
     │                          │                        │                │
     │          [Vercel Cron: */1 * * * * → /api/cron/expire]            │
     │                          │ drawings: DELETE expired               │
     │                          │ canvas_history: INSERT                 │
```

---

## Moderation-Before-Payment Design

This is the central architectural decision. Twitch Bits are not programmatically refundable. The flow is intentionally reversed:

1. Submission is free (`POST /api/drawings` → `pending_review`)
2. Moderation happens with no money at stake (`POST /api/review`)
3. Bits are spent only on drawings that are already approved (`POST /api/bits/confirm`)

Rejected drawings are archived to `canvas_history` with status `rejected`. No Bits are ever charged for rejected content.

---

## Alpha Fade — Client-Side Computation

There is no `alpha` column in the `drawings` table. The overlay computes fade opacity at render time:

```
alpha = f(now, approved_at, expires_at, grace_seconds, fade_seconds)

if grace_seconds == 0:   alpha = 1.0  (never fades)
if now < approved_at + grace_seconds:   alpha = 1.0  (in grace period)
if now >= expires_at:    alpha = 0.0  (fully faded, cron will delete)
else:   alpha = 1.0 - (now - fade_start) / fade_seconds
```

`expires_at = approved_at + grace_seconds + fade_seconds` is set in `POST /api/bits/confirm` at confirmation time using current settings. Vercel Cron deletes rows where `expires_at < now`.

---

## Canvas Rendering Strategy (Planned — Phase 2)

- `OffscreenCanvas` bitmap cache per drawing to avoid re-rasterizing strokes on every frame
- `requestAnimationFrame` loop composites all bitmaps with computed alpha onto the main canvas
- GPU-composited via CSS `will-change: transform` on the canvas element
- `StrokeRenderer.ts` is a shared module used by both `web/` (overlay + drawing site) and `extension/` (preview)

---

## Layers

**Server Library** (`web/src/lib/server/`):
- Purpose: All server-only logic — DB client, JWT handling, auth guards, session cookies
- Depends on: Supabase, jose, SvelteKit `$env/static/private`
- Used by: All `+server.ts` route files, `hooks.server.ts`

**Client Library** (`web/src/lib/client/`):
- Purpose: Browser-side Supabase client for Realtime subscriptions
- Depends on: `@supabase/supabase-js`, `$env/static/public`
- Used by: Overlay and drawing site Svelte components (Phase 2/3)

**EBS API Routes** (`web/src/routes/api/`):
- Purpose: HTTP API consumed by Extension panel and mod dashboard
- Pattern: One `+server.ts` file per logical endpoint group
- Auth: Via `requireSession`, `requireMod`, `requireBroadcaster`, `requireExtJWT`, or `requireCronSecret`

**SvelteKit Hooks** (`web/src/hooks.server.ts`):
- Purpose: Cross-cutting concerns — session hydration and CORS headers on every request
- Runs before every route handler; populates `event.locals.session`

**Database** (`supabase/`):
- Purpose: Postgres schema + RLS policies + seed data
- Accessed server-side only via service-role client (bypasses RLS)
- Client-side Realtime uses anon key (RLS enforced for public reads)

---

## Error Handling Strategy

- Route handlers throw SvelteKit `error(status, message)` — framework converts to JSON responses
- Auth guards (`requireSession`, `requireMod`, etc.) throw immediately, short-circuiting the handler
- DB errors surface as 500 with the Supabase error message
- Duplicate transaction IDs caught via Postgres unique constraint `bits_tx_id` → 409

---

## Deployment Targets

| Package | Host | Notes |
|---------|------|-------|
| `web/` | Vercel | SvelteKit adapter-vercel; Cron runs every minute |
| `extension/` | Twitch CDN | Static Vite build; uploaded via Twitch Developer Console |
| Database | Supabase cloud | Local dev via Docker on ports 44xxx |

---

*Architecture analysis: 2026-04-06*
