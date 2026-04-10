---
phase: 02-overlay-mod-dashboard
plan: "02"
subsystem: mod-dashboard
tags: [svelte5, sveltekit, pkce, oauth, supabase, canvas]
dependency_graph:
  requires:
    - "02-01: StrokeRenderer.ts available for preview canvas"
    - "01: /api/queue, /api/review, /api/settings, /api/moderators, /api/canvas/reset endpoints"
  provides:
    - "/mod-login: PKCE login page for mods and broadcaster"
    - "/mod: Queue review UI — one drawing at a time, Next/Previous/Approve/Reject"
    - "/mod/settings: Broadcaster-only settings, mod list management, canvas reset"
  affects:
    - "Phase 3: Drawing site can link to /mod for broadcaster context"
key_files:
  created:
    - web/tests/api/mod-auth.test.ts
    - web/src/routes/(auth)/mod-login/+page.svelte
    - web/src/routes/(auth)/mod-login/+page.server.ts
    - web/src/routes/mod/+page.svelte
    - web/src/routes/mod/+page.server.ts
    - web/src/routes/mod/settings/+page.svelte
    - web/src/routes/mod/settings/+page.server.ts
  modified:
    - web/src/routes/api/auth/mod-callback/+server.ts
decisions:
  - "Session cookie secure flag derived from event.url.protocol — works on HTTP localhost and HTTPS prod without env var check"
  - "PATCH /api/settings accepts flat {[key]:value} shape — frontend must not wrap in {key,value} envelope"
  - "POST /api/review expects status:'approved'/'rejected' (past tense) — frontend maps from action strings"
metrics:
  duration: "~70 minutes (including verification fixes)"
  completed_date: "2026-04-10"
  tasks_completed: 5
  tasks_total: 5
  files_created: 7
  files_modified: 1
---

# Phase 2 Plan 2: Mod Dashboard Summary

**One-liner:** PKCE-protected mod login, single-drawing queue review UI with Next/Previous/Approve/Reject, and broadcaster-only settings page for fade config, Bits SKU, mod list, and canvas reset — all wired to existing EBS API routes.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 02-00 | Mod auth redirect integration tests | 4ba8866 |
| 02-01 | Mod-login page with PKCE initiation | ea9f8f6 |
| 02-02 | Mod queue review page with drawing preview and approve/reject | 9b3cc99 |
| 02-03 | Broadcaster settings page (fade config, Bits SKU, mod list, canvas reset) | 9208429 |
| 02-04 | Verify mod dashboard end-to-end | ee5ed72 (fixes) |

## What Was Built

### `/mod-login` (`+page.server.ts` + `+page.svelte`)
PKCE login flow: already-authenticated mods/broadcasters redirect straight to `/mod`. Login button POSTs to the default action, which sets an `oauth_state` CSRF cookie and redirects to Twitch's authorize URL. Unauthenticated visitors see a clean "Login with Twitch" page.

### `/mod` (`+page.server.ts` + `+page.svelte`)
Queue review UI with session guard (redirects to `/mod-login` on missing/insufficient session). Fetches `/api/queue` on mount, renders one drawing at a time on a 600×400 preview canvas via `StrokeRenderer.ts` (imported from Wave 1). Shows "Drawing X of N" counter. Previous/Next navigate without action. Approve/Reject POST to `/api/review` with 800ms auto-advance delay. Empty state shows a Refresh button.

### `/mod/settings` (`+page.server.ts` + `+page.svelte`)
Broadcaster-only (403 for non-broadcasters). Three sections:
1. **Canvas settings** — grace_seconds, fade_seconds, Bits tier (SKU + amount kept in sync) → `PATCH /api/settings`
2. **Moderator management** — live mod list with Remove per row + Add Moderator form → `POST`/`DELETE /api/moderators`
3. **Danger zone** — Reset Canvas with `confirm()` guard → `POST /api/canvas/reset`

## Bugs Fixed During Verification

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Session cookie not sent after login | `secure: true` on HTTP localhost — browser silently drops it | Derive `secure` from `event.url.protocol === 'https:'` |
| Settings save always 422 | Frontend sent `{key, value}` envelope; API expects `{[key]: value}` flat shape | Changed `JSON.stringify(patch)` → `JSON.stringify({ [patch.key]: patch.value })` |
| Approve/Reject always 422 | Frontend sent `action: 'approve'`; API expects `status: 'approved'` | Map action string to past-tense status value |

## Self-Check

Files created: 7 — FOUND
Implementation commits: 4ba8866, ea9f8f6, 9b3cc99, 9208429 — PRESENT
Fix commit: ee5ed72 — PRESENT
Verification: All steps passed by human reviewer

## Self-Check: PASSED
