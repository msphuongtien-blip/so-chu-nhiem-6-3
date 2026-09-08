/**
 * FILE: student-picker-multi-select-v6.test.js
 *
 * Regression contract cho API chọn nhiều HS của Ghi nhận V6.
 * Không ghi dữ liệu.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-record-student-picker-v6.js'),
    'utf8',
);

assert.match(source, /function getCompetitionRecordSelectedStudentsV6\(\)/);
assert.match(source, /function syncStudentPickerSelectionV6\(\)/);
assert.match(source, /getSelectedStudentPickerIdsV6\(\)/);
assert.match(source, /window\.CompetitionStudentPickerV6 =/);
assert.match(source, /getCompetitionRecordSelectedStudentsV6/);

console.log('PASS: shared competition student selection API');
