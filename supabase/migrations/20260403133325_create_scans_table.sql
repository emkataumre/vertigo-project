create table scans (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  bin_id text,           -- nullable: null means item was unidentifiable
  reason_en text not null,
  reason_da text not null,
  alternative_bin_id text,
  created_at timestamptz not null default now()
);
