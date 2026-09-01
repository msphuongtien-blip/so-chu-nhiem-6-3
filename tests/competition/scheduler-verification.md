# Task 10 — Weekly snapshot scheduler verification

## Static contract

- Edge Function: `supabase/functions/create-weekly-snapshots/index.ts`
- Scheduler: `competition-weekly-snapshots-v6`
- Timezone contract: `Asia/Ho_Chi_Minh`
- Cron expression: `5 17 * * 0` (Sunday 17:05 UTC = Monday 00:05 HCM)
- Snapshot uniqueness: `(student_id, week)`
- Service Role Key: server-side Edge Function environment only

## Live verification completed

1. Edge Function deployed as `create-weekly-snapshots`, JWT verification enabled.
2. Manual server-side invocation returned HTTP 200.
3. Target week resolved to `2026-08-24` with end `2026-08-30`.
4. Function created/upserted 44 snapshots.
5. All 44 baseline students were `81` with zero weekly change.
6. Re-running the function returned HTTP 200 and kept the snapshot count at 44.
7. Cron job exists and is active in `cron.job` with schedule `5 17 * * 0`.

## Checkpoint

Task 10 server-side snapshot + scheduler contract is implemented and live-verified. The remaining manual UI check is to inspect the Cron job history after its first scheduled execution.
