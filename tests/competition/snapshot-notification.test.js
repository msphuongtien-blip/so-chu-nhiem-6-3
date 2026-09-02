#!/usr/bin/env node
/**
 * Contract test cho snapshot lịch sử tuần trước và workflow đối chiếu dữ liệu.
 *
 * Snapshot UI chỉ hiển thị các record cộng/trừ đã được chụp vào snapshot,
 * không phải bảng xếp hạng 44 học sinh. Snapshot audit vẫn bất biến; trạng
 * thái Đã cập nhật được đối chiếu với competition_records hiện tại.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-snapshot-notification-v6.js'),
    'utf8',
);
const snapshotEditSource = fs.readFileSync(
    path.join(root, 'competition-snapshot-edit-v6.js'),
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
assert.match(source, /record_history/);
assert.match(
    source,
    /\.from\(['"]competition_records['"]\)/,
    'Snapshot phải đối chiếu trạng thái với competition_records hiện tại.',
);
assert.match(source, /filterSnapshotRowsToLiveRecordsV6/);
assert.match(source, /week_start|week/);
assert.match(
    source,
    /!result\.snapshotRows\.length \|\| !result\.rows\.length/,
    'Không có record nguồn hiện tại thì không được mở snapshot.',
);
assert.match(source, /Đã cập nhật/);
assert.doesNotMatch(
    source,
    /label:\s*['"]Đã xóa['"]/,
    'Record đã xóa không được đưa vào snapshot UI.',
);
assert.match(source, /showWithCurrentStatus/);
assert.match(source, /editCompetitionRecord|openCompetitionSnapshotRecordEditorV6/);
assert.doesNotMatch(
    source,
    /final_score.*group_name.*rank/s,
    'Snapshot history không được render bảng điểm tổng/xếp hạng 44 học sinh.',
);
assert.match(source, /localStorage/);
assert.match(source, /Xem sau/);
assert.match(source, /Đã đối chiếu.*Đóng/);
assert.doesNotMatch(
    source,
    /Tạo task.*sửa điểm|tạo task.*sửa điểm/i,
    'Snapshot không còn nút tạo task sửa điểm.',
);
assert.doesNotMatch(
    source,
    /saveEditedCompetition|update\(.*competition_records|deleteCompetitionRecord/,
    'Snapshot viewer không được tự sửa/xóa dữ liệu thi đua.',
);
assert.match(source, /refreshCompetitionSnapshotNotificationV6\(\)/);
assert.match(source, /isSnapshotViewedV6\(result\.week, result\.snapshotRows\)/);
assert.match(
    source,
    /function deferCompetitionSnapshotV6[\s\S]*hideCompetitionSnapshotNoticeV6/,
    'Xem sau chỉ đóng modal.',
);
assert.match(
    source,
    /function confirmCompetitionSnapshotV6[\s\S]*markSnapshotViewedV6/,
    'Đã đối chiếu – Đóng mới đánh dấu tuần đã xem.',
);

assert.match(snapshotEditSource, /editCompetitionRecord\(normalizedRecordId\)/);
assert.doesNotMatch(snapshotEditSource, /Tạo task|createCompetitionIssueFromSnapshotV6/);

assert.match(issueServiceSource, /competition_data_issues/);
assert.match(issueServiceSource, /createIssue/);
assert.match(issueServiceSource, /listOpenIssues/);
assert.match(issueServiceSource, /resolveIssue/);

assert.match(issueRendererSource, /Mở bản ghi để sửa/);
assert.match(issueRendererSource, /Đã sửa — đóng task/);
assert.match(issueRendererSource, /CompetitionIssuesServiceV6/);

assert.match(
    migrationSource,
    /record_history jsonb not null default '\[\]'::jsonb/,
);
assert.match(
    loaderSource,
    /competition-issues-service-v6-script[\s\S]*competition-issues-renderer-v6-script[\s\S]*competition-snapshot-notification-v6-script/,
);

console.log('PASS: snapshot review requires live records in the previous week');
