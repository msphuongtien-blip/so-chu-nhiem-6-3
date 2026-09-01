#!/usr/bin/env node
/**
 * Regression tests cho các lỗi UI vừa phát hiện từ runtime.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const autocompleteSource = fs.readFileSync(
    path.join(root, 'student-autocomplete-v6.js'),
    'utf8',
);
const formSource = fs.readFileSync(
    path.join(root, 'competition-record-form-v6.js'),
    'utf8',
);

assert.match(
    indexSource,
    /<th>STT<\/th><th>Học sinh<\/th><th>Điểm tuần<\/th><th>Huy hiệu<\/th>/,
    'Index phải khai báo đúng 4 cột: STT, Học sinh, Điểm tuần, Huy hiệu.',
);

assert.doesNotMatch(
    indexSource,
    /<th>Hạng<\/th><th>Học sinh<\/th><th>Điểm tuần<\/th><th>Điểm tháng<\/th>/,
    'Index không được giữ header ranking legacy 6 cột.',
);

assert.doesNotMatch(
    autocompleteSource,
    /label \? '<label>Học sinh<\/label>'/,
    'Autocomplete không được tự chèn thêm label Học sinh vào field đã có label.',
);

assert.doesNotMatch(
    formSource,
    /id="fWeekV6"/,
    'Form Ghi nhận V6 không được cho người dùng chọn Tuần.',
);

assert.match(
    formSource,
    /getMonday\?\.\(date\)/,
    'Form phải tự suy ra tuần từ Ngày.',
);

console.log('PASS: UI regressions for ranking, student picker, and record form');
