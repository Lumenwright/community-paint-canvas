# Requirements: Community Paint Canvas

**Defined:** 2026-04-06
**Core Value:** Viewers see their approved drawing appear on the live stream — Bits = placement, not hope.

## v1 Requirements

### Phase 1 — Backend Foundation (Complete)

- [x] **FOUND-01**: Pnpm monorepo with `web/` (SvelteKit) and `extension/` (Svelte 5 + Vite) packages
- [x] **FOUND-02**: Supabase schema — `drawings`, `queue`, `settings`, `moderators`, `canvas_history` tables
- [x] **FOUND-03**: RLS policies — public read on `drawings` + `settings`; service role only on `queue`, `moderators`, `canvas_history`
- [x] **FOUND-04**: `POST /api/drawings` — save drawing free, status: `pending_review`
- [x] **FOUND-05**: `GET /api/queue/my-status` — Extension JWT auth, returns latest submission for user
- [x] **FOUND-06**: `DELETE /api/queue/my-submission` — cancel from `pending_review` or `approved_pending_bits`
- [x] **FOUND-07**: `GET /api/queue` — mod-only, returns full `pending_review` queue
- [x] **FOUND-08**: `POST /api/review` — mod-only, approve → `approved_pending_bits` or reject → `rejected`
- [x] **FOUND-09**: `POST /api/bits/confirm` — Extension JWT, links Bits tx, atomically sets `live` + inserts into `drawings`
- [x] **FOUND-10**: `POST /api/canvas/reset` — mod-only, archives all drawings + clears canvas
- [x] **FOUND-11**: `GET/PATCH /api/settings` — public read; broadcaster-only write
- [x] **FOUND-12**: `GET/POST/DELETE /api/moderators` — broadcaster-only
- [x] **FOUND-13**: `POST /api/auth/ext-handoff` — Extension JWT → signed 60s handoff token
- [x] **FOUND-14**: `GET /api/auth/callback` + `mod-callback` — PKCE exchange for viewer and mod paths
- [x] **FOUND-15**: `GET /api/cron/expire` — archives + deletes expired drawings (CRON_SECRET protected)
- [x] **FOUND-16**: Integration test suite — Vitest, real local Supabase, real JWTs, no mocking of auth

### Phase 2 — Overlay + Mod Dashboard

#### Overlay

- [ ] **OVER-01**: `/overlay` page renders approved drawings on a full-screen canvas (fills OBS browser source, transparent background)
- [ ] **OVER-02**: Each drawing rendered once to OffscreenCanvas → cached as ImageBitmap
- [ ] **OVER-03**: `requestAnimationFrame` loop composites all cached bitmaps with `globalAlpha = computeAlpha(...)`
- [ ] **OVER-04**: `computeAlpha()` derives fade from `approved_at`, `expires_at`, and `grace_seconds` — smooth linear interpolation, no backend writes
- [ ] **OVER-05**: Supabase Realtime subscription on `drawings` — INSERT adds bitmap to cache, DELETE removes it
- [ ] **OVER-06**: Supabase Realtime subscription on `settings` — UPDATE reloads fade config without page refresh
- [ ] **OVER-07**: Overlay verified working in OBS browser source at localhost (local testing counts as done)

#### Mod Dashboard

- [ ] **MOD-01**: `/mod` page requires mod or broadcaster PKCE session (redirects to mod-login if unauthenticated)
- [ ] **MOD-02**: Queue review UI shows one drawing at a time (oldest first), rendered on canvas
- [ ] **MOD-03**: "Drawing X of N" counter displayed outside the canvas
- [ ] **MOD-04**: Next + Previous buttons navigate queue without approving or rejecting
- [ ] **MOD-05**: Approve button — calls `POST /api/review`, advances to next drawing
- [ ] **MOD-06**: Reject button — calls `POST /api/review`, advances to next drawing
- [ ] **MOD-07**: Empty queue state shown clearly when no pending drawings
- [ ] **MOD-08**: Broadcaster settings UI — configure grace_seconds, fade_seconds, bits_sku, bits_amount
- [ ] **MOD-09**: Mod list management UI — broadcaster can add and remove moderators
- [ ] **MOD-10**: Canvas reset button — broadcaster only, calls `POST /api/canvas/reset`

### Phase 3 — Drawing Site

#### Schema

- [ ] **SCHEMA-01**: Migration adds `color text NOT NULL DEFAULT 'white'` to `queue` table
- [ ] **SCHEMA-02**: Migration adds `color text NOT NULL DEFAULT 'white'` to `drawings` table
- [ ] **SCHEMA-03**: `renderStrokes()` and overlay compositing use `color` from drawing record

#### Drawing Canvas

- [ ] **DRAW-01**: `/` page shows full-size responsive drawing canvas (mouse + touch input)
- [ ] **DRAW-02**: Touch support: `touchstart/touchmove/touchend` with `touch-action: none`, normalized via `getBoundingClientRect()`
- [ ] **DRAW-03**: Line width slider — 1–15px, default 7px
- [ ] **DRAW-04**: Color palette picker — preset colors (e.g. white, red, orange, yellow, green, cyan, blue, purple, pink, black)
- [ ] **DRAW-05**: Clear button resets in-progress strokes client-side (no API call)
- [ ] **DRAW-06**: `line_widths` array pre-computed at submission time (base_width ± 2 per segment, clamped 1–20)

#### Auth + Submission

- [ ] **DRAW-07**: Unauthenticated visitors can draw freely but must log in to submit
- [ ] **DRAW-08**: Extension handoff token (`?auth=<token>`) is verified server-side → session cookie → clean URL redirect
- [ ] **DRAW-09**: PKCE login (`/login`) is fallback for users who navigate directly without Extension
- [ ] **DRAW-10**: Submit button calls `POST /api/drawings`, drawing saved free as `pending_review`
- [ ] **DRAW-11**: Only one active submission per viewer — submit blocked if one is already in any active state

#### Status Display

- [ ] **DRAW-12**: Drawing site shows current submission status (all states: pending_review, approved_pending_bits, live, rejected, cancelled)
- [ ] **DRAW-13**: Status messages guide viewer to next action (e.g. "Check the Extension panel to spend Bits" when approved)
- [ ] **DRAW-14**: Viewer can cancel their submission from the drawing site (any cancellable state)

### Phase 4 — Twitch Extension

#### Extension States

- [ ] **EXT-01**: State A (no submission) — "Want to draw on stream?" + "Open Drawing Site →" button (triggers ext-handoff)
- [ ] **EXT-02**: State B (pending_review) — "Your drawing is in the moderation queue." + Cancel link
- [ ] **EXT-03**: State C (approved_pending_bits) — StrokePreview canvas (in viewer's color) + "Spend X Bits" button + Cancel link
- [ ] **EXT-04**: State D (live) — "Your drawing is live on the stream!"
- [ ] **EXT-05**: State E (rejected) — "Not approved. No Bits charged." + "Try again →" link

#### Extension Mechanics

- [ ] **EXT-06**: Extension polls `GET /api/queue/my-status` every 10s (Extension JWT auth)
- [ ] **EXT-07**: `useBits(bits_sku)` called from click handler (user gesture requirement satisfied)
- [ ] **EXT-08**: `onTransactionComplete` → `POST /api/bits/confirm` → status transitions to `live`
- [ ] **EXT-09**: `StrokeRenderer.ts` shared between `extension/` and `web/` — renders in viewer's chosen color
- [ ] **EXT-10**: Extension CSP compliant — all JS bundled by Vite, no `eval()`, EBS URL in manifest allowlist

#### Certification

- [ ] **EXT-11**: Bits products (SKUs) created in Twitch Developer Console and submitted for review
- [ ] **EXT-12**: Extension tested in Developer Rig with simulated Bits (`test_` transaction IDs)
- [ ] **EXT-13**: Extension uploaded to Twitch CDN and tested in Sandbox on real channel
- [ ] **EXT-14**: Extension submitted to Twitch for review

## v2 Requirements

### Moderation

- **MODR-01**: Mod can flag a drawing (hold without approve/reject) for broadcaster decision
- **MODR-02**: Mod dashboard shows history of recent decisions

### Overlay

- **OVER-V2-01**: Broadcaster can configure a safe zone / margin for drawing placement
- **OVER-V2-02**: Overlay shows a subtle animation when a new drawing appears

### Drawing Site

- **DRAW-V2-01**: Viewer can see a live preview of the overlay canvas on the drawing site
- **DRAW-V2-02**: Undo/redo for drawing strokes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Programmatic Bits refunds | Twitch provides no API for this — architecture is designed around it |
| Multiple concurrent submissions per viewer | One-at-a-time keeps mod queue manageable |
| Free-form color picker | Preset palette avoids offensive combos; simpler UI |
| Configurable overlay region | Full-screen is sufficient; region config adds UI complexity |
| Mobile native app | Web-first, responsive canvas covers mobile browsers |
| Real-time chat | Unrelated to drawing flow |
| Drawing canvas inside Extension panel | Extension panel is payment gateway only — too small for drawing |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 to FOUND-16 | Phase 1 | Complete |
| OVER-01 to OVER-07 | Phase 2 | Pending |
| MOD-01 to MOD-10 | Phase 2 | Pending |
| SCHEMA-01 to SCHEMA-03 | Phase 3 | Pending |
| DRAW-01 to DRAW-14 | Phase 3 | Pending |
| EXT-01 to EXT-14 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
