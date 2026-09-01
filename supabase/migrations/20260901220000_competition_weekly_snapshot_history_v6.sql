-- V6: immutable record-level history inside the weekly snapshot.
-- The snapshot is for reviewing last week's score changes; it is not an editable copy.

alter table public.competition_weekly_snapshots
    add column if not exists record_history jsonb not null default '[]'::jsonb;

comment on column public.competition_weekly_snapshots.record_history is
    'Immutable snapshot of valid competition_records for this student and completed week; used for audit/review, never edited from snapshot UI.';
