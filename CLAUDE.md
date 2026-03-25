# Community Paint Canvas — Claude Context

## Project Overview

A prototype community drawing app where Twitch viewers draw doodles locally, submit them, and (after matching a Tiltify donation + moderator approval) the drawings appear on a shared 500×500px canvas that can be streamed to Twitch. Drawings fade out after ~22 minutes.

**Stack:** Python (Flask + Flask-RESTful), Vue.js 2 (no build step, CDN-style), Firebase Realtime Database, Twitch OAuth, Tiltify donations API.

**Hosting:** Google Cloud App Engine — `https://community-paint-canvas.uk.r.appspot.com`

---

## Project Structure

```
main.py          # Flask app + all route handlers
pixels.py        # Flask-RESTful Resource for /pixels; Firebase init; starts background threads
invoice.py       # Core business logic: invoice creation, Tiltify polling, alpha fading
keys.py          # Firebase path/key name constants
poller.py        # RepeatedTimer utility (threading-based background scheduler)

static/
  script2.js     # Vue app for the public drawing canvas
  login.js       # Vue app for the moderator approval interface
  style.css      # Minimal canvas border styling
  vue.js         # Vue 2 library (vendored)

template/
  index2.html    # Public canvas page
  login.html     # Moderator approval page

data.json        # Moderator Twitch username allow-list + Twitch client ID
requirements.txt # flask, flask_restful, requests, firebase_admin
todo.md          # Feature backlog and known bugs
```

---

## Credentials / Secrets (never committed)

`dont_commit.py` is gitignored and must exist locally. It exports:
- `CRED_LOC` — path to Firebase service account JSON
- `DB_URL` — Firebase Realtime Database URL
- `AT` — Tiltify API Bearer token
- `ID` — Tiltify campaign ID

Firebase credentials JSON is also gitignored.

---

## Firebase Realtime Database Schema

```
root/
  pixels/           # Approved drawings currently on canvas
    {entry_id}/
      {n}: {x, y}   # Mouse-position points (list stored as dict)

  queue/            # Submissions awaiting mod review
    {entry_id}: [{x, y}, ...]

  invoice/          # Active submission records
    {entry_id}/
      text_response: str     # User's description (also their donation comment)
      total_donate: int      # Pixel/move count
      Time: str              # Formatted timestamp "Mar25-132500"
      heartbeat_time: float  # Epoch time (used to verify donation came after submission)
      approved: 0|1|2        # NOT_REVIEWED | APPROVED | REJECTED

  alphas/           # Per-drawing transparency for fading
    {entry_id}/
      Time: float   # Epoch time when drawing was approved
      alpha: 0-255  # Current opacity (255 = fully opaque)

  history/canvas_dump/{entry_id}       # Archive of approved pixel data
  invoice_history/{entry_id}           # Archive of resolved invoices
  rejected_history/{entry_id}: true    # Log of rejected submissions
```

---

## Key Flows

### Submission → Canvas Lifecycle

1. User draws on canvas → clicks Submit → `POST /pixels` with pixel array + description
2. `make_invoice()` creates Firebase `invoice` + `queue` entries; returns `entry_id`
3. User is prompted to copy their description as a Tiltify donation comment
4. Background `resolve_invoice()` (every 5 s) polls Tiltify for matching donations (comment contains description AND donation time > submission time)
5. Moderator logs in via Twitch OAuth, sees queue, approves/rejects via `POST /review`
6. `POST /review` validates mod's Twitch token, checks against `data.json` allow-list, sets `invoice.approved = 1|2`
7. Next `resolve_invoice()` run calls `resolve_submission()` (approved) or `reject()` (rejected)
8. `resolve_submission()` moves pixels to `pixels/` node, sets `alpha=255`
9. `reduce_alpha_value()` (every 5 s) fades drawings: 20-min grace, then 2-min fade in 10 steps of 25.5 alpha, then deletes
10. Frontend watches `alphaDict` and redraws canvas on every change

### Moderator Auth Flow

1. Mod clicks Twitch login link (implicit OAuth, token lands in URL hash)
2. `login.js` validates token against `https://id.twitch.tv/oauth2/validate`
3. Fetches username from `https://api.twitch.tv/helix/users`
4. Checks username in `data.json` allow-list
5. If authorized, mod sees and can act on the approval queue

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Public canvas page |
| GET | `/login` | Moderator approval page |
| GET | `/pixels` | All approved drawings |
| POST | `/pixels` | Submit drawing (body: `{pixels, text_response, total_donate}`) |
| GET | `/alphas` | Alpha values for all drawings |
| GET | `/invoices/<entry>` | Invoice details by ID |
| GET | `/queue` | Submissions pending review |
| POST | `/review` | Approve/reject (body: `{token, status, entry}`) |
| GET | `/reset-clear` | Archive + clear entire canvas (unprotected) |

---

## Frontend Notes

- **No build step.** Vue 2 is vendored in `static/vue.js`. JS files are plain scripts loaded via `<script>` tags.
- `script2.js` has **two** Vue instances on the public page: one for the canvas (`drawing`), one for the Twitch login link (`auth`).
- `login.js` also has two Vue instances: `auth` (token validation) and `drawing` (approval queue).
- Canvas drawing uses red strokes (5–10px random width, `rgba`-based alpha for approved drawings).
- The Twitch client ID is hardcoded in both `login.js` and `data.json`:  `iplrkfjlmtjhhhsdjjg2mw8h8bhxfc`.
- Redirect URI is hardcoded to the production App Engine URL.

---

## 2026 Rework (branch: `2026-rework`)

The full rework plan is at [rework-plans/rework-plan-2026.md](rework-plans/rework-plan-2026.md).
The Phase 1 test plan is at [rework-plans/rework-tests-plan-2026.md](rework-plans/rework-tests-plan-2026.md).

**Direction:** Replace the entire stack with a pnpm monorepo:
- **`extension/`** — Svelte 5 + Vite, Twitch Extension Panel (payment gateway + status display only, no drawing canvas)
- **`web/`** — SvelteKit + Supabase (drawing site, stream overlay, mod dashboard, EBS API)
- **Database** — Supabase (Postgres + Realtime WebSockets) replaces Firebase
- **Payment** — Twitch Bits via Extensions API replaces Tiltify; **moderation happens BEFORE Bits are spent** (no refund needed on rejection)
- **Auth** — Twitch PKCE replaces implicit OAuth; Extension users get seamlessly auto-logged into the drawing site via a signed 60s handoff token

**Key design decisions:**
- Drawing happens on the external website (full-size canvas), not inside the small Extension panel
- Bits are only spent after mod approval — rejected drawings cost the viewer nothing
- Alpha fading is computed client-side from `approved_at`/`expires_at` timestamps (no backend alpha column)
- Canvas rendering uses OffscreenCanvas bitmap cache + `requestAnimationFrame` (GPU-composited)
- Fade timing and Bits SKU/amount are broadcaster-configurable via the mod dashboard
- Cancel available in both `pending_review` and `approved_pending_bits` states (small text link)

---

## Known Prototype Limitations / Tech Debt

See `todo.md` for the full backlog. Key items:
- Tiltify donation matching is naive (text substring match only)
- `/reset-clear` endpoint is unprotected
- Uses Twitch implicit OAuth flow (token in URL hash) — should migrate to authorization code flow
- No Twitch login required to submit drawings
- Frontend polling is driven by Vue watchers reacting to Firebase alpha changes (not a timer)
- Firefox performance is slow
- `dont_commit.py` pattern means local setup requires manual credential wiring
- `data.json` moderator list must be edited manually and re-deployed

---

## Development Setup

1. Create `dont_commit.py` with the four credentials (see above)
2. Place Firebase service account JSON at the path referenced by `CRED_LOC`
3. `pip install -r requirements.txt`
4. `python main.py`

No frontend build step needed.
