#!/usr/bin/env node
/**
 * FILE: tests/competition/snapshot-notification.test.js
 *
 * Mục đích:
 * Contract test cho snapshot lịch sử tuần trước và workflow báo lỗi dữ liệu.
 *
 * Snapshot UI chỉ hiển thị các record cộng/trừ thực tế của tuần đã chốt,
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
const loaderSource = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);

assert.match(
    source,
    /competition_weekly_snapshots/,
    'Notification phải kiểm tra snapshot tuần trước.',
);
assert.match(
    source,
    /competition_records/,
    'Snapshot viewer phải đọc lịch sử record cộng/trừ từ Source of Truth.',
);
assert.match(
    source,
    /select\(.*id.*student_id.*date.*criteria.*points.*note/s,
    'Viewer phải lấy đủ thông tin của từng record để giáo viên đối chiếu.',
);
assert.doesNotMatch(
    source,
    /final_score.*group_name.*rank/s,
    'Snapshot history không được render bảng điểm tổng/xếp hạng 44 học sinh.',
);
assert.match(
    source,
    /localStorage/,
    'Module phải lưu trạng thái đã xem.',
);
assert.match(
    source,
    /Xem snapshot/,
    'UI phải có hành động Xem snapshot.',
);
assert.match(
    source,
    /Xem sau/,
    'UI phải có hành động Xem sau.',
);
assert.match(
    source,
    /Tạo task.*sửa điểm|tạo task.*sửa điểm/i,
    'Mỗi record snapshot phải có hành động tạo task khi phát hiện nhập sai.',
);
assert.match(
    source,
    /competition_data_issues/,
    'Task sửa sai dữ liệu phải được lưu vào bảng issue chính thức.',
);
assert.doesNotMatch(
    source,
    /saveEditedCompetition|update\(.*competition_records|deleteCompetitionRecord/,
    'Snapshot viewer không được sửa/xóa trực tiếp dữ liệu thi đua.',
);
assert.match(
    source,
    /refreshCompetitionSnapshotNotificationV6\(\)/,
    'Notification phải được refresh ngay sau khi module cài đặt, không chỉ sau lần render tiếp theo.',
);
assert.match(
    loaderSource,
    /competition-snapshot-notification-v6-script[\s\S]*competition-snapshot-notification-v6\.js/,
    'Snapshot notification phải được nạp trong module loader.',
);

console.log('PASS: snapshot notification contract');
