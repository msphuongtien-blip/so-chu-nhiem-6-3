#!/usr/bin/env node
/**
 * Contract test cho snapshot lịch sử tuần trước và workflow báo lỗi dữ liệu.
 *
 * Snapshot UI chỉ hiển thị các record cộng/trừ đã được chụp vào snapshot,
 * không phải bảng xếp hạng 44 học sinh. Snapshot là read-only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-snapshot-notification-v6.js'),
    'utf8',
);
const issueRendererSource = fs.readFileSync(
    path.join(root, 'competition-issues-renderer-v6.js'),
    'utf8',
);
const issueServiceSource = fs.readFileSync(
    path.join(root, 'competition-issues-service-v6.js'),
    'utf8',
);
const loaderSource = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);
const migrationSource = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260901220000_competition_weekly_snapshot_history_v6.sql'),
    'utf8',
);

assert.match(source, /competition_weekly_snapshots/);
assert.match(
    source,
    /record_history/,
    'Snapshot phải đọc bản chụp record-level history.',
);
assert.doesNotMatch(
    source,
    /\.from\(['"]competition_records['"]\)/,
    'Viewer không được đọc competition_records hiện tại để thay thế lịch sử snapshot.',
);
assert.doesNotMatch(
    source,
    /final_score.*group_name.*rank/s,
    'Snapshot history không được render bảng điểm tổng/xếp hạng 44 học sinh.',
);
assert.match(source, /localStorage/);
assert.match(source, /Xem snapshot/);
assert.match(source, /Xem sau/);
assert.match(source, /Tạo task.*sửa điểm|tạo task.*sửa điểm/i);
assert.doesNotMatch(
    source,
    /saveEditedCompetition|update\(.*competition_records|deleteCompetitionRecord/,
    'Snapshot viewer không được sửa/xóa dữ liệu thi đua trực tiếp.',
);
assert.match(source, /refreshCompetitionSnapshotNotificationV6\(\)/);

assert.match(issueServiceSource, /competition_data_issues/);
assert.match(issueServiceSource, /createIssue/);
assert.match(issueServiceSource, /listOpenIssues/);
assert.match(issueServiceSource, /resolveIssue/);
assert.match(issueServiceSource, /status.*OPEN|OPEN.*status/);
assert.match(issueServiceSource, /status: 'RESOLVED'/);

assert.match(issueRendererSource, /Mở bản ghi để sửa/);
assert.match(issueRendererSource, /Đã sửa — đóng task/);
assert.match(issueRendererSource, /CompetitionIssuesServiceV6/);
assert.match(issueRendererSource, /notification|thông báo/i);

assert.match(
    migrationSource,
    /record_history jsonb not null default '\[\]'::jsonb/,
    'DB phải lưu record history ngay trong weekly snapshot.',
);
assert.match(
    loaderSource,
    /competition-issues-service-v6-script[\s\S]*competition-issues-renderer-v6-script[\s\S]*competition-snapshot-notification-v6-script/,
    'Issue service/renderer phải được nạp trước snapshot notification.',
);

console.log('PASS: snapshot history and score-correction workflow contract');
