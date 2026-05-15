-- Allow submissions without an Instagram URL — free-form note cards that
-- planners (Marie-Neiges, Jérémy) can drag from the calendar pool onto a day.
-- PostgreSQL UNIQUE allows multiple NULLs, so the existing url uniqueness
-- stays intact for real URLs.

alter table public.submissions
  alter column url drop not null;
