-- Marie-Neiges submission queue
-- Run this in your Supabase SQL Editor once.

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  url         text not null unique,
  status      text not null default 'pending'
              check (status in ('pending', 'liked', 'refused')),
  comment     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists submissions_created_at_desc
  on public.submissions (created_at desc);

-- Auto-bump updated_at on any update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- RLS: open access (this is a shared internal tool, no auth).
alter table public.submissions enable row level security;

drop policy if exists "public read"   on public.submissions;
drop policy if exists "public insert" on public.submissions;
drop policy if exists "public update" on public.submissions;
drop policy if exists "public delete" on public.submissions;

create policy "public read"   on public.submissions for select using (true);
create policy "public insert" on public.submissions for insert with check (true);
create policy "public update" on public.submissions for update using (true) with check (true);
create policy "public delete" on public.submissions for delete using (true);

-- Realtime: allow clients to subscribe to changes.
-- Safe to re-run; wrapped in a DO block that ignores duplicate-add errors.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.submissions';
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end$$;
