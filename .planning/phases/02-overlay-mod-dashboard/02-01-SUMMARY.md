---
phase: 02-overlay-mod-dashboard
plan: "01"
subsystem: overlay
tags: [svelte5, canvas, realtime, offscreencanvas, raf, supabase]
dependency_graph:
  requires:
    - "01: EBS API, Supabase schema, RLS policies, anon client"
  provides:
    - "StrokeRenderer.ts: shared stroke rendering utility (used by mod dashboard in 02-02, Phase 4 StrokePreview)"
    - "computeAlpha.ts: client-side fade computation from timestamps"
    - "/overlay page: transparent OBS browser source with Realtime subscriptions"
  affects:
    - "02-02: StrokeRenderer.ts import available for mod dashboard preview canvas"
    - "Phase 4: StrokeRenderer.ts and Point interface available for StrokePreview.svelte"
tech_stack:
  added:
    - "svelte-check ^4.0.0 (devDependency) — Svelte component type checking"
  patterns:
    - "Svelte 5 runes: $state, $effect, bind:this for canvas lifecycle"
    - "OffscreenCanvas + createImageBitmap() for GPU-composited rendering"
    - "requestAnimationFrame loop with clearRect for transparent overlay compositing"
    - "Supabase Realtime postgres_changes channel with chained .on() listeners"
key_files:
  created:
    - web/src/lib/canvas/StrokeRenderer.ts
    - web/src/lib/canvas/computeAlpha.ts
    - web/src/routes/overlay/+page.svelte
  modified:
    - web/package.json
    - pnpm-lock.yaml
decisions:
  - "Bitmap cache keyed by drawings.id UUID (not entry_id) — Supabase Realtime DELETE with RLS only returns primary key in payload.old"
  - "Single Supabase channel with three chained .on() listeners (INSERT/DELETE drawings, UPDATE settings)"
  - "Resize handler re-fetches drawing rows from DB to rebuild OffscreenCanvas bitmaps at new dimensions"
  - "svelte-check added to devDependencies — was missing from package.json but required for Svelte component type verification"
metrics:
  duration: "~14 minutes"
  completed_date: "2026-04-07"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 2
---

# Phase 2 Plan 1: Stream Overlay Rendering Summary

**One-liner:** Transparent full-screen OBS overlay with OffscreenCanvas bitmap cache, rAF compositing loop, Supabase Realtime subscriptions (INSERT/DELETE drawings + UPDATE settings), and 60s disconnect watchdog.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 01-01 | Create StrokeRenderer.ts and computeAlpha.ts | 3bc5041 | web/src/lib/canvas/StrokeRenderer.ts, web/src/lib/canvas/computeAlpha.ts |
| 01-02 | Create overlay page with Realtime, bitmap cache, rAF loop | 92a4733 | web/src/routes/overlay/+page.svelte, web/package.json, pnpm-lock.yaml |

## Task Awaiting Human Verification

| Task | Name | Status |
|------|------|--------|
| 01-03 | Verify overlay in browser and OBS | Awaiting human verification |

## What Was Built

### StrokeRenderer.ts (`web/src/lib/canvas/StrokeRenderer.ts`)

Shared stroke rendering utility. Exports `renderStrokes()` and `Point` interface. Accepts any 2D canvas context (including `OffscreenCanvasRenderingContext2D`). Color defaults to `'white'` — Phase 3 will pass viewer-chosen palette colors. Used by the overlay now; mod dashboard preview (02-02) and Phase 4 StrokePreview will also import it.

### computeAlpha.ts (`web/src/lib/canvas/computeAlpha.ts`)

Pure function for client-side alpha fading. Returns `1.0` during the grace period, linear interpolation through the fade window, `0.0` when fully expired. Returns `1.0` when `expiresAt` is `null` (grace_seconds = 0 = never fades). No backend writes. Called every rAF frame.

### overlay/+page.svelte (`web/src/routes/overlay/+page.svelte`)

Complete OBS browser source overlay:
- `bind:this={canvas}` with canvas declared as plain `let` (not `$state` — required for bind:this compatibility)
- `$effect` contains the rAF loop: `clearRect` (transparent) → iterate `bitmaps.values()` → `computeAlpha()` → skip if alpha <= 0 → `drawImage(bitmap)`
- `onMount` creates a single Supabase channel with INSERT/DELETE on `drawings` + UPDATE on `settings`
- INSERT handler: renders to OffscreenCanvas via `renderStrokes()`, creates `ImageBitmap`, adds to cache
- DELETE handler: `bitmaps.delete(payload.old.id)` — payload.old only has `{ id }` due to RLS
- UPDATE handler: updates `graceSeconds`/`fadeSeconds` state on `grace_seconds`/`fade_seconds` key changes
- Disconnect watchdog: 60s `setTimeout` calls `location.reload()` on CHANNEL_ERROR/TIMED_OUT/CLOSED; cleared on SUBSCRIBED
- Initial load: `Promise.all` fetch of `drawings` and `settings` tables via anon client on mount
- Resize handler: updates canvas dimensions and rebuilds OffscreenCanvas bitmaps from fresh DB query
- Global styles: `html`/`body` transparent, `canvas` fixed/full-screen

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added svelte-check devDependency**
- **Found during:** Task 01-02 verification
- **Issue:** The plan's verification step calls `npx svelte-check`, but `svelte-check` was not in `web/package.json` devDependencies. Running it would fail.
- **Fix:** Added `"svelte-check": "^4.0.0"` to `web/package.json` devDependencies and ran `pnpm install`.
- **Files modified:** web/package.json, pnpm-lock.yaml
- **Commit:** 92a4733 (included in Task 01-02 commit)

**2. [Rule 3 - Blocking] Installed pnpm and ran pnpm install**
- **Found during:** Task 01-01 verification
- **Issue:** The worktree had no `node_modules` — `pnpm` was not in the shell PATH for this environment.
- **Fix:** Installed pnpm globally via `npm install -g pnpm`, then ran `pnpm install` in the worktree root to populate node_modules.
- **Files modified:** None (runtime only)

## Known Stubs

None. The overlay page is fully wired: Supabase Realtime subscriptions are live, bitmap cache is populated from real DB data, computeAlpha receives real timestamps, rAF loop composites live bitmaps.

## Threat Flags

No new threat surface beyond the plan's threat model. The overlay page is intentionally public (no auth). It only reads `drawings` and `settings` via the anon client with RLS-enforced public read access. No new endpoints, auth paths, or file access patterns introduced.

## Self-Check

Files created:
- web/src/lib/canvas/StrokeRenderer.ts — FOUND
- web/src/lib/canvas/computeAlpha.ts — FOUND
- web/src/routes/overlay/+page.svelte — FOUND

Commits:
- 3bc5041 — feat(02-01): add StrokeRenderer.ts and computeAlpha.ts canvas utilities
- 92a4733 — feat(02-01): create overlay page with Realtime subscriptions, bitmap cache, and rAF loop

## Self-Check: PASSED
