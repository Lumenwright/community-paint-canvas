---
phase: 02-overlay-mod-dashboard
plan: 02
subsystem: mod-dashboard
tags: [svelte5, pkce, auth, canvas, queue-review, broadcaster-settings]
dependency_graph:
  requires:
    - 02-01 (StrokeRenderer.ts for canvas preview)
    - Phase 1 API routes (/api/queue, /api/review, /api/settings, /api/moderators, /api/canvas/reset)
    - Phase 1 auth infrastructure (session.ts, hooks.server.ts, twitch-oauth.ts)
  provides:
    - mod-login PKCE flow (used by mods and broadcasters)
    - Mod queue review UI at /mod (MOD-01 through MOD-07)
    - Broadcaster settings page at /mod/settings (MOD-08 through MOD-10)
  affects:
    - Phase 3: Drawing site will link to /mod for reviewer flow
    - Phase 4: Extension will direct mods to the mod dashboard URL
tech_stack:
  added: []
  patterns:
    - Svelte 5 runes ($state, $derived, $effect, $props) — established precedent for Phase 3 and 4
    - SvelteKit +page.server.ts redirect pattern (redirect(303) instead of requireMod() for page routes)
    - PKCE state cookie flow for mod login
key_files:
  created:
    - web/tests/api/mod-auth.test.ts
    - web/src/routes/(auth)/mod-login/+page.server.ts
    - web/src/routes/(auth)/mod-login/+page.svelte
    - web/src/routes/mod/+page.server.ts
    - web/src/routes/mod/+page.svelte
    - web/src/routes/mod/settings/+page.server.ts
    - web/src/routes/mod/settings/+page.svelte
  modified: []
decisions:
  - "Used redirect(303, '/mod-login') in +page.server.ts load functions instead of requireMod() which throws error() — provides better UX for unauthenticated page access"
  - "BITS_TIERS static constant array ensures bits_sku and bits_amount are always updated atomically to prevent SKU/amount mismatch (Research Pitfall 5)"
  - "Initialized form $state fields from extracted const variables to clarify intentional initial-value capture from server props"
  - "canvas preview uses $effect + bind:this with $state<HTMLCanvasElement | undefined> to satisfy Svelte 5 reactivity requirements"
metrics:
  duration_minutes: 30
  completed_date: "2026-04-10"
  tasks_completed: 4
  tasks_total: 5
  files_created: 7
  files_modified: 0
---

# Phase 02 Plan 02: Mod Dashboard Summary

**One-liner:** PKCE-protected mod dashboard with queue review canvas preview + approve/reject auto-advance, and broadcaster settings with fade config, Bits SKU, mod list management, and canvas reset.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 02-00 | Wave 0 mod auth redirect integration tests | 4ba8866 | web/tests/api/mod-auth.test.ts |
| 02-01 | Mod-login page with PKCE initiation | ea9f8f6 | web/src/routes/(auth)/mod-login/+page.{server.ts,svelte} |
| 02-02 | Mod queue review page with drawing preview | 9b3cc99 | web/src/routes/mod/+page.{server.ts,svelte} |
| 02-03 | Broadcaster settings page | 9208429 | web/src/routes/mod/settings/+page.{server.ts,svelte} |
| 02-04 | Human verification (checkpoint) | — | (awaiting) |

## What Was Built

### Task 02-00: Wave 0 Integration Tests (RED)
Seven integration test cases in `web/tests/api/mod-auth.test.ts` covering:
- GET /mod: unauthenticated → 303, regular user → 303, mod → 200, broadcaster → 200
- GET /mod/settings: unauthenticated → 303, mod-only → 303, broadcaster → 200

Tests are currently RED (route files did not exist when written). They turn GREEN once the dev server is running with the new route files in place.

### Task 02-01: Mod Login Page
- `+page.server.ts`: load function redirects already-authenticated mods/broadcasters to /mod. Default form action generates `oauth_state` UUID, sets httpOnly CSRF cookie (10min TTL), and redirects to Twitch PKCE authorize URL with `user:read:email` scope.
- `+page.svelte`: centered "Login with Twitch" button with Twitch purple (#9146ff) styling. Displays error message when callback returns `?error=missing_code` or other error codes.

### Task 02-02: Mod Queue Review Page
- `+page.server.ts`: checks `session.is_mod || session.is_broadcaster`; redirects to /mod-login if false. Returns only `username` and `is_broadcaster` (not `twitch_user_id` or `is_mod`) to minimize client exposure (T-2-05).
- `+page.svelte`: Svelte 5 runes component that fetches `/api/queue` on mount, displays one drawing at a time rendered on a 600x400 canvas via `renderStrokes()` from `StrokeRenderer.ts`. "Drawing X of N" counter positioned top-right of canvas. Previous/Next navigation. Approve/Reject call `POST /api/review` then auto-advance with 800ms `setTimeout` (D-01). `actionPending` prevents double-clicks. Empty queue state shown with Refresh button.

### Task 02-03: Broadcaster Settings Page
- `+page.server.ts`: checks `session.is_broadcaster`; redirects to /mod-login if false (T-2-02). Loads settings as key-value map and active moderators list from DB server-side.
- `+page.svelte`: Three sections:
  1. **Canvas Settings**: `grace_seconds` number input (step 60, max 86400), `fade_seconds` number input (step 30, max 3600), Bits tier `<select>` dropdown from `BITS_TIERS` constant — selecting a tier updates both `bits_sku` and `bits_amount` atomically. Save PATCHes all four settings sequentially.
  2. **Moderator Management**: Table of active mods with Remove button per row (DELETE to `/api/moderators`). Add form with Twitch User ID + Username inputs (POST to `/api/moderators`).
  3. **Canvas Reset (Danger Zone)**: Red-bordered section, confirm() dialog guard before POST to `/api/canvas/reset`.
  - Back to Queue link at top.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Pattern Clarification (Not a Deviation)

The `$state` initialization from `data.settings.*` generates Svelte 5 informational warnings (`state_referenced_locally`). This is the correct pattern for form fields that are initialized from server-loaded props and then edited by the user — capturing only the initial value is intentional. The warning is cosmetic and the code has 0 errors. This pattern is documented in the task code comments.

## Known Stubs

None — all UI sections are wired to real API routes. Settings form PATCHes live DB. Mod list reads from and writes to DB. Canvas reset calls the real reset route.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers (T-2-01 through T-2-06).

## Checkpoint Pending

Task 02-04 is a `checkpoint:human-verify` requiring browser verification of:
- Auth redirects (visit /mod unauthenticated → /mod-login)
- Queue review UX (Drawing X of N, Next/Previous, Approve/Reject with 800ms delay, empty state)
- Broadcaster settings (save form, add/remove mods, canvas reset)
- Integration test suite passing GREEN

## Self-Check: PASSED

All 7 files exist on disk. All 4 task commits verified in git history.
