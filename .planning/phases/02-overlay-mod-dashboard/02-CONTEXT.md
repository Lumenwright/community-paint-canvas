# Phase 2: Overlay + Mod Dashboard - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent UI surfaces built on top of the Phase 1 EBS API:

1. **Stream overlay** (`/overlay`) — transparent full-screen OBS browser source that renders live approved drawings with client-side alpha fading, receives real-time updates via Supabase Realtime.
2. **Mod dashboard** (`/mod`) — protected queue review UI for mods; broadcaster-only settings and mod list management at `/mod/settings`.

Drawing site (Phase 3) and Twitch Extension (Phase 4) are out of scope. Color field in schema is Phase 3. `StrokeRenderer.ts` needed here for the mod dashboard's drawing preview canvas.

</domain>

<decisions>
## Implementation Decisions

### Queue auto-advance
- **D-01:** After Approve or Reject, the view auto-advances to the next drawing with a ~800ms delay — long enough to register the action visually, no manual Next click required.

### Mod dashboard routing
- **D-02:** Queue review lives at `/mod`. Broadcaster-only panels (settings + mod list) live at `/mod/settings` as a separate route.
- **D-03:** The broadcaster settings form (grace_seconds, fade_seconds, bits_sku, bits_amount) and mod list management (add/remove) are co-located on `/mod/settings` as separate sections on the same page.

### Overlay disconnect handling
- **D-04:** On Realtime disconnect, stay silent — rely on Supabase JS client's built-in reconnect logic. If the connection remains down for ~60s, force `location.reload()` as a hard fallback. No visible indicator on stream.

### Initial drawings load
- **D-05:** On overlay mount, load existing `live` drawings via direct Supabase anon-key query (using `$lib/client/supabase.ts`) — same client already used for Realtime subscriptions. No EBS round-trip needed; RLS already allows public reads on `drawings`.

### Locked architectural decisions (from PROJECT.md)
- **D-06:** Overlay rendering: OffscreenCanvas + `createImageBitmap()` per drawing, `requestAnimationFrame` loop, `clearRect` → composite all bitmaps with `globalAlpha = computeAlpha(approvedAt, expiresAt, graceSeconds)`.
- **D-07:** Alpha is computed entirely client-side from timestamps — no backend alpha column, no server writes per frame.
- **D-08:** Overlay is fixed full-screen, transparent background. No configurable region or margin.
- **D-09:** Settings changes (grace_seconds, fade_seconds) received via Supabase Realtime on `settings` table UPDATE apply to the running overlay without reload.

### Claude's Discretion
- Exact Svelte 5 component decomposition (which logic goes in sub-components vs. the page)
- Loading skeleton / spinner while initial drawings fetch completes
- Exact visual layout of the mod dashboard (spacing, card vs. table for queue items)
- Error message copy for auth failures and empty states
- Bits SKU dropdown options on the settings form (static list vs. fetched from API)

</decisions>

<specifics>
## Specific Ideas

- The "Drawing X of N" counter should be visible near the canvas (upper right or nearby) — exact placement at Claude's discretion.
- The mod-login page is reached by redirect from `/mod` when unauthenticated — it's a simple "Login with Twitch" page, not a full design exercise.
- Cancel button for submissions is scoped to Phase 3 (drawing site) — the mod dashboard does not need a cancel UI.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + task breakdown
- `rework-plans/rework-plan-2026.md` — Full architecture, UX flow, schema, and phase breakdown for the 2026 rework. Contains detailed overlay rendering approach and mod dashboard UX spec.
- `.planning/ROADMAP.md` §Phase 2 — Task list and completion criteria for this phase.
- `.planning/REQUIREMENTS.md` — Requirement IDs OVER-01 through OVER-07 and MOD-01 through MOD-10.

### Existing server infrastructure (Phase 1 — complete)
- `web/src/lib/server/auth.ts` — `requireSession`, `requireMod`, `requireBroadcaster` guards.
- `web/src/lib/server/twitch-oauth.ts` — PKCE token exchange helpers for mod login flow.
- `web/src/lib/server/session.ts` — Session cookie creation/parsing.
- `web/src/lib/client/supabase.ts` — Anon-key Supabase client for Realtime + initial load.

### Database schema
- `supabase/migrations/001_initial_schema.sql` — Table definitions: `drawings`, `queue`, `settings`, `moderators`, `canvas_history`.
- `supabase/migrations/002_rls_policies.sql` — RLS: `drawings` is publicly readable (anon key); `settings` is publicly readable; write ops require service role.

### Existing API routes (Phase 1 — all callable from mod dashboard)
- `web/src/routes/api/queue/+server.ts` — `GET /api/queue` (mod only) — full pending_review queue.
- `web/src/routes/api/review/+server.ts` — `POST /api/review` — approve/reject a submission.
- `web/src/routes/api/settings/+server.ts` — `GET /api/settings` (public), `PATCH /api/settings` (broadcaster only).
- `web/src/routes/api/moderators/+server.ts` — `GET/POST/DELETE /api/moderators` (broadcaster only).
- `web/src/routes/api/canvas/reset/+server.ts` — `POST /api/canvas/reset` (mod only).
- `web/src/routes/api/drawings/+server.ts` — `POST /api/drawings` (used in Phase 3, not Phase 2).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `web/src/lib/client/supabase.ts` — Browser Supabase client. Use for both Realtime subscriptions and initial anon-key queries on the overlay.
- `web/src/lib/server/auth.ts` — Auth guards already handle mod and broadcaster session checks. `+page.server.ts` files should call these at load time.
- `web/src/lib/server/twitch-oauth.ts` — PKCE helpers are ready; mod-login just needs a `+page.svelte` with a "Login with Twitch" button and a `+server.ts` or `+page.server.ts` to initiate the flow.

### Established patterns
- Server/client split is strict — server-only code in `$lib/server/`, browser code in `$lib/client/`.
- Auth guards throw `error()` — SvelteKit propagates to error boundary. `+page.server.ts` load functions follow the same pattern.
- All API routes return JSON; errors via `throw error(status, message)`.
- Svelte 5 rune patterns (`$state`, `$derived`, `$effect`, `$props`) are not yet established in this codebase — Phase 2 will set the precedent.
- Import style: `.js` extensions on all imports (required for Node ESM resolution).

### Integration points
- Overlay connects to Supabase Realtime on the `drawings` table (INSERT/DELETE) and `settings` table (UPDATE).
- Mod dashboard calls existing API routes — no new server-side routes needed for the core review flow. Only new routes are the PKCE login redirect handlers if not already covered by `api/auth/mod-callback`.
- `StrokeRenderer.ts` (new — create at `web/src/lib/canvas/StrokeRenderer.ts`) will be used by both the overlay and the mod dashboard's drawing preview. Also referenced in Phase 4's `StrokePreview.svelte`.

</code_context>

<deferred>
## Deferred Ideas

- None raised during discussion — scope stayed within Phase 2 boundaries.

</deferred>

---

*Phase: 02-overlay-mod-dashboard*
*Context gathered: 2026-04-06*
