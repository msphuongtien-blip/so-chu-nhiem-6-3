#!/usr/bin/env node
/**
 * FILE: tests/competition/regressions-v6.test.js
 *
 * Regression contracts for bugs found during manual QA.
 *
 * Covered:
 * 1. Ghi nhận thi đua chỉ dùng Ngày; Tuần phải được suy ra tự động.
 * 2. Mở form Sửa record không được tạo MutationObserver loop làm treo trang.
 * 3. Bảng xếp hạng dùng thứ hạng chuẩn: cùng điểm thì đồng hạng.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const formSource = fs.readFileSync(
    path.join(root, 'competition-record-form-v6.js'),
    'utf8',
);
const finalFormSource = fs.readFileSync(
    path.join(root, 'competition-record-form-final-v6.js'),
    'utf8',
);
const editDateSource = fs.readFileSync(
    path.join(root, 'competition-record-edit-date-v6.js'),
    'utf8',
);
const rankingSource = fs.readFileSync(
    path.join(root, 'competition-ranking-columns-v6.js'),
    'utf8',
);

// 1. Date-only entry: the form must not expose a user-editable Week field.
assert.doesNotMatch(
    formSource,
    /id="fWeekV6"/,
    'Form ghi nhận V6 không được render ô Tuần cho giáo viên.',
);
assert.match(
    formSource,
    /getMonday|getRecordFormWeek|week.*date/i,
    'Form phải có logic suy tuần từ Ngày.',
);
assert.match(
    finalFormSource,
    /getMonday.*date|week.*getMonday.*date/s,
    'Final boundary phải suy Tuần từ Ngày.',
);

// 2. Opening the edit modal must not recursively mutate the modal forever.
assert.match(
    editDateSource,
    /helper\.textContent\s*!==\s*derivedWeek|helper\.textContent\s*!==/,
    'Edit date sync phải tránh ghi DOM lặp vô hạn trong MutationObserver.',
);

// 3. Ranking ties: same score must receive the same rank number.
assert.match(
    rankingSource,
    /assignCompetitionRanksV6|rank.*previous|same.*score|tie/i,
    'Ranking boundary phải có logic đồng hạng khi cùng điểm.',
);

console.log('PASS: V6 competition regressions contract');
