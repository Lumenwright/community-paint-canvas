-- Default canvas settings
INSERT INTO settings (key, value) VALUES
  ('grace_seconds', '1200'),
  ('fade_seconds',  '120'),
  ('bits_sku',      '"submit_100"'),
  ('bits_amount',   '100')
ON CONFLICT (key) DO NOTHING;

-- Moderators seeded from data.json.
-- twitch_user_id values are placeholders — replace with real IDs once known
-- (look them up via GET https://api.twitch.tv/helix/users?login=<username>).
-- added_by is set to 'SEED' to indicate these were pre-populated, not added via the dashboard.
INSERT INTO moderators (twitch_user_id, username, added_by) VALUES
  ('placeholder_xijaroandpitch', 'xijaroandpitch', 'SEED'),
  ('placeholder_lumenwright',    'lumenwright',    'SEED'),
  ('placeholder_rathasali',      'rathasali',      'SEED'),
  ('placeholder_iiencie',        'iiencie',        'SEED'),
  ('placeholder_bigsomething_',  'bigsomething_',  'SEED'),
  ('placeholder_pablo_artigas',  'pablo_artigas',  'SEED')
ON CONFLICT (twitch_user_id) DO NOTHING;
