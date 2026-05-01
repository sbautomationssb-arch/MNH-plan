-- Artist drops: video files MN uploads for the planner to review.
-- Files live in a public Supabase Storage bucket; metadata in artist_videos.

create table if not exists public.artist_videos (
  id                 uuid primary key default gen_random_uuid(),
  storage_path       text not null,
  original_filename  text,
  artist_note        text not null default '',
  planner_comment    text not null default '',
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists artist_videos_created_at_desc
  on public.artist_videos (created_at desc);

drop trigger if exists artist_videos_set_updated_at on public.artist_videos;
create trigger artist_videos_set_updated_at
  before update on public.artist_videos
  for each row execute function public.set_updated_at();

-- RLS: open access (shared internal tool, no auth).
alter table public.artist_videos enable row level security;

drop policy if exists "public read"   on public.artist_videos;
drop policy if exists "public insert" on public.artist_videos;
drop policy if exists "public update" on public.artist_videos;
drop policy if exists "public delete" on public.artist_videos;

create policy "public read"   on public.artist_videos for select using (true);
create policy "public insert" on public.artist_videos for insert with check (true);
create policy "public update" on public.artist_videos for update using (true) with check (true);
create policy "public delete" on public.artist_videos for delete using (true);

-- Realtime
do $$ begin
  begin
    execute 'alter publication supabase_realtime add table public.artist_videos';
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end$$;

-- Storage bucket for the actual video files
insert into storage.buckets (id, name, public)
values ('artist-videos', 'artist-videos', true)
on conflict (id) do nothing;

drop policy if exists "artist-videos public read"   on storage.objects;
drop policy if exists "artist-videos public insert" on storage.objects;
drop policy if exists "artist-videos public delete" on storage.objects;

create policy "artist-videos public read"
  on storage.objects for select
  using (bucket_id = 'artist-videos');

create policy "artist-videos public insert"
  on storage.objects for insert
  with check (bucket_id = 'artist-videos');

create policy "artist-videos public delete"
  on storage.objects for delete
  using (bucket_id = 'artist-videos');
