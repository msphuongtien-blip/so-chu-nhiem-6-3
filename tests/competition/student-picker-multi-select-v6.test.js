/**
 * FILE: student-picker-multi-select-v6.test.js
 *
 * Regression/unit tests cho picker nhiều học sinh của Ghi nhận V6.
 * Không ghi dữ liệu.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-record-student-picker-v6.js'),
    'utf8',
);

const context = vm.createContext({
    console,
    window: {},
    document: {},
    setTimeout,
    setInterval,
    clearInterval,
    Date,
});
context.window.setInterval = setInterval;
context.window.clearInterval = clearInterval;
context.window.setTimeout = setTimeout;
context.globalThis = context;

vm.runInContext(source, context, {
    filename: 'competition-record-student-picker-v6.js',
});

const api = context.window.CompetitionStudentPickerV6;
assert.ok(api, 'Picker API phải được expose.');

const students = [
    { id: 's1', full_name: 'Bùi Phan Anh Tân', student_code: '6301', team: 1 },
    { id: 's2', full_name: 'Cao Lý Ngọc Khuê', student_code: '6302', team: 2 },
    { id: 's3', full_name: 'Nguyễn Minh Anh', student_code: '6303', team: 3 },
];

assert.deepEqual(
    api.filterStudentsForPickerV6(students, 'anh').map((student) => student.id),
    ['s1', 's3'],
);

assert.deepEqual(
    api.filterStudentsForPickerV6(students, '6302').map((student) => student.id),
    ['s2'],
);

assert.match(source, /selectedStudentPickerIdsV6 = new Set/);
assert.match(source, /getSelectedStudentPickerIdsV6/);
assert.match(source, /studentPickerSelectedV6/);
assert.match(source, /data-remove-student-picker-id/);
assert.match(source, /data-student-picker-id/);
assert.match(source, /aria-pressed/);
assert.match(source, /data-multi-select="true"/);

console.log('PASS: Competition Record V6 multi-student picker contract');
