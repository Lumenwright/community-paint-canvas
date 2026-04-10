-- All writes to these tables go through the EBS API using the service role key,
-- which bypasses RLS entirely. Client-side Realtime subscriptions (overlay, drawing site)
-- use the anon key and need these read policies.

ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON drawings FOR SELECT USING (true);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON settings FOR SELECT USING (true);

-- queue, moderators, canvas_history: no client-side access policies.
-- All access is through server routes using the service role key.
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_history ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for overlay (INSERT/DELETE) and settings changes (UPDATE).
ALTER PUBLICATION supabase_realtime ADD TABLE drawings;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
