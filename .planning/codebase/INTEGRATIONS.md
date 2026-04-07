# Integrations

The project integrates Supabase (database + realtime), the Twitch Extensions platform (JWT auth, Bits payments), Twitch PKCE OAuth, and Vercel hosting/cron. All integration credentials are env-var gated with no hardcoded secrets.

---

## Supabase

**Role:** Primary database, auth session store, and realtime transport.

| Client | File | Key | Usage |
|--------|------|-----|-------|
| Server-side | `web/src/lib/server/supabase.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — used in API routes and cron |
| Client-side | `web/src/lib/client/supabase.ts` | `SUPABASE_ANON_KEY` | Respects RLS — used for Realtime subscriptions in overlay |

**Schema (4 tables):**
- `drawings` — submitted drawing data, state machine (`pending_review` → `approved_pending_bits` → `live` / `rejected` / `cancelled`)
- `settings` — broadcaster-configurable values (fade duration, Bits SKU/amount)
- `moderators` — Twitch usernames with mod access
- `canvas_history` — approved drawings that have appeared on the live canvas

**Realtime:**
- Overlay subscribes to `canvas_history` inserts/updates via Supabase Realtime WebSockets
- Enables live canvas updates without polling

**Migrations:** `supabase/migrations/` — 003 files (initial schema, RLS policies, seed data)

---

## Twitch Extension JWT

**Role:** Authenticates requests originating from inside the Twitch Extension panel.

- Library: `jose` (HS256 verification)
- File: `web/src/lib/server/twitch-jwt.ts`
- Secret: `TWITCH_EXTENSION_SECRET`
- Client ID: `TWITCH_EXTENSION_CLIENT_ID`

**Handoff token flow:**
1. Extension panel sends its JWT to `POST /api/auth/extension-login`
2. Server verifies the JWT, issues a signed 60-second handoff token
3. Extension panel redirects user to drawing site with the handoff token in the URL
4. Drawing site exchanges handoff token for a session cookie → seamless login without re-auth

---

## Twitch PKCE OAuth

**Role:** Authenticates viewers and moderators via the full Twitch OAuth flow on the drawing site.

- Files: `web/src/lib/server/twitch-oauth.ts`, `web/src/routes/api/auth/`
- Token endpoint: `https://id.twitch.tv/oauth2/token`
- User fetch: `https://api.twitch.tv/helix/users`
- Credentials: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- Two callback routes handle the PKCE exchange

---

## Twitch Bits (Payments)

**Role:** Monetisation — viewers spend Bits to place an approved drawing on the stream canvas.

- Confirmation route: `POST /api/bits/confirm`
- Deduplication: `bits_tx_id` stored on drawing record (idempotent)
- **Key design:** moderation happens *before* Bits are spent — rejected drawings cost the viewer nothing, eliminating refund complexity
- SKU and Bits amount are broadcaster-configurable via the mod dashboard

---

## Vercel

**Role:** Hosting for the `web/` SvelteKit app.

- Adapter: `@sveltejs/adapter-vercel`
- Config: `web/vercel.json`
- **Cron job:** `*/1 * * * *` → `GET /api/cron/expire` — expires drawings whose `expires_at` has passed
- Protected by `CRON_SECRET` header

---

## CORS

Configured in `web/src/hooks.server.ts` to allow requests from:
- `*.ext-twitch.tv` (Twitch CDN)
- Twitch Developer Rig (localhost variants)
- Local development (`localhost:*`)

---

## Environment Variables

| Variable | Visibility | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY` | Public | Anon key (client-side Realtime) |
| `TWITCH_EXTENSION_CLIENT_ID` | Server | Extension client ID |
| `TWITCH_EXTENSION_SECRET` | Server | Extension JWT signing secret |
| `TWITCH_CLIENT_ID` | Server | PKCE OAuth client ID |
| `TWITCH_CLIENT_SECRET` | Server | PKCE OAuth client secret |
| `SESSION_SECRET` | Server | Signs session cookies + handoff tokens |
| `BROADCASTER_TWITCH_ID` | Server | Grants broadcaster-level access |
| `CRON_SECRET` | Server | Protects `/api/cron/expire` |
| `PUBLIC_SUPABASE_URL` | Public | Supabase URL for client-side use |
| `PUBLIC_SUPABASE_ANON_KEY` | Public | Anon key for client-side use |
| `PUBLIC_TWITCH_CLIENT_ID` | Public | Client ID for PKCE flow initiation |
| `PUBLIC_EXT_CLIENT_ID` | Public | Extension client ID for handoff |

---

## Not Present

- No CI/CD pipeline configured
- No error tracking (Sentry, etc.)
- No structured logging service
- No feature flags
- No CDN for static assets beyond Vercel defaults
