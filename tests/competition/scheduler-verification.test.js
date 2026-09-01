#!/usr/bin/env node
/**
 * FILE: tests/competition/scheduler-verification.test.js
 *
 * Mục đích:
 * Contract test cho Task 10: snapshot tuần phải chạy server-side, dùng
 * service-role chỉ ở Edge Function và được scheduler gọi theo giờ HCM.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const functionSource = fs.readFileSync(
    path.join(root, 'supabase/functions/create-weekly-snapshots/index.ts'),
    'utf8',
);
const migrationSource = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260901214033_competition_weekly_snapshot_scheduler_v6.sql'),
    'utf8',
);

assert.match(
    functionSource,
    /SUPABASE_SERVICE_ROLE_KEY/,
    'Edge Function phải lấy service role từ server-side environment.',
);
assert.doesNotMatch(
    functionSource,
    /sb_publishable_|eyJ[a-zA-Z0-9_-]+\./,
    'Service-side function không được hard-code secret/token.',
);
assert.match(
    functionSource,
    /Asia\/Ho_Chi_Minh/,
    'Function phải dùng timezone Asia/Ho_Chi_Minh.',
);
assert.match(
    functionSource,
    /previousCompletedWeek/,
    'Function phải tự xác định tuần đã hoàn tất.',
);
assert.match(
    functionSource,
    /competition_weekly_snapshots\?on_conflict=student_id%2Cweek/,
    'Snapshot phải upsert theo student_id + week.',
);
assert.match(
    functionSource,
    /rankScores[\s\S]*index \+ 1/,
    'Snapshot phải tính rank từ điểm đã sắp xếp.',
);
assert.match(
    migrationSource,
    /create extension if not exists pg_cron/,
    'Migration phải bật pg_cron.',
);
assert.match(
    migrationSource,
    /create extension if not exists pg_net/,
    'Migration phải bật pg_net.',
);
assert.match(
    migrationSource,
    /5 17 \* \* 0/,
    'Scheduler phải chạy Chủ nhật 17:05 UTC = Thứ Hai 00:05 HCM.',
);
assert.match(
    migrationSource,
    /net\.http_post/,
    'Scheduler phải gọi Edge Function qua pg_net.',
);

console.log('PASS: weekly snapshot scheduler contract');
