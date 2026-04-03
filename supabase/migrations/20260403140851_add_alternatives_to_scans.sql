-- Add alternatives column to store the full alternatives array from the identify response.
-- alternative_bin_id is kept for backwards compatibility and holds alternatives[0].bin_id.
alter table scans
  add column alternatives jsonb not null default '[]'::jsonb;
