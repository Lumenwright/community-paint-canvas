INSERT INTO drawings (entry_id, strokes, line_widths, username, approved_at, expires_at)
VALUES (
  'test_2',
  '[{"x":50,"y":50},{"x":100,"y":100},{"x":150,"y":200}]',
  '{7,7,7}',
  'testuser',
  now(),
  now() + interval '30 seconds'
);
