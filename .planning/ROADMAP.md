# Roadmap: Community Paint Canvas

**Milestone:** v1.0 — Full Twitch Extension + Drawing Site + Stream Overlay
**Branch:** `2026-rework`
**Last updated:** 2026-04-06

---

## Phase 1 — Backend Foundation ✓ COMPLETE

**Goal:** All EBS API routes, Supabase schema, auth flows, and integration tests working locally.

**Status:** Complete and integration-tested.

**Covers:** FOUND-01 through FOUND-16

**Completion criteria (met):**
- All API routes responding correctly to authenticated and unauthenticated requests
- Integration tests passing against local Supabase
- Extension JWT verification, handoff token flow, and PKCE OAuth working end-to-end

---

## Phase 2 — Overlay + Mod Dashboard

**Goal:** A working stream overlay (OBS browser source) and a functional mod dashboard where mods can review and act on the pending drawing queue.

**Covers:** OVER-01 through OVER-07, MOD-01 through MOD-10

**Tasks:**

### Overlay (`/overlay`)
1. Create `web/src/routes/overlay/+page.svelte` with full-screen transparent canvas
2. Implement `OverlayCanvas.svelte` in `web/src/lib/canvas/`:
   - Supabase Realtime subscription on `drawings` (INSERT → render + cache, DELETE → remove)
   - Supabase Realtime subscription on `settings` (UPDATE → reload grace/fade config)
   - OffscreenCanvas + `createImageBitmap()` per drawing
   - `requestAnimationFrame` loop: `clearRect` → composite all bitmaps with `globalAlpha = computeAlpha(...)`
3. Implement `computeAlpha(approvedAt, expiresAt, graceSeconds)` utility
4. Load initial drawings from `GET /api/drawings` (or direct Supabase query via anon key) on mount
5. Verify in OBS browser source at `http://localhost:5173/overlay`

### Mod Dashboard (`/mod`)
6. Create `web/src/routes/mod/+page.server.ts` — session auth guard, redirect to `/mod-login` if unauthenticated
7. Create `web/src/routes/(auth)/mod-login/+page.svelte` — Twitch PKCE login page for mods
8. Build queue review UI:
   - Fetch `GET /api/queue` on load
   - Display one drawing at a time on canvas (oldest first)
   - "Drawing X of N" counter (upper right of canvas, or nearby)
   - Next / Previous buttons (navigate without action)
   - Approve button → `POST /api/review { action: 'approve' }` → advance to next
   - Reject button → `POST /api/review { action: 'reject' }` → advance to next
   - Empty state: "Queue is empty" message
9. Build broadcaster settings panel (broadcaster session required):
   - Form for grace_seconds, fade_seconds, bits_sku (dropdown), bits_amount
   - `PATCH /api/settings`
10. Build mod list management panel (broadcaster session required):
    - List current mods from `GET /api/moderators`
    - Add mod form → `POST /api/moderators`
    - Remove mod button → `DELETE /api/moderators/:id`
11. Build canvas reset button (broadcaster session) → `POST /api/canvas/reset`

**Completion criteria:**
- [ ] Overlay renders test drawings in OBS browser source at localhost
- [ ] New drawings inserted via Supabase appear on overlay in real-time without reload
- [ ] Expired drawings (manually triggered or via cron) disappear from overlay in real-time
- [ ] Settings update (grace_seconds change) applies to running overlay without reload
- [ ] Mod can log in, see queue, navigate Next/Previous, Approve, and Reject
- [ ] Broadcaster can update settings and manage mod list
- [ ] Broadcaster can reset canvas

---

## Phase 3 — Drawing Site

**Goal:** Viewers can draw, pick a color, submit for free, and track their submission status — all from the external drawing site.

**Covers:** SCHEMA-01 through SCHEMA-03, DRAW-01 through DRAW-14

**Tasks:**

### Schema migration
1. Write `supabase/migrations/004_color_field.sql`:
   - `ALTER TABLE queue ADD COLUMN color text NOT NULL DEFAULT 'white'`
   - `ALTER TABLE drawings ADD COLUMN color text NOT NULL DEFAULT 'white'`
2. Update `renderStrokes()` in `StrokeRenderer.ts` to use `color` parameter from record
3. Update overlay bitmap rendering to pass `drawing.color` to `renderStrokes()`

### Drawing Canvas
4. Create `web/src/routes/+page.svelte` — drawing site home
5. Implement `DrawingCanvas.svelte` in `web/src/lib/canvas/`:
   - Mouse events: `mousedown/mousemove/mouseup`
   - Touch events: `touchstart/touchmove/touchend`, `touch-action: none`, normalized via `getBoundingClientRect()`
   - Active stroke rendered live as user draws
   - `strokes: Point[]` and `line_widths: number[]` accumulated per stroke segment
   - `line_widths` pre-computed as `base_width + randomInt(-2, 2)` per segment (clamped 1–20)
6. Line width slider (1–15px, default 7)
7. Color palette picker — preset colors: white, red, orange, yellow, lime, cyan, blue, purple, pink, black
8. Clear button — resets `strokes`, `line_widths` arrays and clears canvas element

### Auth + Submission
9. Handoff token flow: `+page.server.ts` reads `?auth=` param, verifies JWT → sets session cookie → redirects to `/`
10. PKCE fallback: `/login` page with "Login with Twitch" → initiates PKCE flow
11. Submit button:
    - Blocked if unauthenticated → show "Login with Twitch" prompt
    - Blocked if active submission exists → show current status instead
    - Calls `POST /api/drawings` with `{ strokes, line_widths, base_width, color }`
    - On success: transition to status display

### Status Display
12. Status component shown instead of submit button when active submission exists:
    - `pending_review`: "In the moderation queue." + Cancel button
    - `approved_pending_bits`: "Approved! Check the Extension panel to spend Bits." + Cancel button
    - `live`: "Your drawing is live on the stream!"
    - `rejected`: "Not approved. No Bits were charged." + Draw again button
    - `cancelled`: "Submission cancelled." + Draw again button
13. Status is polled from `GET /api/queue/my-status` every 10s (or use Realtime if Extension JWT available)
14. Cancel button → `DELETE /api/queue/my-submission`

**Completion criteria:**
- [ ] Viewer can draw on a full-size canvas with mouse and touch
- [ ] Line width slider and color palette work; chosen color is stored with submission
- [ ] Clear button resets canvas without API call
- [ ] Unauthenticated users can draw but not submit — login prompt shown
- [ ] Extension handoff login works end-to-end (no visible login prompt)
- [ ] Submit creates `pending_review` entry; second submit blocked while one is active
- [ ] Drawing site shows correct status for all states
- [ ] Cancel works from the drawing site
- [ ] Color appears correctly on the overlay after mod approves + Bits confirmed

---

## Phase 4 — Twitch Extension

**Goal:** The Extension panel is a working payment gateway showing all submission states. Bits integration is live in Sandbox. Extension is submitted to Twitch for review.

**Covers:** EXT-01 through EXT-14

**Tasks:**

### Extension scaffold
1. Initialize `extension/` Svelte 5 + Vite project (if not already done)
2. Set up `window.Twitch.ext` type declarations (`extension/src/lib/twitch/twitch-ext.d.ts`)
3. Implement `useExtension.ts` — JWT initialization, channel context
4. Add `PUBLIC_EBS_URL` env var pointing to the SvelteKit API

### State machine
5. Implement `useExtension.ts` — polls `GET /api/queue/my-status` every 10s via Extension JWT
6. Derive current state (A/B/C/D/E) from API response
7. Build `App.svelte` — renders correct component per state

### Per-state components
8. **State A** — "Want to draw on stream?" + "Open Drawing Site →" button:
   - On click: `POST /api/auth/ext-handoff` with Extension JWT → get handoff token → open `PUBLIC_DRAWING_SITE_URL?auth=<token>`
9. **State B** — "Your drawing is in the moderation queue." + Cancel link:
   - Cancel → `DELETE /api/queue/my-submission`
10. **State C** — StrokePreview canvas + "Spend X Bits" button + Cancel link:
    - `StrokePreview.svelte` renders strokes read-only using `StrokeRenderer.ts` (in viewer's chosen color)
    - Bits button: `useBits(bits_sku)` from click handler → `onTransactionComplete` → `POST /api/bits/confirm`
    - Cancel → `DELETE /api/queue/my-submission`
11. **State D** — "Your drawing is live on the stream!"
12. **State E** — "Not approved. No Bits were charged." + "Try again →" opens drawing site

### Certification prep
13. Test all states in Twitch Developer Rig with `test_` transaction IDs (dev mode)
14. Build and upload to Twitch CDN; test in Sandbox on real channel
15. Create Bits product SKUs in Twitch Developer Console
16. Submit Bits products for Twitch review
17. Submit Extension for Twitch review (~1–2 week turnaround)

**Completion criteria:**
- [ ] All 5 Extension states render correctly and transition properly
- [ ] Handoff button opens drawing site with auto-login (no login prompt visible)
- [ ] Bits button triggers native Twitch confirm UI; transaction confirmed end-to-end in Sandbox
- [ ] Cancel works from States B and C
- [ ] StrokePreview renders in viewer's chosen color
- [ ] Extension tested in Developer Rig with simulated Bits
- [ ] Extension uploaded and tested in Sandbox on real channel
- [ ] Bits products and Extension submitted to Twitch for review

---

## Milestone Completion: v1.0

**Done when:**
- Phases 1–4 completion criteria all met
- End-to-end flow verified: draw → submit → mod approves → Extension shows State C → Bits confirmed (Sandbox) → drawing live on overlay → fades → archived by cron
- Extension and Bits products approved by Twitch (may take 1–2 weeks after Phase 4 submission)

---

## Dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                │              │
                │              └─► Schema migration (004_color_field.sql)
                │                  must run before Phase 3 overlay color rendering
                └─► Overlay must exist before end-to-end Phase 3 testing
```

- Phase 4 can be scaffolded in parallel with Phase 3, but full Bits testing requires Phase 3's submit flow
- Twitch certification (Phase 4 last task) runs in parallel with any post-Phase-4 polish
