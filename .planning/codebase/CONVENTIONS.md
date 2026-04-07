# Coding Conventions

**Analysis Date:** 2026-04-06

The codebase is a SvelteKit 2 + Svelte 5 TypeScript project with strict mode enabled. Conventions follow the SvelteKit file-based routing model with a clean server/client module split, and the overall style favors explicit, readable code with early-return error handling over deeply nested conditionals.

---

## TypeScript Configuration

**Strictness:** Full strict mode (`"strict": true` in `web/tsconfig.json`) plus `checkJs`, `esModuleInterop`, `resolveJsonModule`, and `forceConsistentCasingInFileNames`.

**Module system:** ESM throughout (`"type": "module"` in `web/package.json`). All imports use `.js` extensions even for `.ts` source files (required for Node ESM resolution with SvelteKit).

```typescript
// Correct import style in this project
import { db } from '$lib/server/supabase.js';
import { requireSession } from '$lib/server/auth.js';
```

**Type definitions:** Exported interfaces and function signatures are explicitly typed. Local inference is used for simple assignments. Types use `interface` for object shapes, `type` for unions. No `enum` usage observed — string literal unions are preferred.

```typescript
// From web/src/lib/server/twitch-jwt.ts
export interface ExtJWTPayload {
  twitch_user_id: string;
  opaque_user_id: string;
  channel_id: string;
  role: string;
  exp: number;
  iat: number;
}

// From web/src/lib/server/auth.ts
export interface SessionOptions {
  twitch_user_id?: string;
  username?: string;
  is_mod?: boolean;
  is_broadcaster?: boolean;
}
```

**`any` avoidance:** Not observed in source files. External payloads (JWT, Supabase responses) are cast via `unknown as T` with explicit interface definitions.

---

## Naming Conventions

**Files:**
- SvelteKit route files: SvelteKit convention (`+server.ts`, `+page.svelte`, `$types.js`)
- Library modules: `camelCase` (`supabase.ts`, `twitch-jwt.ts`, `twitch-oauth.ts`)
- Hyphenated names for multi-word modules: `twitch-jwt.ts`, `twitch-oauth.ts`

**Variables and functions:** `camelCase` throughout.

**Boolean fields:** `is_` prefix for session flags (`is_mod`, `is_broadcaster`). Database column names use snake_case throughout.

**Constants:** `UPPER_SNAKE_CASE` for module-level constants.

```typescript
// From web/src/routes/api/drawings/+server.ts
const MIN_STROKES = 2;
const MIN_WIDTH = 1;
const MAX_WIDTH = 15;
const ACTIVE_STATUSES = ['pending_review', 'approved_pending_bits'];
```

**Types and interfaces:** `PascalCase` (`SessionData`, `ExtJWTPayload`, `RequestOptions`, `SeedOptions`).

**Database columns:** snake_case, matching Postgres convention (`twitch_user_id`, `entry_id`, `bits_tx_id`, `reviewed_at`).

---

## File Organization

**Server/client split:** Strict. Server-only code lives in `web/src/lib/server/`. Client-safe code lives in `web/src/lib/client/`. Never cross this boundary.

```
web/src/lib/
  server/
    supabase.ts       # Service role Supabase client (never expose to browser)
    auth.ts           # Auth guards (requireSession, requireMod, etc.)
    twitch-jwt.ts     # Extension JWT verification + handoff token signing
    twitch-oauth.ts   # PKCE token exchange
    session.ts        # Signed httpOnly session cookie helpers
  client/
    supabase.ts       # Anon key Supabase client (Realtime subscriptions)
```

**Route organization:** One `+server.ts` per logical route. Multiple HTTP methods are exported from a single file when they share the same resource (e.g., `GET` and `PATCH` in `web/src/routes/api/settings/+server.ts`).

**File size:** All server modules are small and focused (< 65 lines each). This is a deliberate convention — extract shared logic to `lib/server/` rather than inline it.

---

## SvelteKit Conventions

**API route handlers:** Named exports matching HTTP verbs, typed with the generated `RequestHandler` from `./$types.js`.

```typescript
// web/src/routes/api/drawings/+server.ts
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async (event) => {
  // ...
  return json({ entry_id: data.entry_id }, { status: 201 });
};
```

**Session access:** Session is parsed from the cookie into `event.locals.session` in `web/src/hooks.server.ts` on every request. Route handlers never touch the cookie directly — they call auth guard helpers.

```typescript
// web/src/hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const cookieValue = event.cookies.get(COOKIE_NAME);
  event.locals.session = cookieValue ? await parseSessionCookie(cookieValue) : null;
  const response = await resolve(event);
  // ... CORS headers ...
  return response;
};
```

**Locals typing:** `App.Locals` is typed in `web/src/app.d.ts`.

```typescript
// web/src/app.d.ts
export interface SessionData {
  twitch_user_id: string;
  username: string;
  is_mod: boolean;
  is_broadcaster: boolean;
}

declare global {
  namespace App {
    interface Locals {
      session: SessionData | null;
    }
  }
}
```

**Environment variables:** Always imported from `$env/static/private` (never from `process.env` in source). This gives SvelteKit build-time type checking of env vars.

```typescript
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
```

**Path aliases:** `$lib` for `web/src/lib/`, `$env` for environment access.

---

## Svelte 5 Patterns

UI is currently minimal (only `web/src/routes/+page.svelte` exists as a placeholder — Phase 3 not yet implemented). Svelte 5 rune patterns are not yet established in this codebase. When implemented, follow Svelte 5 conventions (`$state`, `$derived`, `$effect`, `$props`).

---

## Error Handling

**Pattern:** Auth guard helpers throw `error()` directly (SvelteKit's typed HTTP error), which propagates to SvelteKit's error boundary. Routes never manually construct error responses.

```typescript
// web/src/lib/server/auth.ts — the standard pattern
export function requireSession(event: RequestEvent) {
  const session = event.locals.session;
  if (!session) throw error(401, 'Not authenticated');
  return session;
}
```

**Database errors:** Supabase errors are surfaced directly with `throw error(500, dbError.message)`. No silent swallowing.

```typescript
// web/src/routes/api/review/+server.ts
const { data: submission, error: fetchError } = await db
  .from('queue')
  .select('...')
  .eq('entry_id', entry_id)
  .maybeSingle();

if (fetchError) throw error(500, fetchError.message);
if (!submission) throw error(404, 'Submission not found');
```

**Request body parsing:** JSON parse errors are caught inline and converted to 422.

```typescript
const body = await event.request.json().catch(() => {
  throw error(422, 'Invalid JSON body');
});
```

**Validation:** Manual field-by-field validation with explicit error messages. No Zod or schema validation library is currently in use (gap — see CONCERNS.md).

**Auth guard return values:** Guards return the session on success so routes can use it immediately without re-fetching from `event.locals`.

---

## Comments

**Style:** File-level comments describe the route's purpose, auth requirements, and key behavior in 2–4 lines. Inline comments explain *why* or *which step in a flow*, not what the code mechanically does.

```typescript
// POST /api/review — mod approves or rejects a pending_review submission.
// Approve: status → approved_pending_bits (no DB write to drawings yet; user must spend Bits).
// Reject:  status → rejected + archive to canvas_history.
// Auth: mod session.
```

```typescript
// Archive immediately on rejection — no Bits were ever involved
```

**What is NOT commented:** Obvious operations, SvelteKit boilerplate, straightforward conditionals.

---

## Import Organization

**Order (observed pattern):**
1. SvelteKit framework imports (`@sveltejs/kit`)
2. Type imports (`import type { ... }`)
3. Internal server lib imports (`$lib/server/...`)
4. Internal shared lib imports (`$lib/...`)

No barrel (`index.ts`) files observed in the server lib. Each module is imported directly by path.

---

## Immutability

Supabase operations always return new objects. No mutation of request bodies or session objects observed. `upsert` with `onConflict` is used over read-modify-write patterns where possible.

---

## Gaps

- No schema validation library (Zod not installed). Validation is manual in each route handler, which creates duplication risk.
- No logging library. Console output is not used in production code.
- Svelte 5 component conventions are not yet established (UI phases not yet implemented).

---

*Convention analysis: 2026-04-06*
