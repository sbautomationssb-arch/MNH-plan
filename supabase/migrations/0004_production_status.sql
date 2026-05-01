-- Production pipeline status of a content piece, independent of the
-- submission triage (status: pending/liked/refused).
-- Flow: draft → shot → edited → posted. Null = not yet placed in pipeline.

alter table public.submissions
  add column if not exists production_status text;

do $$
begin
  begin
    alter table public.submissions
      add constraint submissions_production_status_check
      check (
        production_status is null
        or production_status in ('draft', 'shot', 'edited', 'posted')
      );
  exception
    when duplicate_object then null;
  end;
end$$;
