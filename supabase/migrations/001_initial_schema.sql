-- Approved drawings currently on the canvas (public read, overlay subscribes via Realtime)
CREATE TABLE drawings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    text NOT NULL UNIQUE,
  strokes     jsonb NOT NULL,          -- [{x, y}, ...]
  line_widths integer[] NOT NULL,      -- per-segment widths pre-computed at submission (base ± 2)
  username    text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz              -- NULL when grace_seconds = 0 (never expires)
);

-- Submissions in all states from initial draw through to live/rejected/cancelled
CREATE TABLE queue (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  strokes           jsonb NOT NULL,
  line_widths       integer[] NOT NULL,
  base_width        smallint NOT NULL DEFAULT 7,  -- user-selected line width (1–15px)
  twitch_user_id    text NOT NULL,
  username          text NOT NULL,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN (
                        'pending_review',        -- submitted free, awaiting mod decision
                        'approved_pending_bits', -- mod approved, waiting for user Bits
                        'live',                  -- Bits confirmed, drawing is on canvas
                        'rejected',              -- mod rejected, no Bits charged
                        'cancelled'              -- user withdrew before Bits were spent
                      )),
  bits_tx_id        text UNIQUE,        -- Twitch transaction ID (replay-protection dedup key)
  bits_confirmed_at timestamptz,
  reviewed_by       text,
  reviewed_at       timestamptz
);

CREATE INDEX idx_queue_user_status ON queue(twitch_user_id, status);
CREATE INDEX idx_queue_status ON queue(status);

-- Broadcaster-configurable canvas and submission settings (public read)
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Moderator whitelist (replaces data.json; broadcaster-only write)
CREATE TABLE moderators (
  twitch_user_id  text PRIMARY KEY,
  username        text NOT NULL,
  added_by        text NOT NULL,   -- Twitch user ID of the broadcaster who added this mod
  added_at        timestamptz NOT NULL DEFAULT now(),
  active          boolean NOT NULL DEFAULT true  -- soft delete preserves audit trail
);

-- Append-only archive of all resolved drawings (never deleted)
CREATE TABLE canvas_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    text NOT NULL,
  strokes     jsonb NOT NULL,
  line_widths integer[] NOT NULL,
  username    text NOT NULL,
  status      text NOT NULL CHECK (status IN (
                'approved',   -- moved to live (used when Bits confirmed → drawings table insert)
                'rejected',   -- mod rejected before Bits
                'expired',    -- cron removed after expires_at passed
                'cancelled',  -- user cancelled before Bits spent
                'reset'       -- broadcaster manually cleared the canvas
              )),
  resolved_at timestamptz NOT NULL DEFAULT now()
);
