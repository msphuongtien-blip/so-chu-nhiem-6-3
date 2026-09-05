#!/usr/bin/env node
/**
 * Regression tests cho sửa điểm từ snapshot và recalculation dây chuyền.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const snapshotSource = fs.readFileSync(
    path.join(root, 'modules/competition/competition-snapshot-notification-v6.js'),
    'utf8',
);
const snapshotEditSource = fs.readFileSync(
    path.join(root, 'modules/competition/competition-snapshot-edit-v6.js'),
    'utf8',
);
const recalculationSource = fs.readFileSync(
    path.join(root, 'modules/competition/competition-recalculation-v6.js'),
    'utf8',
);
const calculationSource = fs.readFileSync(
    path.join(root, 'modules/competition/competition-calculation-v6.js'),
    'utf8',
);
const loaderSource = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);

assert.match(
    snapshotSource,
    /Xem sau/,
    'Snapshot phải có nút Xem sau.',
);
const hideHandlerMatch = snapshotSource.match(
    /function hideCompetitionSnapshotNoticeV6\(\)\s*\{([\s\S]*?)\n\}/,
);
assert.ok(hideHandlerMatch, 'Phải có handler Xem sau.');
assert.doesNotMatch(
    hideHandlerMatch[1],
    /markSnapshotViewedV6/,
    'Xem sau không được đánh dấu snapshot đã xem.',
);
assert.match(
    snapshotEditSource,
    /editCompetitionRecord\(normalizedRecordId\)/,
    'Nút Sửa phải gọi đúng edit flow hiện có bằng competition_record_id.',
);
assert.match(
    snapshotEditSource,
    /competition_records|record editor|luồng sửa chuẩn/i,
    'Snapshot edit module phải mô tả rõ write path dùng flow chuẩn.',
);
assert.doesNotMatch(
    snapshotEditSource,
    /\.from\(['"]competition_weekly_snapshots['"]\)[\s\S]*\.update\(/,
    'Không được sửa trực tiếp snapshot audit.',
);
assert.match(
    recalculationSource,
    /saveEditedCompetitionWithRecalculationV6/,
    'Save edit phải được hook để kích hoạt recalculation.',
);
assert.match(
    recalculationSource,
    /recalculateCompetitionFromWeekV6\(startWeek\)/,
    'Historical edit phải tái tính từ tuần được sửa.',
);
assert.match(
    loaderSource,
    /competition-recalculation-v6-script[\s\S]*competition-snapshot-notification-v6-script[\s\S]*competition-snapshot-edit-v6-script/,
    'Recalculation phải được nạp trước snapshot edit.',
);

const context = {
    console,
    Date,
    Math,
    Set,
    Map,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
};
context.globalThis = context;
vm.runInNewContext(calculationSource, context);
vm.runInNewContext(recalculationSource, context);

const student = { id: 'student-1' };
const recordsBeforeEdit = [
    { student_id: student.id, week: '2026-08-24', score: 5 },
    { student_id: student.id, week: '2026-08-31', score: 5 },
    { student_id: student.id, week: '2026-09-07', score: -5 },
];
const before = context.CompetitionRecalculationV6.calculate(
    recordsBeforeEdit,
    [student],
    '2026-08-24',
);

assert.deepEqual(
    Array.from(before.calculations, (item) => item.weeklyScore),
    [86, 86, 76],
    'Chuỗi trước sửa phải áp dụng rollover theo từng tuần.',
);

const recordsAfterEdit = [
    { student_id: student.id, week: '2026-08-24', score: -5 },
    { student_id: student.id, week: '2026-08-31', score: 5 },
    { student_id: student.id, week: '2026-09-07', score: -5 },
];
const after = context.CompetitionRecalculationV6.calculate(
    recordsAfterEdit,
    [student],
    '2026-08-24',
);

assert.deepEqual(
    Array.from(after.calculations, (item) => item.weeklyScore),
    [76, 76, 66],
    'Sửa tuần cũ phải làm thay đổi toàn bộ chuỗi tuần sau qua rollover.',
);

console.log('PASS: snapshot edit + historical recalculation contract');
