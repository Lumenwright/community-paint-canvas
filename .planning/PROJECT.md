# Community Paint Canvas

## What This Is

A community drawing app for Twitch streams. Viewers draw doodles on an external website, a moderator approves them, then the viewer spends Twitch Bits to place their drawing live on a stream overlay canvas. Drawings appear in the viewer's chosen color and fade out after a broadcaster-configurable grace period.

## Core Value

Viewers see their approved drawing appear on the live stream — the Bits purchase is the moment of placement, not the moment of hope.

## Requirements

### Validated

- ✓ Pnpm monorepo structure (`web/` + `extension/`) — Phase 1
- ✓ Supabase schema (drawings, queue, settings, moderators, canvas_history) + RLS — Phase 1
- ✓ All EBS API routes (drawings, queue, review, bits/confirm, canvas/reset, settings, moderators, auth, cron) — Phase 1
- ✓ Extension JWT verification (HS256, jose) + handoff token flow — Phase 1
- ✓ Twitch PKCE OAuth (drawing site + mod paths) — Phase 1
- ✓ Signed httpOnly session cookies — Phase 1
- ✓ Supabase Realtime integration test coverage — Phase 1
- ✓ Integration test suite (Vitest, real DB, real JWTs) — Phase 1

### Active

**Phase 2 — Overlay + Mod Dashboard**
- [ ] Stream overlay renders approved drawings via OffscreenCanvas + requestAnimationFrame
- [ ] Client-side alpha fading from timestamps (no backend alpha column)
- [ ] Overlay receives live drawing add/remove via Supabase Realtime
- [ ] Settings changes (fade timing) apply to overlay without reload
- [ ] Overlay is fixed full-screen (fills OBS browser source)
- [ ] Mod PKCE login flow
- [ ] Mod dashboard: single-drawing queue review (oldest first), Next/Previous navigation, "X of N" counter, Approve/Reject
- [ ] Broadcaster can manage moderator list (add/remove)
- [ ] Broadcaster can configure grace_seconds, fade_seconds, bits_sku, bits_amount
- [ ] Broadcaster can reset/clear the canvas

**Phase 3 — Drawing Site**
- [ ] Color field added to queue + drawings schema (migration)
- [ ] Full-size responsive drawing canvas with mouse + touch input
- [ ] Line width slider (1–15px)
- [ ] Color palette picker — viewer's chosen color stored + rendered on overlay
- [ ] Viewer must authenticate (Extension handoff or PKCE fallback) to submit
- [ ] Submit drawing free (status → pending_review); one active submission per viewer
- [ ] Drawing site shows all submission states (pending, approved-pending-bits, live, rejected, cancelled)
- [ ] Viewer can cancel submission from the drawing site
- [ ] Local canvas clear (client-side only, no API call)

**Phase 4 — Twitch Extension**
- [ ] Extension State A: no submission — "Open Drawing Site →" handoff button
- [ ] Extension State B: pending review — status message + Cancel link
- [ ] Extension State C: approved — StrokePreview + Bits button + Cancel link
- [ ] Extension State D: live on canvas
- [ ] Extension State E: rejected — "No Bits charged. Try again →"
- [ ] Extension polls /api/queue/my-status every 10s
- [ ] Bits integration via window.Twitch.ext.bits.useBits() from click handler
- [ ] Bits confirmation posted to /api/bits/confirm
- [ ] Twitch Bits products + Extension submitted for review

### Out of Scope

- Multi-color overlay background — transparent background only, color comes from drawing strokes
- Configurable overlay region/margin — full-screen only
- Multiple concurrent submissions per viewer — one at a time enforced
- Batch mod actions — one-at-a-time review is intentional
- Mobile app / native client — web-first
- Real-time chat — not related to the drawing flow
- Video posts — not applicable

## Context

**Brownfield rework** on `2026-rework` branch. The original stack (Flask, Vue 2 CDN, Firebase, Tiltify, implicit OAuth) is being fully replaced. The new stack (SvelteKit + Svelte 5, Supabase, Twitch Bits, PKCE) is built from scratch in a pnpm monorepo — no compatibility with old API contracts required.

**Key design decisions already locked:**
- Drawing happens on the external website (not in the Extension panel)
- Moderation happens *before* Bits are spent — no refund complexity
- Alpha fading is computed client-side from timestamps (no backend writes per frame)
- OffscreenCanvas bitmap cache + requestAnimationFrame for GPU-composited rendering
- Short-lived signed handoff token (60s TTL) for seamless Extension → drawing site login

**Phase 1 complete and integration-tested.** The EBS API, auth flows, Supabase schema, and RLS are working. Phases 2–4 are unbuilt.

**New requirement vs. original plan:** Viewer-chosen drawing color (from a preset palette) is stored per submission and rendered on the overlay. The schema needs a `color` column added in Phase 3.

## Constraints

- **Twitch Extension certification**: ~1–2 weeks. Submit late in Phase 4 only. Bits products also need approval.
- **Bits API**: No programmatic refunds — moderation-before-payment is non-negotiable.
- **Extension CSP**: All JS must be bundled by Vite. No `eval()`. EBS domain in manifest allowlist.
- **`useBits()` user gesture**: Must be called directly from a click handler.
- **Vercel free tier**: Cron minimum interval is 1 minute (`*/1 * * * *`).
- **OffscreenCanvas**: Available in all modern browsers and OBS Chromium — no polyfill needed.
- **Supabase free tier**: Used for DB + Realtime. No server-side auth (service role key in EBS only).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Moderation before Bits payment | Bits not refundable; rejections should cost viewers nothing | ✓ Good |
| Handoff token (60s JWT) | Seamless login from Extension without separate PKCE prompt | ✓ Good |
| Client-side alpha from timestamps | Zero backend writes per frame; smooth 60fps fading | ✓ Good |
| OffscreenCanvas + ImageBitmap cache | GPU-composited; render once, composite many times | ✓ Good |
| Color palette (not free picker) | Limits offensive color combinations; simpler palette UI | — Pending |
| Line widths pre-computed at submission | Consistent across all renders; no re-randomization | ✓ Good |
| localhost OBS testing counts as Phase 2 done | Deployed Vercel URL not needed to verify overlay behavior | — Pending |

---
*Last updated: 2026-04-06 after initial project initialization*
