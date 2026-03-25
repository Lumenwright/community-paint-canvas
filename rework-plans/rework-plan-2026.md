# Community Paint Canvas — 2026 Rework Plan

## Context

The app is being reworked to:
1. Replace Tiltify with the **Twitch Extensions Bits API** for payment
2. Modernize the stack (Flask + Vue 2 CDN + 5-second polling → SvelteKit + Supabase + Realtime WebSockets)
3. Improve performance and end-user UI
4. Solo developer on the `2026-rework` branch (currently even with `main`)

**Confirmed choices:**
- Drawing happens on the **external SvelteKit website** (full-size responsive canvas)
- Bits payment happens inside the **Twitch Extension Panel** (the only place the Bits API is available)
- The Extension auto-logs the user into the drawing site via a **short-lived signed handoff token** (no separate PKCE login step for Extension users)
- TypeScript/Node.js backend · Svelte 5 / SvelteKit · Supabase · No need to match old API contracts

---

## UX Flow

Twitch Bits are **not programmatically refundable** once spent — Twitch provides no API for this. To avoid charging users for rejected drawings, the flow is flipped: **moderation happens before Bits are spent.**

```
1. User opens Twitch stream
2. User opens Extension Panel → clicks "Open Drawing Site →"
   → Extension calls POST /api/auth/ext-handoff with its JWT
   → Server verifies JWT, returns a short-lived signed handoff token (60s TTL)
   → Extension opens: https://drawing-site.com/?auth=<handoff-token>
3. Drawing site verifies the handoff token server-side → sets signed httpOnly session cookie
   → Redirects to clean URL. No login prompt. User is immediately on the drawing canvas.
   (PKCE login kept as fallback for users who navigate to the site directly without Extension)
4. User draws → clicks "Submit for Review" → drawing saved for FREE, status: "pending_review"
5. Site shows: "Submitted! A mod will review your drawing."
6. Moderator approves or rejects (no Bits spent yet, so rejection costs the user nothing)
7. If REJECTED: user notified in Extension ("Not approved"). No Bits spent.
8. If APPROVED: Extension detects approval (via polling) → shows drawing preview
   + "Your drawing was approved! Spend X Bits to put it on stream"
9. User clicks Bits button → native Twitch Bits confirm UI → confirms
10. Extension EBS call confirms Bits tx → status becomes "live" → drawing appears on overlay
11. Drawing fades after ~22 min
```

**Handoff token (no extra DB table needed):**
The EBS verifies the Extension JWT → extracts `twitch_user_id` + `username` → returns a short-lived JWT signed with `SESSION_SECRET`: `{ twitch_user_id, username, exp: now + 60s }`. The drawing site verifies this signed JWT, issues the session cookie, strips the `?auth=` param from the URL. Even if the URL is leaked, the token expires in 60s and grants only a drawing-site session.

**Why moderation before Bits:**
- No refund problem: Bits only spent on already-approved drawings
- Clearer value: Bits = "put your art on stream", not "pay to maybe get rejected"
- Mods can reject freely; viewers lose nothing

---

## What Gets Removed

- All Tiltify API calls and donation-matching logic (`invoice.py` Tiltify branch)
- Python `RepeatedTimer` polling threads (`poller.py`, `resolve_invoice()`, `reduce_alpha_value()`)
- Flask, Flask-RESTful, `main.py`, `pixels.py`, `invoice.py`, `keys.py`, `poller.py`
- Vue 2 CDN files (`vue.js`, `script2.js`, `login.js`)
- Firebase SDK and Realtime Database
- Implicit OAuth (token in URL hash)
- `data.json` moderator list (replaced by Supabase `moderators` table)

---

## Architecture Overview

```
community-paint-canvas/
  package.json              # pnpm workspace root
  pnpm-workspace.yaml

  extension/                # Twitch Extension — Svelte 5 + Vite, static build for Twitch CDN
    src/
      main.ts
      App.svelte            # Simple: shows pending drawing + Bits button, or "Open Drawing Site"
      lib/
        canvas/
          StrokePreview.svelte   # Read-only canvas preview of pending drawing
          StrokeRenderer.ts      # Shared rendering module (also used in web/)
        bits/
          BitsButton.svelte
          useBits.ts             # window.Twitch.ext.bits wrapper
        twitch/
          twitch-ext.d.ts        # Type declarations for window.Twitch.ext
          useExtension.ts        # JWT + channel context initialization
    vite.config.ts
    package.json

  web/                      # SvelteKit — drawing site + EBS API + stream overlay + mod dashboard
    src/
      lib/
        server/
          supabase.ts            # Server-side client (service role key)
          twitch-jwt.ts          # Extension JWT verification (HS256, jose library)
          twitch-oauth.ts        # PKCE token exchange helpers (user login + EBS app token)
          settings.ts            # Read/write canvas settings from DB
        client/
          supabase.ts            # Browser client (anon key, for Realtime)
        canvas/
          DrawingCanvas.svelte   # Full-size responsive user drawing surface
          OverlayCanvas.svelte   # OBS browser source canvas
          StrokeRenderer.ts      # Shared stroke rendering module
      routes/
        +page.svelte             # Drawing site (public, Twitch login required to submit)
        overlay/
          +page.svelte           # OBS browser source (no auth, transparent background)
        mod/
          +page.svelte           # Mod dashboard
          +page.server.ts        # Session auth guard
        (auth)/
          login/+page.svelte     # Twitch PKCE login (for drawing site users, direct access)
          mod-login/+page.svelte # Twitch PKCE login (for mods)
        api/
          drawings/
            +server.ts           # POST new submission (free, status: pending_review)
          queue/
            my-status/+server.ts # GET current user's submission status (Extension polls)
            +server.ts           # GET full pending_review queue (mod only)
          review/
            +server.ts           # POST approve/reject (mod only)
          bits/
            confirm/+server.ts   # POST from Extension: link Bits tx → live + insert drawing
          canvas/
            reset/+server.ts     # POST reset canvas (mod only)
          settings/
            +server.ts           # GET (public) / PATCH (broadcaster only)
          moderators/
            +server.ts           # GET/POST/DELETE mod list (broadcaster only)
          auth/
            ext-handoff/+server.ts # POST: Extension JWT → signed handoff token (60s)
            callback/+server.ts    # PKCE callback (drawing site, direct access fallback)
            mod-callback/+server.ts # PKCE callback (mods)
            logout/+server.ts
          cron/
            expire/+server.ts    # GET: archive + delete expired drawings (Vercel Cron)
    svelte.config.js
    vercel.json              # crons: [{ path: /api/cron/expire, schedule: "*/1 * * * *" }]
    package.json

  supabase/
    migrations/
      001_initial_schema.sql
      002_rls_policies.sql
      003_seed_data.sql     # Seeds moderators (from data.json) + default settings
    config.toml
```

---

## Supabase Schema

```sql
-- Approved drawings currently on the canvas (public, visible to overlay)
CREATE TABLE drawings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    text NOT NULL UNIQUE,
  strokes     jsonb NOT NULL,          -- [{x, y}, ...]
  line_widths integer[] NOT NULL,      -- per-segment widths (user base + ±2 variation)
  username    text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,             -- NULL = never expires (when grace_seconds = 0)
                                       -- Otherwise: approved_at + grace_seconds + fade_seconds
  -- NOTE: no alpha column — alpha is computed client-side from timestamps at render time
);

-- Submissions in various states
CREATE TABLE queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  strokes         jsonb NOT NULL,
  line_widths     integer[] NOT NULL,      -- per-segment widths (user base + ±2 variation)
  base_width      smallint NOT NULL DEFAULT 7,  -- user-selected line width (1-15px)
  twitch_user_id  text NOT NULL,
  username        text NOT NULL,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN (
                      'pending_review',        -- submitted for free, awaiting mod decision
                      'approved_pending_bits', -- mod approved, waiting for user to spend Bits
                      'live',                  -- Bits confirmed, drawing on canvas
                      'rejected',              -- mod rejected, no Bits charged
                      'cancelled'              -- user withdrew (from either pending or approved state)
                    )),
  bits_tx_id      text UNIQUE,         -- Twitch transaction ID (set on confirm, dedup key)
  bits_confirmed_at timestamptz,
  reviewed_by     text,
  reviewed_at     timestamptz
);

CREATE INDEX idx_queue_user_status ON queue(twitch_user_id, status);
CREATE INDEX idx_queue_status ON queue(status);

-- Canvas and submission settings (broadcaster-configurable, public read)
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Default seed values:
-- ('grace_seconds',  1200)        -- seconds before fading starts; 0 = never expire (no fade, drawings stay until manually cleared)
-- ('fade_seconds',   120)         -- 2 min fade duration (ignored when grace_seconds = 0)
-- ('bits_sku',       'submit_100') -- active Twitch Bits product SKU (from Developer Console)
-- ('bits_amount',    100)          -- display amount shown in UI (must match SKU price)

-- Moderator whitelist (replaces data.json)
CREATE TABLE moderators (
  twitch_user_id  text PRIMARY KEY,
  username        text NOT NULL,
  added_by        text NOT NULL,
  added_at        timestamptz NOT NULL DEFAULT now(),
  active          boolean NOT NULL DEFAULT true
);

-- Archive of all resolved items (never deleted — append only)
CREATE TABLE canvas_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    text NOT NULL,
  strokes     jsonb NOT NULL,
  line_widths integer[] NOT NULL,
  username    text NOT NULL,
  status      text NOT NULL CHECK (status IN ('approved','rejected','expired','cancelled')),
  resolved_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON drawings FOR SELECT USING (true);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON settings FOR SELECT USING (true);
-- queue, moderators, canvas_history: no client policies (service role key only, via API routes)
```

Enable Supabase Realtime on `drawings` (INSERT/DELETE for overlay) and `settings` (UPDATE, so fade changes apply live to overlay without reload).

---

## Key API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/drawings` | User session | Save drawing for free → `pending_review` |
| `GET` | `/api/queue/my-status` | Extension JWT | Current user's latest submission (status + strokes if `approved_pending_bits`) |
| `DELETE` | `/api/queue/my-submission` | Extension JWT | Cancel submission (`pending_review` or `approved_pending_bits` → `cancelled`) |
| `POST` | `/api/bits/confirm` | Extension JWT | Link Bits tx → `live` + insert into `drawings` (atomic) |
| `GET` | `/api/queue` | Mod session | Full `pending_review` queue for mod dashboard |
| `POST` | `/api/review` | Mod session | Approve → `approved_pending_bits`; Reject → `rejected` |
| `POST` | `/api/canvas/reset` | Mod session | Archive all `drawings` → delete |
| `GET` | `/api/settings` | None (public) | Returns all settings (overlay + Extension read on load) |
| `PATCH` | `/api/settings` | Broadcaster session | Update grace/fade/bits settings |
| `GET/POST/DELETE` | `/api/moderators` | Broadcaster session | Manage mod list |
| `POST` | `/api/auth/ext-handoff` | Extension JWT | Returns signed handoff token (60s TTL) for seamless drawing site login |
| `GET` | `/api/auth/callback` | None | PKCE callback for drawing site users (direct access fallback) |
| `GET` | `/api/auth/mod-callback` | None | PKCE callback for mods |
| `GET` | `/api/cron/expire` | `CRON_SECRET` header | Archive + delete expired drawings (Vercel Cron, 1/min) |

---

## Extension Panel States

The Extension is a minimal payment gateway + status display. No drawing canvas.

```
State A: No active submission
  → "Want to draw on stream?"
  → [Open Drawing Site →] (triggers ext-handoff → opens site with auto-login)

State B: Pending mod review (status = 'pending_review')
  → "Your drawing is in the moderation queue."
  → Small [Cancel ✕] text link → DELETE /api/queue/my-submission
  → Poll /api/queue/my-status every 10s

State C: Approved, awaiting Bits (status = 'approved_pending_bits')
  → StrokePreview canvas (read-only)
  → "Your drawing was approved! Spend X Bits to put it on stream."
  → [Spend X Bits ✏️] → useBits(bits_sku) → onTransactionComplete → POST /api/bits/confirm
  → Small [Cancel ✕] text link → DELETE /api/queue/my-submission (mod's review lost, no Bits charged)

State D: Live on canvas (status = 'live')
  → "Your drawing is live on the stream!"
  → After expiry → back to State A

State E: Rejected (status = 'rejected')
  → "Your drawing was not approved. No Bits were charged."
  → [Try again →] → opens drawing site
```

Extension polls `GET /api/queue/my-status` every 10s (Extension JWT auth). EBS queries `queue WHERE twitch_user_id = <from JWT> ORDER BY submitted_at DESC LIMIT 1`.

---

## Bits Transaction Flow

1. Extension in State C → user clicks Bits button
2. Extension JWT verified server-side (HS256, Extension Secret, `jose` library)
3. `window.Twitch.ext.bits.useBits(bits_sku)` — must be called from click handler (user gesture)
4. `onTransactionComplete(tx)` fires → Extension POSTs to `/api/bits/confirm`:
   ```json
   { "entry_id": "...", "transaction_id": "tx_abc123", "bits_amount": 100 }
   ```
5. EBS verifies tx: `GET https://api.twitch.tv/helix/extensions/transactions?id=tx_abc123` (App Access Token)
6. Checks `bits_tx_id` uniqueness in `queue` (replay protection)
7. Verifies `queue.status = 'approved_pending_bits'` AND `queue.twitch_user_id = <from JWT>`
8. Single DB transaction: `UPDATE queue SET status='live', bits_tx_id=..., bits_confirmed_at=now()` + `INSERT INTO drawings (..., expires_at = now() + grace + fade)`
9. Returns `{ ok: true }` → Extension shows State D

**Dev mode:** `transaction_id` starting with `test_` skips step 5. Gate on `PUBLIC_DEV_MODE=true`.

---

## Modern Client-Side Alpha Fading

No alpha column in DB. The overlay computes alpha from timestamps at render time:

```typescript
function computeAlpha(approvedAt: Date, expiresAt: Date | null, graceSeconds: number): number {
  if (expiresAt === null) return 1.0;  // grace_seconds = 0: drawing never fades
  const now = Date.now();
  const graceEnd = approvedAt.getTime() + graceSeconds * 1000;
  const fadeEnd = expiresAt.getTime();
  if (now < graceEnd) return 1.0;
  if (now >= fadeEnd) return 0.0;
  return 1.0 - (now - graceEnd) / (fadeEnd - graceEnd);  // smooth linear interpolation
}
```

Result: **smooth 60fps fading** with zero backend writes per frame. No step-function artifacts.

When `grace_seconds = 0`, `expires_at` is stored as `NULL` and the drawing is permanently opaque until the broadcaster manually clears the canvas (`POST /api/canvas/reset`).

The Vercel Cron (`*/1 * * * *`, protected by `CRON_SECRET`) skips rows with `NULL` expiry:
```sql
-- In a single transaction (only rows that have an expiry set):
INSERT INTO canvas_history SELECT entry_id, strokes, line_widths, username, 'expired', now()
  FROM drawings WHERE expires_at IS NOT NULL AND expires_at < now();
DELETE FROM drawings WHERE expires_at IS NOT NULL AND expires_at < now();
```
Supabase Realtime fires DELETE events → overlay removes expired bitmaps instantly.

---

## Modern Canvas Rendering (OffscreenCanvas Bitmap Cache)

Each approved drawing is rendered once to an `OffscreenCanvas`, cached as `ImageBitmap`. The `requestAnimationFrame` loop composites cached bitmaps:

```
Supabase Realtime INSERT → renderStrokes() to OffscreenCanvas → createImageBitmap() → cache
requestAnimationFrame  → clearRect → for each bitmap: globalAlpha = computeAlpha(...); drawImage()
Supabase Realtime DELETE → remove from cache → gone next frame
```

`StrokeRenderer.ts` (shared between `extension/` and `web/`):
```typescript
export function renderStrokes(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  strokes: Point[],
  lineWidths: number[],  // pre-computed at submission time (base_width ± 2 per segment)
  color: string
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < strokes.length; i++) {
    const path = new Path2D();
    path.moveTo(strokes[i - 1].x, strokes[i - 1].y);
    path.lineTo(strokes[i].x, strokes[i].y);
    ctx.lineWidth = lineWidths[i] ?? lineWidths[0] ?? 7;
    ctx.stroke(path);
  }
}
```

**Line width — user-controlled:**
Drawing canvas UI has a line width slider (1–15px, default 7). At submission time, `line_widths` = `[base_width + randomInt(-2, 2), ...]` per segment (clamped to 1–20). Organic variation, consistent across all renders. `base_width` stored in `queue` for reference.

**Touch support:** `touchstart/touchmove/touchend` with `touch-action: none`. Normalize `touches[0]` via `getBoundingClientRect()`.

**Clear local canvas button:** A "Clear" button on the drawing page resets the user's in-progress strokes and clears the canvas element — purely client-side, no API call. Allows the user to start over before submitting.

---

## Settings in Mod/Broadcaster UI

| Setting | UI Label | Type | Notes |
|---------|----------|------|-------|
| `grace_seconds` | "Time on canvas before fading (0 = never)" | number (seconds, min 0) | **0 = drawings never expire** — stay until broadcaster manually clears canvas |
| `fade_seconds` | "Fade duration" | number (seconds, min 1) | Ignored when `grace_seconds = 0` |
| `bits_sku` | "Active Bits tier" | dropdown | Pre-created SKUs in Twitch Developer Console |
| `bits_amount` | "Bits required" | number (auto-filled) | Must match SKU price; shown in Extension UI |

**`grace_seconds = 0` behaviour:** `expires_at` is set to `NULL` on approval. The overlay never fades these drawings. The Vercel Cron skips them. Drawings stay until the broadcaster clicks "Clear Canvas" (`POST /api/canvas/reset`), which archives them with `status = 'expired'` and fires a Realtime DELETE — overlay clears instantly.

**Bits tier:** Create multiple products in Twitch Developer Console once (e.g., `submit_50`, `submit_100`, `submit_200`, `submit_500`). Broadcaster picks active tier → `PATCH /api/settings` → Extension reads on load via `GET /api/settings`.

`PATCH /api/settings` is broadcaster-only. All other mod routes (review, reset) require only a valid mod session. `expires_at` is computed once on approval and is unaffected by later settings changes.

---

## Deployment

| Piece | Where |
|-------|-------|
| `extension/` | Twitch CDN (zip upload, Developer Console) |
| `web/` SvelteKit | Vercel, `@sveltejs/adapter-vercel` (free tier) |
| Database + Realtime | Supabase (free tier) |
| Expiry cron | Vercel Cron (`*/1 * * * *` → `/api/cron/expire`) |

**`web/` env vars:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (client, Realtime)
- `TWITCH_EXTENSION_CLIENT_ID`, `TWITCH_EXTENSION_SECRET` (base64, server-only)
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (PKCE + App Access Token)
- `SESSION_SECRET` (cookie signing + handoff token signing)
- `BROADCASTER_TWITCH_ID`
- `CRON_SECRET`
- `PUBLIC_EBS_URL` (referenced in `extension/` to reach the deployed API)
- `PUBLIC_DRAWING_SITE_URL` (shown in Extension as the link to open)

---

## Key Gotchas

- **`useBits()` requires user gesture:** Called from click handler only.
- **Extension CSP:** All JS bundled by Vite. EBS domain in manifest "Allowlisted URL Prefixes". `eval()` blocked — Svelte output is safe.
- **CORS:** Allow `https://<client-id>.ext-twitch.tv` and `https://localhost.rig.twitch.tv` in `hooks.server.ts`.
- **Bits product review:** Twitch must approve before production. Test in Sandbox mode first.
- **Extension review:** ~1-2 weeks. Submit late in Phase 4 only.
- **Replay protection:** `bits_tx_id UNIQUE` handles Extension retries on `/api/bits/confirm`.
- **OffscreenCanvas:** Available in all modern browsers and OBS Chromium.
- **Line widths:** Pre-computed once at submission (base ± 2 per segment). Not randomized on render.
- **`expires_at` is static:** Computed at approval. Settings changes only affect future approvals.
- **Cancel after mod approval:** Mod's review effort is lost but no Bits are charged. Acceptable.
- **Vercel Cron explained:** Like Unity's `InvokeRepeating()` — declares `"schedule": "*/1 * * * *"` in `vercel.json`, Vercel calls the endpoint on that interval. Serverless, free tier included.

---

## Implementation Sequence

**Phase 1 — Backend foundation**
1. Set up pnpm workspace, SvelteKit `web/` project, Supabase project
2. Run migrations, configure RLS, seed moderators from [data.json](data.json) + default settings
3. Build all API routes
4. Test locally against `supabase start`

**Phase 2 — Overlay and mod dashboard**
5. Build overlay: Realtime + OffscreenCanvas + `requestAnimationFrame` + client-side alpha
6. Build mod dashboard: PKCE auth, queue, approve/reject, settings, mod management
7. Deploy to Vercel; test overlay in OBS; verify cron fires

**Phase 3 — Drawing site**
8. Build drawing page: full-size canvas, line width slider, touch, Twitch PKCE fallback, submit
9. Verify end-to-end (no real Bits yet): draw → submit → mod approves → Extension state C → mock confirm → live → fades → expires → archived

**Phase 4 — Twitch Extension**
10. Build Extension: State A–E, handoff button, StrokePreview, Bits button, cancel
11. Test in Developer Rig (simulated Bits, `test_` tx IDs)
12. Upload to Twitch CDN, test in Sandbox on real channel
13. Submit Bits products + Extension for Twitch review

---

## Critical Files to Reference During Implementation

- [invoice.py](invoice.py) — GRACE_TIME=1200, FADE_TIME=120; archive-before-delete pattern
- [static/script2.js](static/script2.js) — stroke rendering loop to replace with Path2D + OffscreenCanvas
- [static/login.js](static/login.js) — mod auth flow and queue workflow to port
- [data.json](data.json) — 6 moderator usernames to seed into `moderators` table
