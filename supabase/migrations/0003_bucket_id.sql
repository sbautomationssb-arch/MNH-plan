-- Tag a submission with one of the 8 content buckets defined in lib/content.ts.
-- Nullable: a card has no bucket until the user assigns one.

alter table public.submissions
  add column if not exists bucket_id int;
