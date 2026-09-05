#!/usr/bin/env node
/** Regression tests for V6 ranking, student picker, and record form UI. */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const rawIndexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const indexSource = rawIndexSource.replace(/\s+/g, ' ');
const autocompleteSource = fs.readFileSync(path.join(root, 'student-autocomplete-v6.js'), 'utf8');
const finalFormSource = fs.readFileSync(path.join(root, 'competition-record-form-final-v6.js'), 'utf8');
const rankingColumnsSource = fs.readFileSync(path.join(root, 'competition-ranking-columns-v6.js'), 'utf8');

const rankingHeaderMatch = rankingColumnsSource.match(
    /RANKING_ALLOWED_HEADERS_V6\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/,
);
assert.ok(rankingHeaderMatch, 'Ranking V6 phải định nghĩa danh sách cột được phép.');
assert.match(
    rankingHeaderMatch[1],
    /'Hạng'\s*,\s*'Học sinh'\s*,\s*'Điểm tuần'\s*,\s*'Huy hiệu'/,
    'Ranking V6 phải định nghĩa đúng 4 cột.',
);
assert.doesNotMatch(rankingHeaderMatch[1], /Điểm tháng|Xu hướng|Nhóm/);
assert.doesNotMatch(autocompleteSource, /label \? '<label>Học sinh<\/label>'/);
assert.match(finalFormSource, /removeCompetitionWeekFieldFinalV6[\s\S]*fWeekV6[\s\S]*remove/);
assert.match(finalFormSource, /const date = document\.getElementById\('fDateV6'\)\?\.value/);
assert.match(finalFormSource, /getMonday\?\.\(date\)/);
assert.match(finalFormSource, /globalThis\.submitCompetitionV6 = submitCompetitionFinalV6/);
assert.match(finalFormSource, /function removeDuplicateCompetitionFormCloseButtonV6[\s\S]*Đóng[\s\S]*remove\(\)/);
assert.match(finalFormSource, /submitCompetitionFinalV6[\s\S]*waitForCompetitionWriteBoundaryV6[\s\S]*writeBoundary\(/);
assert.match(finalFormSource, /resolveStudentIdFromCompetitionFormV6[\s\S]*fStudentV6DisplayV6[\s\S]*student_code/);

console.log('PASS: UI regressions for ranking, student picker, and record form');
