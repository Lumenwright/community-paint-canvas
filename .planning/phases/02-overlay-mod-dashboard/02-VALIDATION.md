---
phase: 2
slug: overlay-mod-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && pnpm test -- --run` |
| **Full suite command** | `cd web && pnpm test` |
| **Estimated runtime** | ~15–30 seconds (integration tests hit real Supabase) |

---

## Sampling Rate

- **After every task commit:** Run `cd web && pnpm test -- --run`
- **After every plan wave:** Run `cd web && pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | OVER-02,03,04 | — | N/A | manual | OBS browser source at localhost renders drawings with fading | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | OVER-05 | — | N/A | manual | Realtime INSERT adds drawing to overlay | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | OVER-06 | — | N/A | manual | Realtime settings UPDATE reloads fade config | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | OVER-01 | — | N/A | manual | Overlay full-screen transparent in OBS at localhost | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 2 | OVER-07 | — | N/A | manual | OVER-07 verified in OBS browser source | ❌ W0 | ⬜ pending |
| 2-02-00 | 02 | 2 | MOD-01 | T-2-01 | Unauthenticated /mod redirects to /mod-login | integration | `cd web && pnpm test -- --run tests/api/mod-auth.test.ts` | ✅ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | MOD-01 | T-2-01 | Unauthenticated /mod redirects to /mod-login | integration | `cd web && pnpm test -- --run tests/api/mod-auth.test.ts` | ✅ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | MOD-02,03,04,05,06,07 | — | N/A | manual | Queue review renders drawings, Next/Prev, Approve/Reject, auto-advance | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | MOD-08 | T-2-02 | Broadcaster-only settings PATCH rejected for non-broadcaster | integration | `cd web && pnpm test -- --run tests/api/settings.test.ts` | ✅ | ⬜ pending |
| 2-02-04 | 02 | 2 | MOD-09 | T-2-03 | Non-broadcaster cannot add/remove mods | integration | `cd web && pnpm test -- --run tests/api/moderators.test.ts` | ✅ | ⬜ pending |
| 2-02-05 | 02 | 2 | MOD-10 | T-2-04 | Non-broadcaster cannot reset canvas | integration | `cd web && pnpm test -- --run tests/api/canvas.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `web/tests/api/mod-auth.test.ts` — stub for MOD-01 redirect behavior (created in Task 02-00)
- [ ] All other API tests (settings, moderators, canvas reset) already exist from Phase 1

*Existing Phase 1 integration test infrastructure covers most API-level verification. Wave 0 gap for mod-auth page redirect test is now closed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Overlay renders drawings with alpha fading | OVER-01 through OVER-04 | Requires OBS browser source; no headless DOM testing for OffscreenCanvas compositing | Open OBS, add browser source at http://localhost:5173/overlay, insert test drawing via Supabase Studio, verify it appears and fades |
| Realtime drawing add/remove | OVER-05 | Requires live Supabase Realtime connection | Insert/delete row in `drawings` via Supabase Studio, verify overlay updates without reload |
| Realtime settings reload | OVER-06 | Requires live Realtime on `settings` table | Update `grace_seconds` in Supabase Studio, verify overlay fade timing changes without reload |
| OBS localhost verification | OVER-07 | Requires OBS application | Full OBS browser source test at http://localhost:5173/overlay |
| Queue review UX | MOD-02 through MOD-07 | Requires browser interaction with rendered canvas | Log in as mod, navigate to /mod, test queue navigation and approve/reject with auto-advance |
| Broadcaster settings form | MOD-08 | Requires browser form interaction | Log in as broadcaster, navigate to /mod/settings, update grace_seconds, verify PATCH /api/settings called |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
