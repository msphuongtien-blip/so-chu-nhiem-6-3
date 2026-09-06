#!/usr/bin/env node
/**
 * Contract/unit tests for the shared student autocomplete UX.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/students/student-autocomplete-v6.js'),
    'utf8',
);
const loaderSource = fs.readFileSync(
    path.join(root, 'core/module-loader.js'),
    'utf8',
);
const rankingSource = fs.readFileSync(
    path.join(root, 'modules/competition/competition-ranking-columns-v6.js'),
    'utf8',
);

const context = vm.createContext({
    console,
    window: {},
    globalThis: null,
});
context.globalThis = context;

vm.runInContext(source, context, {
    filename: 'student-autocomplete-v6.js',
});

const api = context.StudentAutocompleteV6;
assert.ok(api, 'StudentAutocompleteV6 phải được expose.');

const students = [
    {
        id: 's1',
        user_id: 'u1',
        full_name: 'Bùi Phan Anh Tân',
        student_code: '6301',
        team: 1,
    },
    {
        id: 's2',
        user_id: 'u2',
        full_name: 'Cao Lý Ngọc Khuê',
        student_code: '6302',
        team: 2,
    },
];

assert.deepEqual(
    api.filterStudents(students, 'anh tan').map((s) => s.id),
    ['s1'],
    'Tìm theo tên không dấu phải hoạt động.',
);

assert.deepEqual(
    api.filterStudents(students, '6302').map((s) => s.id),
    ['s2'],
    'Tìm trực tiếp theo Mã HS phải hoạt động.',
);

assert.deepEqual(
    api.filterStudents(students, 'BÙI').map((s) => s.id),
    ['s1'],
    'Tìm tên không phân biệt hoa thường và dấu phải hoạt động.',
);

assert.equal(
    api.resolveStudentValue(students[0], 'id'),
    's1',
    'Các form lưu student_id phải nhận đúng id.',
);

assert.equal(
    api.resolveStudentValue(students[0], 'user_id'),
    'u1',
    'Form tin nhắn phải có thể lưu user_id.',
);

const targetIds = [
    'fStudentV6',
    'fStudent',
    'eStudent',
    'hStudent',
    'dStudent',
    'lStudent',
    'msgStudent',
];

for (const id of targetIds) {
    assert.match(
        source,
        new RegExp(id),
        `Autocomplete phải hỗ trợ field ${id}.`,
    );
}

assert.match(
    source,
    /student\.full_name[\s\S]*student\.student_code/,
    'UI phải tìm được cả họ tên và Mã HS.',
);

assert.doesNotMatch(
    source,
    /<select[\s\S]*Học sinh/,
    'Shared autocomplete không được tạo dropdown 44 học sinh.',
);

assert.match(
    loaderSource,
    /student-autocomplete-v6\.js/,
    'Module autocomplete phải được load trong module-loader.',
);

assert.match(
    rankingSource,
    /Học sinh[\s\S]*Điểm tuần[\s\S]*Huy hiệu/,
    'Ranking boundary phải giữ đúng ba cột UX.',
);

console.log('PASS: student autocomplete supports name/code across student form fields');
