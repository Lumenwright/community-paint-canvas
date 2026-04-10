# Roadmap: Community Paint Canvas

**Milestone:** v1.0 — Full Twitch Extension + Drawing Site + Stream Overlay
**Branch:** `2026-rework`
**Last updated:** 2026-04-06

## Phases

- [x] **Phase 1: Backend Foundation** - All EBS API routes, Supabase schema, auth flows, and integration tests working locally.
- [ ] **Phase 2: Overlay + Mod Dashboard** - Working stream overlay and functional mod dashboard for reviewing the drawing queue.
- [ ] **Phase 3: Drawing Site** - Viewers can draw, pick a color, submit for free, and track their submission status.
- [ ] **Phase 4: Twitch Extension** - Extension panel as payment gateway, Bits integration live in Sandbox, Extension submitted for Twitch review.

## Phase Details

### Phase 1: Backend Foundation
**Goal**: All EBS API routes, Supabase schema, auth flows, and integration tests working locally.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01 through FOUND-16
**Success Criteria** (what must be TRUE):
  1. All API routes responding correctly to authenticated and unauthenticated requests
  2. Integration tests passing against local Supabase
  3. Extension JWT verification, handoff token flow, and PKCE OAuth working end-to-end
**Plans**: TBD
**Status**: Complete

### Phase 2: Overlay + Mod Dashboard
**Goal**: A working stream overlay (OBS browser source) and a functional mod dashboard where mods can review and act on the pending drawing queue.
**Depends on**: Phase 1
**Requirements**: OVER-01 through OVER-07, MOD-01 through MOD-10
**Success Criteria** (what must be TRUE):
  1. Overlay renders test drawings in OBS browser source at localhost
  2. New drawings inserted via Supabase appear on overlay in real-time without reload
  3. Expired drawings (manually triggered or via cron) disappear from overlay in real-time
  4. Settings update (grace_seconds change) applies to running overlay without reload
  5. Mod can log in, see queue, navigate Next/Previous, Approve, and Reject
  6. Broadcaster can update settings and manage mod list
  7. Broadcaster can reset canvas
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Overlay canvas with Realtime + alpha fading (OVER-01 through OVER-07)
- [ ] 02-02-PLAN.md -- Mod dashboard: auth, queue review, broadcaster settings (MOD-01 through MOD-10)

### Phase 3: Drawing Site
**Goal**: Viewers can draw, pick a color, submit for free, and track their submission status — all from the external drawing site.
**Depends on**: Phase 2
**Requirements**: SCHEMA-01 through SCHEMA-03, DRAW-01 through DRAW-14
**Success Criteria** (what must be TRUE):
  1. Viewer can draw on a full-size canvas with mouse and touch
  2. Line width slider and color palette work; chosen color is stored with submission
  3. Clear button resets canvas without API call
  4. Unauthenticated users can draw but not submit — login prompt shown
  5. Extension handoff login works end-to-end (no visible login prompt)
  6. Submit creates pending_review entry; second submit blocked while one is active
  7. Drawing site shows correct status for all states
  8. Cancel works from the drawing site
  9. Color appears correctly on the overlay after mod approves + Bits confirmed
**Plans**: TBD

Plans:
- [ ] 03-01: Schema migration + color field
- [ ] 03-02: Drawing canvas with mouse/touch, color picker, line width
- [ ] 03-03: Auth flow (handoff token + PKCE fallback) + submit
- [ ] 03-04: Status display + polling + cancel

### Phase 4: Twitch Extension
**Goal**: The Extension panel is a working payment gateway showing all submission states. Bits integration is live in Sandbox. Extension is submitted to Twitch for review.
**Depends on**: Phase 3
**Requirements**: EXT-01 through EXT-14
**Success Criteria** (what must be TRUE):
  1. All 5 Extension states render correctly and transition properly
  2. Handoff button opens drawing site with auto-login (no login prompt visible)
  3. Bits button triggers native Twitch confirm UI; transaction confirmed end-to-end in Sandbox
  4. Cancel works from States B and C
  5. StrokePreview renders in viewer's chosen color
  6. Extension tested in Developer Rig with simulated Bits
  7. Extension uploaded and tested in Sandbox on real channel
  8. Bits products and Extension submitted to Twitch for review
**Plans**: TBD

Plans:
- [ ] 04-01: Extension scaffold + useExtension hook + state machine
- [ ] 04-02: Per-state components (A-E) + StrokePreview
- [ ] 04-03: Certification prep — Developer Rig, Sandbox, submit to Twitch

## Progress

**Execution Order:** Phase 1 -> Phase 2 -> Phase 3 -> Phase 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | - | Complete | 2026-04-06 |
| 2. Overlay + Mod Dashboard | 0/2 | Planning complete | - |
| 3. Drawing Site | 0/4 | Not started | - |
| 4. Twitch Extension | 0/3 | Not started | - |

## Dependencies

```
Phase 1 --> Phase 2 --> Phase 3 --> Phase 4
                |              |
                |              +-> Schema migration (004_color_field.sql)
                |                  must run before Phase 3 overlay color rendering
                +-> Overlay must exist before end-to-end Phase 3 testing
```

- Phase 4 can be scaffolded in parallel with Phase 3, but full Bits testing requires Phase 3's submit flow
- Twitch certification (Phase 4 last task) runs in parallel with any post-Phase-4 polish
