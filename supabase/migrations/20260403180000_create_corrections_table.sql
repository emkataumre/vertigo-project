-- Add columns needed by saveCorrection (table already existed with different schema)
alter table corrections
  add column if not exists predicted_item text,
  add column if not exists predicted_bin_id text,
  add column if not exists corrected_item text,
  add column if not exists corrected_bin_id text;

-- Allow the anon role to insert corrections from the app
create policy "Allow anonymous inserts" on corrections
  for insert to anon with check (true);
