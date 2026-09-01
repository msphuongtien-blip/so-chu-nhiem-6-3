-- FILE: supabase/migrations/20260901214033_competition_weekly_snapshot_scheduler_v6.sql
-- Mục đích: bật pg_cron/pg_net và lịch gọi Edge Function snapshot tuần.
-- Lịch: Chủ nhật 17:05 UTC = Thứ Hai 00:05 Asia/Ho_Chi_Minh.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://fdyhnwklzizzbiyqqlxo.supabase.co',
  'competition_snapshot_project_url'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'competition_snapshot_project_url'
);

select vault.create_secret(
  'sb_publishable_QJeu6Jb17f6UVbvXJwuUMQ_-QfBaGDy',
  'competition_snapshot_publishable_key'
)
where not exists (
  select 1 from vault.decrypted_secrets where name = 'competition_snapshot_publishable_key'
);

select cron.schedule(
  'competition-weekly-snapshots-v6',
  '5 17 * * 0',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'competition_snapshot_project_url') || '/functions/v1/create-weekly-snapshots',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'competition_snapshot_publishable_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'competition_snapshot_publishable_key')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
