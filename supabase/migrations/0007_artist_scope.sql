-- Multi-artiste sur un Supabase partagé.
-- Le même projet Supabase sert plusieurs dashboards (Marie-Neiges, Kevin Moroz…).
-- On scope les données par artiste via une colonne `artist`.
--
-- Défaut 'marie-neiges' : les rows existantes (créées avant ce scope) sont
-- toutes du dashboard Marie-Neiges → elles héritent du bon artiste sans backfill.
-- Chaque app pose son propre slug à l'INSERT et filtre ses SELECT/realtime dessus
-- (voir ARTIST_SLUG dans lib/supabase.ts de chaque repo).
--
-- À appliquer UNE SEULE FOIS dans le SQL Editor du projet partagé.
-- Idempotente.

-- submissions --------------------------------------------------------------
alter table public.submissions
  add column if not exists artist text not null default 'marie-neiges';

create index if not exists submissions_artist_idx
  on public.submissions (artist);

-- artist_videos ------------------------------------------------------------
alter table public.artist_videos
  add column if not exists artist text not null default 'marie-neiges';

create index if not exists artist_videos_artist_idx
  on public.artist_videos (artist);

-- Realtime : pour que le filtre `artist=eq.<slug>` s'applique aussi aux
-- événements DELETE (le vieux record doit exposer la colonne artist), on passe
-- en REPLICA IDENTITY FULL. Tables petites → coût WAL négligeable.
alter table public.submissions   replica identity full;
alter table public.artist_videos replica identity full;
