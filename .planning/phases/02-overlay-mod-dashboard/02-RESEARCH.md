# Phase 2: Overlay + Mod Dashboard - Research

**Researched:** 2026-04-06
**Domain:** Svelte 5 runes + SvelteKit 2 page auth, OffscreenCanvas rendering, Supabase Realtime
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** After Approve or Reject, the view auto-advances to the next drawing with a ~800ms delay.
- **D-02:** Queue review lives at `/mod`. Broadcaster-only panels (settings + mod list) live at `/mod/settings`.
- **D-03:** Broadcaster settings form and mod list management are co-located on `/mod/settings` as separate sections on the same page.
- **D-04:** On Realtime disconnect, stay silent — rely on Supabase JS client's built-in reconnect logic. If the connection remains down for ~60s, force `location.reload()` as a hard fallback. No visible indicator on stream.
- **D-05:** On overlay mount, load existing `live` drawings via direct Supabase anon-key query — no EBS round-trip. RLS allows public reads on `drawings`.
- **D-06:** Overlay rendering: OffscreenCanvas + `createImageBitmap()` per drawing, `requestAnimationFrame` loop, `clearRect` → composite all bitmaps with `globalAlpha = computeAlpha(approvedAt, expiresAt, graceSeconds)`.
- **D-07:** Alpha is computed entirely client-side from timestamps — no backend alpha column, no server writes per frame.
- **D-08:** Overlay is fixed full-screen, transparent background.
- **D-09:** Settings changes (grace_seconds, fade_seconds) received via Supabase Realtime on `settings` table UPDATE apply to the running overlay without reload.

### Claude's Discretion
- Exact Svelte 5 component decomposition (which logic goes in sub-components vs. the page)
- Loading skeleton / spinner while initial drawings fetch completes
- Exact visual layout of the mod dashboard (spacing, card vs. table for queue items)
- Error message copy for auth failures and empty states
- Bits SKU dropdown options on the settings form (static list vs. fetched from API)

### Deferred Ideas (OUT OF SCOPE)
- None raised during discussion — scope stayed within Phase 2 boundaries.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OVER-01 | `/overlay` page renders approved drawings on a full-screen canvas (transparent background) | `$effect` + `bind:this` canvas pattern verified; full-screen CSS approach documented |
| OVER-02 | Each drawing rendered once to OffscreenCanvas → cached as ImageBitmap | OffscreenCanvas API confirmed available in OBS Chromium; renderStrokes() interface documented |
| OVER-03 | `requestAnimationFrame` loop composites all cached bitmaps with `globalAlpha = computeAlpha(...)` | rAF cleanup pattern via `$effect` return function verified |
| OVER-04 | `computeAlpha()` derives fade from `approved_at`, `expires_at`, and `grace_seconds` | Algorithm from rework-plan-2026.md confirmed; timestamp arithmetic pattern documented |
| OVER-05 | Supabase Realtime subscription on `drawings` — INSERT adds bitmap to cache, DELETE removes it | Channel subscribe API verified; DELETE payload primary-key-only pitfall documented |
| OVER-06 | Supabase Realtime subscription on `settings` — UPDATE reloads fade config without page refresh | UPDATE event pattern same as INSERT/DELETE; settings key/value structure documented |
| OVER-07 | Overlay verified working in OBS browser source at localhost | No framework work needed; local Supabase is already available |
| MOD-01 | `/mod` page requires mod or broadcaster session (redirects to mod-login if unauthenticated) | `+page.server.ts` load + redirect(303, '/mod-login') pattern verified against SvelteKit docs |
| MOD-02 | Queue review UI shows one drawing at a time (oldest first), rendered on canvas | `GET /api/queue` already returns pending_review queue; StrokeRenderer interface documented |
| MOD-03 | "Drawing X of N" counter displayed outside the canvas | Pure `$derived` from queue array and current index; no server involvement |
| MOD-04 | Next + Previous buttons navigate queue without approving or rejecting | Client-side index state (`$state`) only |
| MOD-05 | Approve button — calls `POST /api/review`, advances to next drawing | Existing API route; 800ms delay with `setTimeout` before advancing |
| MOD-06 | Reject button — calls `POST /api/review`, advances to next drawing | Same as MOD-05 |
| MOD-07 | Empty queue state shown clearly when no pending drawings | `$derived` boolean from queue length |
| MOD-08 | Broadcaster settings UI — grace_seconds, fade_seconds, bits_sku, bits_amount | `PATCH /api/settings` exists; bits_sku is a static dropdown (SKUs pre-created in Dev Console) |
| MOD-09 | Mod list management — broadcaster can add/remove moderators | `GET/POST/DELETE /api/moderators` exists |
| MOD-10 | Canvas reset button — broadcaster only, calls `POST /api/canvas/reset` | Existing API route; needs broadcaster-only visibility guard in UI |
</phase_requirements>

---

## Summary

Phase 2 builds two UI surfaces on top of the complete Phase 1 EBS API: a transparent stream overlay for OBS and a protected mod dashboard. The core technical challenges are (1) establishing Svelte 5 rune patterns for canvas lifecycle management — `$effect` with `bind:this`, the `requestAnimationFrame` render loop, and cleanup — and (2) Supabase Realtime subscription management within those rune patterns.

The most important non-obvious finding is the **Supabase Realtime DELETE payload limitation**: when RLS is enabled on a table (as it is on `drawings`), the DELETE event's `old` record contains only the primary key column (`id` UUID). This means the OffscreenCanvas bitmap cache must be keyed by `id` (UUID), not `entry_id` (text), so that DELETE events can identify which bitmap to drop.

**Primary recommendation:** Key the bitmap cache by `drawings.id` (UUID) and ensure the initial load query and INSERT event both capture `id` alongside `strokes`, `line_widths`, `approved_at`, and `expires_at`. The `StrokeRenderer.ts` module needs a consistent interface now because Phase 4's `StrokePreview.svelte` will also import it.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte | 5.55.1 | Component framework, runes reactivity | Project baseline; runes syntax required for Phase 2 |
| @sveltejs/kit | 2.56.1 | File-based routing, server load functions, redirect() | Project baseline |
| @supabase/supabase-js | 2.101.1 | Realtime subscriptions + initial data query | Already used; anon client in `$lib/client/supabase.ts` |

[VERIFIED: npm registry — versions confirmed 2026-04-06]

### No New Dependencies Required
All needed libraries are already installed. Phase 2 adds only Svelte UI files and the new `StrokeRenderer.ts` utility.

---

## Architecture Patterns

### Recommended New File Structure
```
web/src/
├── lib/
│   └── canvas/
│       └── StrokeRenderer.ts        # Shared stroke renderer (overlay + mod dashboard + Phase 4)
├── routes/
│   ├── overlay/
│   │   └── +page.svelte             # OBS browser source (no auth, transparent bg)
│   ├── mod/
│   │   ├── +page.svelte             # Queue review UI
│   │   ├── +page.server.ts          # requireMod auth guard + initial data load
│   │   └── settings/
│   │       ├── +page.svelte         # Settings form + mod list
│   │       └── +page.server.ts      # requireBroadcaster auth guard + initial data load
│   └── (auth)/
│       ├── mod-login/
│       │   └── +page.svelte         # "Login with Twitch" button for mods
│       └── login/
│           └── +page.svelte         # "Login with Twitch" button for viewers (Phase 3 uses this)
```

### Pattern 1: Canvas Bind + $effect (Svelte 5)

The canonical way to access a DOM canvas element and start a render loop in Svelte 5 runes.

```typescript
// Source: https://svelte.dev/tutorial/svelte/bind-this
<script lang="ts">
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const ctx = canvas.getContext('2d')!;
    let frame = requestAnimationFrame(function loop(t) {
      frame = requestAnimationFrame(loop);
      // render here
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<canvas bind:this={canvas}></canvas>
```

**Key rules:**
- `canvas` is `undefined` until `$effect` runs — never access it at module scope or in `$derived`
- The cleanup function returned from `$effect` cancels the rAF when the component unmounts
- `$effect` skips SSR automatically — overlay page must be client-only rendering anyway
- Do NOT declare `canvas` as `$state` — `bind:this` works with a plain `let` variable

[VERIFIED: svelte.dev/tutorial/svelte/bind-this + svelte.dev/docs/svelte/$effect]

### Pattern 2: onMount for Supabase Realtime Subscription

`onMount` is the right hook for "subscribe once on mount, unsubscribe on unmount" patterns. `$effect` is also valid but only if the subscription should re-run when reactive state changes. For Realtime subscriptions that set up once and never need to re-subscribe based on local state changes, `onMount` with a return cleanup is cleaner.

```typescript
// Source: https://supabase.com/docs/guides/realtime/postgres-changes + svelte.dev lifecycle docs
import { onMount } from 'svelte';
import { supabase } from '$lib/client/supabase.js';

onMount(() => {
  const channel = supabase
    .channel('overlay-drawings')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'drawings' },
      (payload) => {
        // payload.new contains the full new row (INSERT provides full record)
        handleInsert(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'drawings' },
      (payload) => {
        // payload.old contains ONLY the primary key (id) when RLS is enabled
        // Key the bitmap cache by `id`, not `entry_id`
        handleDelete(payload.old.id);
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        // Track disconnect time for the 60s reload fallback (D-04)
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
});
```

[VERIFIED: supabase.com/docs/guides/realtime/postgres-changes]

### Pattern 3: +page.server.ts Auth Guard with Redirect

```typescript
// Source: https://svelte.dev/docs/kit/load
// web/src/routes/mod/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import { requireMod } from '$lib/server/auth.js';

export const load: PageServerLoad = async (event) => {
  // requireMod throws error(401/403) on failure — but for page load we want redirect
  const session = event.locals.session;
  if (!session) throw redirect(303, '/mod-login');
  if (!session.is_mod && !session.is_broadcaster) throw redirect(303, '/mod-login');

  // Load initial queue data for the page
  // (Optional: can also be fetched client-side after mount)
  return {
    session: {
      username: session.username,
      is_broadcaster: session.is_broadcaster
    }
  };
};
```

**Why redirect() not error():** The `requireMod()` guard in `auth.ts` throws `error(403)` which renders an error page. For UI routes, throw `redirect(303, '/mod-login')` instead so unauthenticated users get the login page.

**Accessing in component:**
```svelte
<!-- web/src/routes/mod/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>
```

[VERIFIED: svelte.dev/docs/kit/load + svelte.dev/docs/svelte/$props]

### Pattern 4: mod-login Page with PKCE Initiation

The mod-login page needs a server action (or a `+page.server.ts` with a GET action redirect) that initiates the PKCE flow. The `mod-callback` route already handles the callback. The login page only needs to:

1. Render a "Login with Twitch" button
2. On click (or on page load via a `+page.server.ts` load redirect), redirect the user to Twitch with the PKCE authorization URL

Simplest approach: a `+page.svelte` with a form POST to a `+page.server.ts` action that generates state, stores it as a cookie, and redirects to `https://id.twitch.tv/oauth2/authorize?...&redirect_uri=<MOD_REDIRECT_URI>`.

```typescript
// Initiation: web/src/routes/(auth)/mod-login/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import { TWITCH_CLIENT_ID } from '$env/static/private';
import { MOD_REDIRECT_URI } from '$lib/server/twitch-oauth.js';

export const actions: Actions = {
  default: async (event) => {
    const state = crypto.randomUUID();
    event.cookies.set('oauth_state', state, {
      path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 10
    });
    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      redirect_uri: MOD_REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
      state
    });
    throw redirect(302, `https://id.twitch.tv/oauth2/authorize?${params}`);
  }
};
```

The `mod-callback` already reads `oauth_state` cookie and deletes it on use. [VERIFIED: reading `web/src/routes/api/auth/mod-callback/+server.ts`]

### Pattern 5: StrokeRenderer.ts Interface

From rework-plan-2026.md, the function signature is well-defined. The module lives at `web/src/lib/canvas/StrokeRenderer.ts` and is imported by both the overlay and the mod dashboard preview canvas. Phase 4's `StrokePreview.svelte` in `extension/` will also need access — the extension will copy or re-export this module.

```typescript
// web/src/lib/canvas/StrokeRenderer.ts
export interface Point {
  x: number;
  y: number;
}

export function renderStrokes(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  strokes: Point[],
  lineWidths: number[],
  color: string  // 'white' default (color field added in Phase 3; use 'white' until then)
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < strokes.length; i++) {
    const path = new Path2D();
    path.moveTo(strokes[i - 1].x, strokes[i - 1].y);
    path.lineTo(strokes[i].x, strokes[i].y);
    ctx.lineWidth = lineWidths[i] ?? lineWidths[0] ?? 7;
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }
}
```

Note: `color` is not yet in the `drawings` or `queue` schemas (added in Phase 3 SCHEMA-01/02). For Phase 2, pass `'white'` as the color default when calling `renderStrokes` from both the overlay and mod dashboard.

[VERIFIED: rework-plan-2026.md — renderStrokes definition]

### Anti-Patterns to Avoid

- **Don't key the bitmap cache by `entry_id`:** Supabase DELETE events with RLS enabled only return the primary key (`id` UUID) in `payload.old`. Keying by `entry_id` means you can't find the right bitmap to remove on DELETE.
- **Don't use `$state` for `bind:this` canvas refs:** Plain `let canvas` is correct. Adding `$state` wraps it in a Proxy, which causes the canvas context to fail.
- **Don't call `requireMod()` from +page.server.ts load:** The guard throws `error(403)` which renders an error boundary page. In load functions for UI routes, throw `redirect(303, '/mod-login')` instead when the session is absent or insufficient.
- **Don't put auth guards in +layout.server.ts:** SvelteKit docs note that auth logic in layout load functions is not guaranteed to run before leaf page loads in all scenarios. Guard each page individually.
- **Don't run the rAF loop inside `onMount`:** Use `$effect` for the rAF loop — it provides a clean return-function cleanup and runs after the DOM is ready. `onMount` is better for the Realtime subscription (one-time setup, no reactive dependencies).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Supabase Realtime disconnect detection | Custom WebSocket monitor | `channel.subscribe((status) => ...)` callback | Built into supabase-js; status values include CHANNEL_ERROR, CLOSED, TIMED_OUT |
| Canvas element lifecycle in Svelte | Custom mounting logic | `bind:this` + `$effect` | Framework-native; handles SSR skip and cleanup automatically |
| PKCE state parameter generation | Custom state encoder | `crypto.randomUUID()` | Cryptographically random, available in all modern runtimes |
| JWT session parsing | Custom cookie reader | `parseSessionCookie()` from `$lib/server/session.ts` | Already implemented and tested in Phase 1 |
| Mod/broadcaster auth check | Inline session check | `requireMod()` / `requireBroadcaster()` from `$lib/server/auth.ts` (or redirect variant in load) | Guards are already tested; use consistently |

---

## Critical Pitfall: Supabase DELETE Payload with RLS

### What goes wrong
The bitmap cache removal breaks silently. When the cron job deletes an expired drawing, Supabase fires a DELETE event, but `payload.old` only contains `{ id: "<uuid>" }` — not `entry_id`, `strokes`, or any other column. If the cache is keyed by `entry_id`, the removal lookup fails and the bitmap stays on screen after the drawing is deleted from the database.

### Why it happens
When RLS is enabled on a table, Supabase Realtime cannot safely send full old-record data on DELETE because it can't apply row-level policies to rows that no longer exist. The safe default is to send only the primary key.

### How to avoid
Key the in-memory bitmap cache by `id` (UUID primary key):
```typescript
const bitmaps = new Map<string, { bitmap: ImageBitmap; approvedAt: Date; expiresAt: Date | null }>();
// On INSERT: bitmaps.set(payload.new.id, ...)
// On DELETE: bitmaps.delete(payload.old.id)
```
The initial load query and INSERT payload both return the full row including `id`.

[VERIFIED: github.com/orgs/supabase/discussions/12471 + supabase.com/docs/guides/realtime/postgres-changes]

### Warning signs
- Drawings disappear from the database (Supabase Studio confirms row deleted) but remain visible on overlay
- `payload.old` in the DELETE handler has only one key (`id`) — use `console.log` during development to confirm

---

## Common Pitfalls

### Pitfall 1: canvas is undefined in $effect (wrong timing)
**What goes wrong:** Accessing `canvas.getContext()` before `$effect` runs throws "Cannot read properties of undefined."
**Why it happens:** `bind:this` assignment happens after the DOM is painted. Module-level or `$derived` access runs before that.
**How to avoid:** Only access `canvas` inside `$effect` or `onMount`. The first time `$effect` runs, `canvas` is guaranteed to be set.

### Pitfall 2: Multiple Realtime channels for the same table
**What goes wrong:** Two subscriptions to `drawings` (e.g., one for INSERT, one for DELETE created separately) may conflict or cause duplicate events.
**How to avoid:** Chain `.on()` calls on the same `channel()` instance before calling `.subscribe()`. One channel, two `.on()` listeners.

### Pitfall 3: Disconnect fallback timer not cleared on reconnect
**What goes wrong:** The 60s reload timer (D-04) fires even after the connection successfully re-establishes, causing unexpected page reload during normal operation.
**How to avoid:** Clear the timer in the channel subscribe callback when status returns to `'SUBSCRIBED'`:
```typescript
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    if (!disconnectTimer) {
      disconnectTimer = setTimeout(() => location.reload(), 60_000);
    }
  }
});
```

### Pitfall 4: Settings Realtime UPDATE payload structure
**What goes wrong:** Trying to access `payload.new.value` directly when the `settings` table stores each setting as a row with `key` and `value` columns (JSONB).
**How to avoid:** Filter by key in the UPDATE handler:
```typescript
.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
  if (payload.new.key === 'grace_seconds') graceSeconds = payload.new.value as number;
  if (payload.new.key === 'fade_seconds') fadeSeconds = payload.new.value as number;
})
```

### Pitfall 5: Bits SKU dropdown — mismatch between stored SKU and displayed amount
**What goes wrong:** The settings form stores `bits_sku` and `bits_amount` as separate settings rows. If the broadcaster changes the SKU but `bits_amount` is not updated to match, the Extension displays the wrong Bits cost.
**How to avoid:** When the user selects a SKU from the dropdown, auto-populate the `bits_amount` field from the SKU's known cost. Use a static lookup table of SKU → bits amount (since SKUs are pre-created in the Twitch Developer Console by the developer, not dynamically fetched):
```typescript
const SKU_AMOUNTS: Record<string, number> = {
  'submit_50': 50,
  'submit_100': 100,
  'submit_200': 200,
  'submit_500': 500,
};
```
Update both `bits_sku` and `bits_amount` together in a single `PATCH /api/settings` call (or two PATCH calls in sequence).

### Pitfall 6: OBS transparent background requires correct CSS + HTML
**What goes wrong:** OBS browser source renders white background even though no background-color is set, because `body` defaults to a white background.
**How to avoid:** The overlay page must set `background: transparent` on both `html` and `body`, and the canvas must use `clearRect` (not fillRect) to clear each frame. The SvelteKit `app.html` cannot be modified just for the overlay; use a scoped style or the overlay `+page.svelte` global style:
```svelte
<style>
  :global(html), :global(body) {
    background: transparent;
    margin: 0;
    overflow: hidden;
  }
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
  }
</style>
```

---

## Code Examples

### computeAlpha utility
```typescript
// web/src/lib/canvas/computeAlpha.ts
// Source: rework-plans/rework-plan-2026.md — "Modern Client-Side Alpha Fading"
export function computeAlpha(
  approvedAt: Date,
  expiresAt: Date | null,
  graceSeconds: number
): number {
  if (expiresAt === null) return 1.0; // grace_seconds = 0: never fades
  const now = Date.now();
  const graceEnd = approvedAt.getTime() + graceSeconds * 1000;
  const fadeEnd = expiresAt.getTime();
  if (now < graceEnd) return 1.0;
  if (now >= fadeEnd) return 0.0;
  return 1.0 - (now - graceEnd) / (fadeEnd - graceEnd);
}
```

### Overlay bitmap cache + rAF loop skeleton
```typescript
// Illustrative structure for web/src/routes/overlay/+page.svelte
// Source: Svelte docs (bind:this + $effect) + supabase Realtime pattern + rework-plan-2026.md
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/client/supabase.js';
  import { renderStrokes } from '$lib/canvas/StrokeRenderer.js';
  import { computeAlpha } from '$lib/canvas/computeAlpha.js';

  interface CachedDrawing {
    bitmap: ImageBitmap;
    approvedAt: Date;
    expiresAt: Date | null;
  }

  let canvas: HTMLCanvasElement;
  let graceSeconds = $state(1200);
  let bitmaps = $state(new Map<string, CachedDrawing>()); // keyed by drawings.id (UUID)

  // rAF render loop
  $effect(() => {
    const ctx = canvas.getContext('2d')!;
    let frame = requestAnimationFrame(function loop() {
      frame = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const drawing of bitmaps.values()) {
        const alpha = computeAlpha(drawing.approvedAt, drawing.expiresAt, graceSeconds);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.drawImage(drawing.bitmap, 0, 0);
      }
      ctx.globalAlpha = 1;
    });
    return () => cancelAnimationFrame(frame);
  });

  // Realtime subscriptions + initial load
  onMount(() => {
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel('overlay-drawings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'drawings' },
        async (payload) => {
          const row = payload.new as any;
          const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
          const octx = offscreen.getContext('2d')!;
          renderStrokes(octx, row.strokes, row.line_widths, 'white');
          const bitmap = await createImageBitmap(offscreen);
          bitmaps.set(row.id, {
            bitmap,
            approvedAt: new Date(row.approved_at),
            expiresAt: row.expires_at ? new Date(row.expires_at) : null
          });
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'drawings' },
        (payload) => {
          // payload.old only has { id } due to RLS — this is why we key by id
          bitmaps.delete((payload.old as any).id);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' },
        (payload) => {
          const row = payload.new as any;
          if (row.key === 'grace_seconds') graceSeconds = row.value;
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          if (!disconnectTimer) disconnectTimer = setTimeout(() => location.reload(), 60_000);
        }
      });

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      supabase.removeChannel(channel);
    };
  });
</script>
```

### +page.server.ts auth guard (redirect variant)
```typescript
// web/src/routes/mod/+page.server.ts
// Source: svelte.dev/docs/kit/load — verified redirect pattern
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async (event) => {
  const session = event.locals.session;
  if (!session || (!session.is_mod && !session.is_broadcaster)) {
    throw redirect(303, '/mod-login');
  }
  return {
    username: session.username,
    is_broadcaster: session.is_broadcaster
  };
};
```

---

## Bits SKU Approach (Claude's Discretion)

**Decision: Use a static dropdown with a hardcoded lookup table.**

Twitch's `getProducts()` API is only available from within the Extension panel JavaScript context (i.e., `window.Twitch.ext.bits.getProducts()`). The mod dashboard runs on the external SvelteKit website, which has no access to the Extension JS SDK. Therefore, dynamically fetching SKUs is not possible from the mod settings page.

The broadcaster pre-creates SKUs in the Twitch Developer Console. The standard approach is a static dropdown of the SKUs the developer has created, co-located with their cost:

```typescript
// Static — broadcaster picks from these pre-created products
const BITS_TIERS = [
  { sku: 'submit_50',  amount: 50 },
  { sku: 'submit_100', amount: 100 },
  { sku: 'submit_200', amount: 200 },
  { sku: 'submit_500', amount: 500 },
] as const;
```

When the broadcaster selects a tier, PATCH both `bits_sku` and `bits_amount` together.

[ASSUMED: specific SKU name conventions (`submit_100` etc.) — the developer chooses these when creating products in the Twitch Developer Console. The names here are illustrative.]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Svelte stores (`writable`, `derived`) | Svelte 5 runes (`$state`, `$derived`) | Runes work anywhere in `.ts` files, not just `.svelte` components |
| `onMount` for all side effects | `$effect` for reactive effects, `onMount` for one-time setup | `$effect` auto-tracks dependencies and re-runs on state change |
| Supabase v1 `subscription.on()` API | Supabase v2 `.channel().on().subscribe()` API | Breaking change; v1 pattern does not work with supabase-js 2.x |
| `import { onDestroy } from 'svelte'` for cleanup | Return function from `$effect` or `onMount` | Cleaner co-location of setup and teardown |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bits SKU names (`submit_50`, `submit_100`, etc.) are illustrative conventions the developer chooses | Bits SKU Approach | Names must match what's actually created in the Twitch Developer Console — mismatch causes `useBits()` to fail |
| A2 | OBS Chromium supports OffscreenCanvas and createImageBitmap() | Architecture Patterns | Falls back to on-screen canvas rendering — renderStrokes directly to the visible canvas each frame instead |
| A3 | Supabase DELETE `payload.old` contains exactly `{ id }` (UUID PK only) when RLS is enabled with default replica identity | Critical Pitfall section | If full record is present, cache keying by entry_id would also work — but keying by id is safe either way |

---

## Open Questions

1. **Should graceSeconds/fadeSeconds also be loaded from the server in the overlay's initial load?**
   - What we know: `GET /api/settings` is a public endpoint that returns all settings. The overlay can fetch on mount.
   - What's unclear: Whether to load via the Supabase anon client directly or via `fetch('/api/settings')`.
   - Recommendation: Use the Supabase anon client directly (same pattern as drawings initial load, avoids extra EBS hop). Query `settings` table for `grace_seconds` and `fade_seconds` rows on mount before starting the rAF loop.

2. **Does the mod dashboard need to load queue data server-side or client-side?**
   - What we know: `GET /api/queue` is a mod-only API route (session cookie auth). The `+page.server.ts` load function already has the mod session available.
   - What's unclear: Whether to return queue data from the load function (SSR) or fetch it client-side after mount.
   - Recommendation: Fetch client-side via `fetch('/api/queue')` after mount. Queue data changes rapidly — serving stale SSR data is worse than a client-side fetch with a loading state.

3. **Where does the mod-login page live in the route tree?**
   - What we know: The `mod-callback` route already redirects to `/mod-login?error=...` on failure and to `/mod` on success. The `(auth)` route group is the planned location per STRUCTURE.md.
   - What's unclear: Whether the viewer login page (`/login`) should be created in Phase 2 or Phase 3.
   - Recommendation: Create only `(auth)/mod-login/` in Phase 2. The viewer `(auth)/login/` page is referenced in Phase 3 (DRAW-09) — stub it or defer entirely to Phase 3.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase | OVER-07 (OBS localhost test) | ✓ | CLI 2.84.4 | — |
| Docker Desktop | Local Supabase | ✓ (assumed from Phase 1 completion) | — | — |
| OBS Studio | OVER-07 | [ASSUMED] present on dev machine | — | Use browser directly for basic rendering test |
| Node.js | SvelteKit dev server | ✓ | 24.14.1 | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `web/vitest.config.ts` |
| Quick run command | `cd web && pnpm test` |
| Full suite command | `cd web && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OVER-01 to OVER-07 | Overlay renders/composites/fades correctly | manual-only | n/a — requires browser + OBS | ❌ no automated test possible |
| MOD-01 | `/mod` redirects unauthenticated users to `/mod-login` | integration | `pnpm test` (existing pattern) | ❌ Wave 0 — new test file |
| MOD-02/03/04 | Queue navigation, counter, prev/next | manual-only | n/a — UI-only behavior | ❌ manual test |
| MOD-05/06 | Approve/reject calls `POST /api/review` and advances | integration | `pnpm test` (existing review tests cover API) | ✅ `tests/api/review.test.ts` exists |
| MOD-08 | Settings form calls `PATCH /api/settings` (broadcaster only) | integration | `pnpm test` | ✅ `tests/api/settings.test.ts` exists |
| MOD-09 | Mod list calls `GET/POST/DELETE /api/moderators` | integration | `pnpm test` | ✅ `tests/api/moderators.test.ts` exists |
| MOD-10 | Canvas reset calls `POST /api/canvas/reset` | integration | `pnpm test` | ✅ `tests/api/canvas.test.ts` exists |

**Note on UI testing:** The existing test suite is integration tests against API routes (no browser automation). Overlay rendering and mod dashboard UI behavior must be verified manually. The locked requirement OVER-07 explicitly calls out "localhost OBS testing counts as done."

### Wave 0 Gaps
- [ ] `web/tests/api/mod-auth.test.ts` — test that `/mod` page server load redirects unauthenticated/non-mod users (if feasible with Vitest + SvelteKit — may be manual-only)
- [ ] `web/src/lib/canvas/` — directory must be created before StrokeRenderer.ts and computeAlpha.ts can be written

*(No new test framework install needed — Vitest 2.x already configured.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Session cookie (HS256 JWT, httpOnly, SameSite=lax) — already implemented in Phase 1 |
| V3 Session Management | yes | 7-day TTL cookie; `requireMod` / `requireBroadcaster` guards on all write endpoints |
| V4 Access Control | yes | Broadcaster-only settings routes; mod-only queue/review routes — all guarded server-side via auth.ts |
| V5 Input Validation | yes | Settings form values (grace_seconds, fade_seconds, bits_amount) must be validated as positive integers before PATCH |
| V6 Cryptography | no | No new crypto operations in Phase 2 (PKCE state uses `crypto.randomUUID()`) |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on mod-login form POST | Spoofing | State cookie (randomUUID) validated in mod-callback — already in place |
| Unauthenticated access to `/mod` | Elevation of privilege | `+page.server.ts` load redirect (documented above) |
| Broadcaster UI accessible to regular mods | Elevation of privilege | `requireBroadcaster()` guard on `/mod/settings` load function; client-side hide broadcaster sections |
| XSS via username displayed in mod dashboard | Tampering | Svelte auto-escapes `{username}` interpolations — no `{@html}` usage with user data |
| Overlay transparent background leak (OBS) | Information disclosure | CSS `background: transparent` + `clearRect` (not fillRect) per frame |

---

## Sources

### Primary (HIGH confidence)
- `web/src/lib/server/auth.ts` — auth guard implementations verified by reading source
- `web/src/lib/server/session.ts` — session cookie pattern verified
- `web/src/lib/client/supabase.ts` — anon client export verified
- `web/src/routes/api/auth/mod-callback/+server.ts` — PKCE callback reads `oauth_state` cookie
- `supabase/migrations/001_initial_schema.sql` — drawings table columns confirmed (id UUID, entry_id text)
- `supabase/migrations/002_rls_policies.sql` — RLS on drawings + settings confirmed
- `rework-plans/rework-plan-2026.md` — computeAlpha, renderStrokes, and bitmap cache design

### Secondary (MEDIUM confidence)
- [svelte.dev/tutorial/svelte/bind-this](https://svelte.dev/tutorial/svelte/bind-this) — canvas `bind:this` + `$effect` + rAF cleanup pattern
- [svelte.dev/docs/svelte/$effect](https://svelte.dev/docs/svelte/$effect) — cleanup function, timing, dependency tracking
- [svelte.dev/docs/svelte/lifecycle-hooks](https://svelte.dev/docs/svelte/lifecycle-hooks) — `onMount` with return cleanup
- [svelte.dev/docs/kit/load](https://svelte.dev/docs/kit/load) — `redirect()` in load functions, `$props()` data access
- [supabase.com/docs/guides/realtime/postgres-changes](https://supabase.com/docs/guides/realtime/postgres-changes) — INSERT/DELETE/UPDATE channel API
- [dev.twitch.tv/docs/extensions/monetization/](https://dev.twitch.tv/docs/extensions/monetization/) — SKUs are custom; `getProducts()` is Extension-JS-only

### Tertiary (LOW confidence — needs validation)
- [github.com/orgs/supabase/discussions/12471](https://github.com/orgs/supabase/discussions/12471) — DELETE payload primary-key-only behavior with RLS (verified by multiple sources agreeing)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified via npm registry, all already installed
- Svelte 5 runes canvas patterns: HIGH — verified against official svelte.dev docs with code examples
- Supabase Realtime patterns: HIGH — verified against official supabase.com docs
- DELETE payload limitation: HIGH — multiple sources confirm this is intentional behavior
- Bits SKU approach: MEDIUM — confirmed SKUs are custom and `getProducts()` is Extension-only; specific SKU names are ASSUMED

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable libraries; Supabase Realtime behavior unlikely to change)
