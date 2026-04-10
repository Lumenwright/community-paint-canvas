INSERT INTO drawings (entry_id, strokes, line_widths, username, approved_at, expires_at)
VALUES (
  'test_4',
  '[{"x":150,"y":350},{"x":200,"y":500},{"x":450,"y":400}]',
  '{7,7,7}',
  'testuser',
  now(),
  now() + interval '10 minutes'
);
