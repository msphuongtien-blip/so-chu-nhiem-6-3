#!/usr/bin/env node
/**
 * FILE: tests/competition/snapshot-notification.test.js
 *
 * Mục đích:
 * Contract test cho thông báo snapshot đầu tuần và viewer 44 học sinh.
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
    'Notification phải đọc snapshot từ bảng chính thức.',
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
    /rows\.length/,
    'Viewer phải hiển thị số dòng snapshot thực tế.',
);
assert.match(
    source,
    /Asia\/Ho_Chi_Minh/,
    'Tuần snapshot phải được xác định theo timezone HCM.',
);
assert.match(
    loaderSource,
    /competition-snapshot-notification-v6-script[\s\S]*competition-snapshot-notification-v6\.js/,
    'Snapshot notification phải được nạp trong module loader.',
);

console.log('PASS: snapshot notification contract');
