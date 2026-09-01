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
const finalFormSource = fs.readFileSync(
    path.join(root, 'competition-record-form-final-v6.js'),
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

assert.match(
    finalFormSource,
    /removeCompetitionWeekFieldFinalV6[\s\S]*fWeekV6[\s\S]*remove/,
    'Boundary cuối phải loại field Tuần khỏi form.',
);

assert.match(
    finalFormSource,
    /const date = document\.getElementById\('fDateV6'\)\?\.value/,
    'Submit phải lấy Ngày do người dùng chọn.',
);

assert.match(
    finalFormSource,
    /getMonday\?\.\(date\)/,
    'Tuần phải tự suy ra từ Ngày.',
);

assert.match(
    finalFormSource,
    /globalThis\.submitCompetitionV6 = submitCompetitionFinalV6/,
    'Boundary cuối phải khóa submit handler V6, tránh bị legacy ghi đè.',
);

assert.match(
    indexSource,
    /<section id="messagesTeacher"[\s\S]*<\/div><\/section>/,
    'Index phải giữ cấu trúc đóng đầy đủ cho section Tin nhắn.',
);

console.log('PASS: UI regressions for ranking, student picker, and record form');
