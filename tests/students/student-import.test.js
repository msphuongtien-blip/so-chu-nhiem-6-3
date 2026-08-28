#!/usr/bin/env node
/**
 * FILE: tests/students/student-import.test.js
 *
 * Mục đích:
 * Regression tests cho parser, validation, sinh Mã HS và payload Import CSV.
 *
 * Contract:
 * - CSV Import chỉ có Họ tên, Giới tính, Ghi chú.
 * - Họ tên bắt buộc.
 * - Giới tính/Ghi chú tùy chọn.
 * - Mã HS do hệ thống sinh.
 * - Mức hỗ trợ dùng default "Không" của database.
 * - Field tùy chọn để trống không được gửi vào payload.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'students-import-v6.js'),
    'utf8',
);

const context = vm.createContext({
    console,
    window: {},
    document: {
        readyState: 'loading',
        addEventListener() {},
        createElement() {
            return {
                click() {},
            };
        },
        body: {
            appendChild() {},
        },
    },
    Blob,
    URL: {
        createObjectURL() {
            return 'blob:url';
        },
        revokeObjectURL() {},
    },
});

vm.runInContext(source, context, {
    filename: 'students-import-v6.js',
});

const api = context.window.StudentsImportV6;

assert.ok(api, 'StudentsImportV6 phải được export.');

assert.deepEqual(
    Array.from(api.CSV_HEADERS),
    ['Họ tên', 'Giới tính', 'Ghi chú'],
);

const csv =
    '\uFEFFHọ tên,Giới tính,Ghi chú\r\n' +
    'Nguyễn Văn A,Nam,"Ghi chú, có dấu phẩy"\r\n' +
    'Trần Thị B,Nữ,\r\n';

const matrix = api.parseCsv(csv);
assert.equal(matrix.length, 3);
assert.equal(matrix[1][2], 'Ghi chú, có dấu phẩy');

const mapped = api.mapCsvRows(matrix);
assert.equal(mapped.rows.length, 2);

const validation = api.validateImportRows(mapped.rows);
assert.equal(validation.errors.length, 0);
assert.equal(validation.validRows.length, 2);

const missingName = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'Họ tên,Giới tính,Ghi chú\n' +
            ',Nam,Test\n',
        ),
    ).rows,
);
assert.equal(missingName.errors.length, 1);

const invalidGender = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'Họ tên,Giới tính,Ghi chú\n' +
            'Test,Khác Giới,\n',
        ),
    ).rows,
);
assert.equal(invalidGender.errors.length, 1);

assert.equal(
    api.getStudentCodePrefix('6/3'),
    '63',
);

assert.deepEqual(
    api.generateStudentCodes(
        3,
        [
            { student_code: '6301' },
            { student_code: '6344' },
        ],
        '6/3',
    ),
    ['6345', '6346', '6347'],
);

const payload = api.buildInsertPayload(
    validation.validRows,
    ['6345', '6346'],
);

assert.equal(payload.length, 2);
assert.deepEqual(
    payload[0],
    {
        full_name: 'Nguyễn Văn A',
        student_code: '6345',
        gender: 'Nam',
        special_note: 'Ghi chú, có dấu phẩy',
    },
);

const minimalPayload = api.buildInsertPayload(
    [{
        full_name: 'HS Không Có Trường Tùy Chọn',
    }],
    ['6347'],
);

assert.deepEqual(
    minimalPayload[0],
    {
        full_name: 'HS Không Có Trường Tùy Chọn',
        student_code: '6347',
    },
);

for (const forbiddenField of [
    'team',
    'competition_score',
    'weekly_start_score',
    'attendance_percent',
    'support_level',
]) {
    assert.equal(
        Object.prototype.hasOwnProperty.call(
            minimalPayload[0],
            forbiddenField,
        ),
        false,
    );
}

console.log('PASS: student CSV import tests');
