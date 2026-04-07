# Codebase Concerns

**Analysis Date:** 2026-04-06

## Summary

Phase 1 (EBS API + auth) is complete with full integration test coverage. Phases 2–4 (overlay, mod dashboard, drawing site, Twitch Extension) are entirely unimplemented — the main page at `web/src/routes/+page.svelte` is a two-line placeholder. The most significant pre-production risks are an unfixed bug in the `ext-handoff` username field, the placeholder moderator Twitch IDs in the seed migration, a `verifyTwitchTransaction` stub that will throw in production, and the Twitch Extension certification timeline (1–2 weeks) that must be planned around.

---

## Incomplete Work

**Phase 2 — Overlay and Mod Dashboard (not started):**
- `web/src/routes/overlay/+page.svelte` — does not exist. Requires Supabase Realtime subscription, OffscreenCanvas bitmap cache, `requestAnimationFrame` loop, and client-side alpha computation.
- `web/src/routes/mod/+page.svelte` — does not exist. Requires PKCE auth guard, queue display, approve/reject controls, settings panel, and mod management UI.
- `web/src/routes/(auth)/login/+page.svelte` — does not exist.
- `web/src/routes/(auth)/mod-login/+page.svelte` — does not exist.
- Supabase Realtime publication must be enabled manually after migrations: `ALTER PUBLICATION supabase_realtime ADD TABLE drawings; ALTER PUBLICATION supabase_realtime ADD TABLE settings;` — this step is a comment in `supabase/migrations/002_rls_policies.sql`, not automated.

**Phase 3 — Drawing Site (not started):**
- `web/src/routes/+page.svelte` contains only `<h1>Community Paint Canvas</h1><p>Drawing site — coming in Phase 3.</p>`.
- `web/src/lib/canvas/DrawingCanvas.svelte` — does not exist.
- `web/src/lib/canvas/OverlayCanvas.svelte` — does not exist.
- `web/src/lib/canvas/StrokeRenderer.ts` — does not exist. Referenced in architecture plan but absent from codebase.
- `web/src/lib/server/settings.ts` — referenced in architecture plan but does not exist as a standalone module (settings logic is inline in each route).

**Phase 4 — Twitch Extension (not started):**
- The `extension/` directory does not exist at all. The entire Extension panel (States A–E, Bits button, StrokePreview, handoff flow) is unbuilt.
- Bits products must be submitted to Twitch for review before production use. Twitch review is 1–2 weeks. Must be initiated early in Phase 4.
- Extension must be uploaded to Twitch CDN and tested in Sandbox before submission.

**Dev/test tooling gap:**
- A `/dev` debug route is planned (rework-tests-plan-2026.md) for Phase 2 but is not yet built.
- Bruno `.http` file for exploratory API testing is mentioned in the test plan but does not exist in the repo.

---

## Security Concerns

**Bug: `ext-handoff` sets `username` to `twitch_user_id` instead of actual username:**
- Files: `web/src/routes/api/auth/ext-handoff/+server.ts` (line ~26)
- The `signHandoffToken` call passes `username: jwt.twitch_user_id` — the Extension JWT does not carry a `username` field, so the session cookie issued via this route will have `username` equal to the numeric Twitch user ID, not the display name. Drawings submitted via Extension will be attributed with an ID string rather than a readable username.
- Fix: The Extension must include the username in its JWT payload, or the EBS must resolve the username via `GET /api/helix/users` at handoff time.

**Bug: Broken role guard logic in `ext-handoff`:**
- Files: `web/src/routes/api/auth/ext-handoff/+server.ts` (lines ~14–20)
- The guard reads: `if (!jwt.twitch_user_id || jwt.role === 'viewer') { const userId = jwt.twitch_user_id; if (!userId) throw error(401, ...) }`. The outer condition includes `jwt.role === 'viewer'` as a rejection trigger, but all legitimate viewers have `role === 'viewer'` in the Extension JWT — this would block all ordinary viewer logins. The logic is dead-branched (only the inner `if (!userId)` ever throws), but the intent is unclear and should be rewritten before Phase 4 integration.

**`verifyTwitchTransaction` is a production stub:**
- Files: `web/src/routes/api/bits/confirm/+server.ts` (lines ~69–79)
- The function calls the Twitch Helix endpoint with a literal `'Bearer <app-access-token>'` placeholder. This will return a 401 from Twitch for any non-`test_`-prefixed transaction ID in production. An App Access Token must be obtained via Client Credentials flow and injected before deployment, or the stub must be replaced with `twitch-oauth.ts` helper logic.
- Impact: If `PUBLIC_DEV_MODE` is `false` in production and a real transaction ID is submitted, the Bits confirm flow will always fail with a 502.

**Session token has no mod re-verification:**
- Files: `web/src/lib/server/auth.ts`, `web/src/lib/server/session.ts`
- The 7-day session cookie bakes `is_mod` at login time. If a moderator is removed from the `moderators` table, their existing session cookie retains mod access for up to 7 days. There is no per-request check against the DB.
- Impact: Medium — requires active exploitation window after mod removal. Fix: Check `moderators` table on each mod-level request, or reduce session TTL, or add a `session_version` mechanism.

**Placeholder moderator IDs in seed migration:**
- Files: `supabase/migrations/003_seed_data.sql`
- All six moderators are seeded with `twitch_user_id` values like `'placeholder_xijaroandpitch'`. These will never match a real Twitch JWT. Mods cannot log in until real IDs are looked up via `GET https://api.twitch.tv/helix/users?login=<username>` and the table is updated. The migration comment acknowledges this but it is a deployment blocker.

**CORS origin regex is overly broad for prod:**
- Files: `web/src/hooks.server.ts`
- The regex `^https:\/\/[a-z0-9]+\.ext-twitch\.tv$` matches any subdomain of `ext-twitch.tv`, not just the specific Extension's client ID subdomain. In practice only the correct client ID will have the Extension secret, but the CORS header will be sent to any `ext-twitch.tv` origin. Low risk but worth tightening to the specific client ID in production.

**`PUBLIC_DEV_MODE` defaults to `true` in `.env.example`:**
- Files: `web/.env.example`
- If a developer copies `.env.example` to `.env` for production (a common mistake), dev mode is active and Bits transaction verification is bypassed for any `test_`-prefixed ID. Fix: Default to `false` or add a production startup check.

---

## Technical Debt

**`bits/confirm` is not a true atomic DB transaction:**
- Files: `web/src/routes/api/bits/confirm/+server.ts`
- The route does `UPDATE queue` and then `INSERT INTO drawings` as two separate Supabase calls, not inside a Postgres transaction. If the `INSERT` fails after the `UPDATE`, the queue entry is `live` but no drawing exists on the canvas. Supabase supports RPC calls; wrapping this in a Postgres function would make it atomic.
- Impact: Data inconsistency. Low probability but non-zero.

**Same non-atomic pattern in `canvas/reset` and `cron/expire`:**
- Files: `web/src/routes/api/canvas/reset/+server.ts`, `web/src/routes/api/cron/expire/+server.ts`
- Both routes do `INSERT INTO canvas_history` then `DELETE FROM drawings` as separate calls. A failure between the two leaves rows deleted from `drawings` but unarchived. The comment "archive first" mitigates data loss but a partial archive is possible if the insert covers some rows and then errors.

**`canvas_history.status` schema mismatch with rework plan:**
- Files: `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/002_rls_policies.sql` (comment), `rework-plans/rework-tests-plan-2026.md`
- The rework plan (`002_rls_policies.sql`) listed `canvas_history.status` as only allowing `'approved' | 'rejected' | 'expired' | 'cancelled'`. The actual schema in `001_initial_schema.sql` includes `'reset'` as well. The test plan (rework-tests-plan-2026.md, line 283) has an open question about this. The schema is correct; the plan comment is stale. The `'approved'` status in the check constraint is also never written by any current route — `bits/confirm` does not insert to `canvas_history` on approval; only the `drawings` table is written. The `'approved'` enum value is unused dead code in the constraint.

**`settings.ts` server module is missing:**
- The architecture plan (`rework-plan-2026.md`) lists `web/src/lib/server/settings.ts` as a module for reading/writing canvas settings, but it does not exist. Settings are read inline in `bits/confirm` with no abstraction. When Phase 2+ routes need settings, this inline pattern will be duplicated unless the module is created.

**No input validation on `strokes` content:**
- Files: `web/src/routes/api/drawings/+server.ts`
- The route validates that `strokes` is a non-empty array but does not validate the shape of individual point objects (`{x, y}`), that coordinates are numbers, or that the array is within a reasonable size limit. A malicious user could submit an arbitrarily large strokes payload.

**No rate limiting on any endpoint:**
- There is no rate limiting middleware anywhere in `web/src/`. The drawing submission endpoint, in particular, has a one-active-submission-per-user guard but no rate limit on the number of complete submissions over time. This could be spammed to fill `canvas_history`.

---

## Performance Risks

**Extension polling at 10s fixed interval:**
- Per the rework plan, the Extension polls `GET /api/queue/my-status` every 10 seconds for every viewer with an open submission. At peak viewership this could generate significant request volume. The current implementation has no backoff or push alternative (Supabase Realtime is not available inside Twitch Extensions). This is an acceptable architectural constraint but a scaling consideration.

**Cron at 1-minute resolution with serverless cold starts:**
- Files: `web/vercel.json`
- The Vercel Cron fires every minute. On the free Vercel tier, serverless functions have cold start latency. The cron expiry is not time-critical (drawings fade client-side), but if cold starts are frequent, the `DELETE` from `drawings` could be delayed by tens of seconds beyond the scheduled minute, causing a brief mismatch between client-side fade completion and the Realtime DELETE event.

**OffscreenCanvas not yet implemented — no measured baseline:**
- The OffscreenCanvas bitmap cache described in the rework plan is an architecture decision without measured validation. Large canvases with many simultaneous drawings could hit memory pressure from `createImageBitmap()` cache growth. No eviction strategy is specified in the plan.

**`GET /api/settings` is called publicly with no caching:**
- Files: `web/src/routes/api/settings/+server.ts`
- The overlay, Extension, and drawing site all read settings on load. With no HTTP caching headers (`Cache-Control`) set on the response, repeated reloads will hit the Supabase DB each time. Low concern at current scale but worth adding `Cache-Control: public, max-age=30` for the GET.

---

## TODOs / FIXMEs

No `TODO`, `FIXME`, `HACK`, or `XXX` comments are present in any source file under `web/src/`. All in-code annotations use descriptive comments. The only open issues are in the test plan document:

- `rework-plans/rework-tests-plan-2026.md` line 283: "Open question: `canvas_history.status` currently only allows `'approved' | 'rejected' | 'expired' | 'cancelled'`. A broadcaster reset is semantically distinct from expiry — decide whether to add `'reset'` to the check constraint or keep using `'expired'` before implementing." — This is resolved in `001_initial_schema.sql` (`'reset'` is in the constraint) but the test plan was not updated to reflect the decision.

- `rework-plans/rework-tests-plan-2026.md` line 318: "Note: Soft delete (`active = false`) is assumed over hard delete to preserve the `added_by` audit trail. Confirm this before implementing." — This is implemented as soft delete in `web/src/routes/api/moderators/+server.ts`. Resolved but plan not updated.

- `supabase/migrations/003_seed_data.sql`: Placeholder moderator `twitch_user_id` values (`'placeholder_xijaroandpitch'`, etc.) need to be replaced with real Twitch user IDs before production deployment.

- `web/src/routes/api/bits/confirm/+server.ts` line 71: `Authorization: 'Bearer <app-access-token>'` literal placeholder. Must be replaced with a real App Access Token before production.

---

## Risk Areas

**Twitch Extension certification:**
- Twitch Extension review takes approximately 1–2 weeks (noted in rework plan gotchas). Bits product approval is a separate review step. Both must be submitted only after Phase 4 is fully tested in Sandbox. Any change to the Extension after submission restarts the review clock. Plan to submit with buffer time before the target go-live date.

**Bits payment — no refund path:**
- The entire moderation-before-Bits design exists because Twitch provides no programmatic Bits refund API. The cancel flow (`DELETE /api/queue/my-submission`) is the only safety valve. If the `bits/confirm` route is called successfully but the DB write fails (see non-atomic concern above), the user has spent Bits and receives nothing — there is no recovery path except manual broadcaster intervention. The atomic transaction fix is therefore higher priority than it may appear.

**Twitch API dependency — App Access Token management:**
- `verifyTwitchTransaction` requires a valid App Access Token that expires. No token refresh logic exists anywhere in the codebase. Before Phase 4, a token cache/refresh mechanism must be added to `twitch-oauth.ts` or the verification will silently fail after the initial token expires (typically 60 days for app tokens, but Twitch can revoke them earlier).

**Supabase Realtime for overlay:**
- The overlay's live update mechanism depends on Supabase Realtime (Postgres CDC via websockets). Supabase Realtime on the free tier has connection limits and does not guarantee delivery ordering. A brief Realtime outage will leave the overlay stale until reconnect. No fallback polling is specified in the plan.

**OffscreenCanvas browser compatibility:**
- OffscreenCanvas is available in all modern browsers and OBS Chromium (as noted in the rework plan gotchas). However, it is not available in Safari until version 16.4 (2023). If any broadcaster uses Safari for their mod dashboard or drawing site, canvas-related features may degrade. The overlay is always in OBS (Chromium), so that path is safe.

**Session cookie `is_broadcaster` relies on a single hardcoded env var:**
- Files: `web/src/routes/api/auth/mod-callback/+server.ts`, `web/src/lib/server/auth.ts`
- `BROADCASTER_TWITCH_ID` is a single static env var. If the broadcaster account changes or multiple broadcaster-level accounts are needed, this requires a deployment config change rather than a UI change. Low risk for a single-broadcaster app but worth noting.

**`PUBLIC_DEV_MODE` is a client-visible env var:**
- Files: `web/src/lib/server/twitch-oauth.ts`, `web/src/routes/api/bits/confirm/+server.ts`
- `PUBLIC_DEV_MODE` is read via `$env/static/public`, meaning it is bundled into client-side JavaScript. Its value is visible to anyone who inspects the page source. If `PUBLIC_DEV_MODE=true` leaks to production, the `test_` transaction bypass is advertised publicly. Prefer a server-only private env var (`$env/static/private`) for this flag.

---

*Concerns audit: 2026-04-06*
