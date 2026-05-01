-- Add scheduled_for column to support the content calendar.
-- Liked submissions with scheduled_for IS NULL form the calendar pool.
-- Once dragged onto a calendar day, scheduled_for becomes that date.

alter table public.submissions
  add column if not exists scheduled_for date;

create index if not exists submissions_scheduled_for_idx
  on public.submissions (scheduled_for)
  where scheduled_for is not null;
