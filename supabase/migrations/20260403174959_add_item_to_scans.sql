-- Add item column to store the identified item name from the identify response.
alter table scans
  add column item text not null default '';
