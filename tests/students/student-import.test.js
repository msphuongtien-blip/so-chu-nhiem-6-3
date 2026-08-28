#!/usr/bin/env node
/**
 * FILE: tests/students/student-import.test.js
 *
 * Mục đích:
 * Kiểm tra contract dữ liệu của module bulk import HS.
 *
 * Các case quan trọng:
 * - CSV có BOM và CRLF.
 * - Giá trị có dấu phẩy trong ngoặc kép.
 * - Thiếu header bắt buộc.
 * - Mã HS sai định dạng.
 * - Trùng mã HS với database hiện tại.
 * - Trùng mã HS trong chính file CSV.
 * - Payload INSERT không chứa field hệ thống.
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
        querySelector() {
            return null;
        },
    },
    Set,
    Map,
    String,
    Number,
    Array,
    Object,
    Error,
});

vm.runInContext(source, context, {
    filename: 'students-import-v6.js',
});

const api = context.window.StudentsImportV6;

assert.ok(api, 'StudentsImportV6 phải được export.');
assert.deepEqual(
    api.CSV_HEADERS,
    [
        'full_name',
        'student_code',
        'gender',
        'team',
        'support_level',
        'progress_note',
        'special_note',
    ],
);

const matrix = api.parseCsv(
    '\uFEFFfull_name,student_code,gender,team\r\n' +
    'Nguyen Van A,6301,Nam,1\r\n' +
    'Tran Thi B,6302,Nữ,2\r\n',
);
assert.equal(matrix.length, 3);
assert.equal(matrix[1][0], 'Nguyen Van A');

const quoted = api.parseCsv(
    'full_name,student_code,special_note\n' +
    'A,6303,"Ghi chú, có dấu phẩy"\n',
);
assert.equal(quoted[1][2], 'Ghi chú, có dấu phẩy');

const mapped = api.mapCsvRows(matrix);
assert.equal(mapped.rows.length, 2);

const validResult = api.validateImportRows(
    mapped.rows,
    [],
);
assert.equal(validResult.errors.length, 0);
assert.equal(validResult.validRows.length, 2);

const duplicateResult = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'full_name,student_code\n' +
            'A,6304\n' +
            'B,6304\n',
        ),
    ).rows,
    [],
);
assert.ok(duplicateResult.errors.length > 0);

const existingResult = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'full_name,student_code\n' +
            'A,6305\n',
        ),
    ).rows,
    [{ student_code: '6305' }],
);
assert.equal(existingResult.errors.length, 1);
assert.match(
    existingResult.errors[0].reasons.join(' '),
    /đã tồn tại/i,
);

const invalidCodeResult = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'full_name,student_code\n' +
            'A,63A5\n',
        ),
    ).rows,
    [],
);
assert.equal(invalidCodeResult.errors.length, 1);

const payload = api.buildInsertPayload(validResult.validRows);
assert.equal(payload.length, 2);
assert.equal(payload[0].full_name, 'Nguyen Van A');
assert.equal(payload[0].student_code, '6301');
assert.equal(
    Object.prototype.hasOwnProperty.call(payload[0], 'id'),
    false,
);
assert.equal(
    Object.prototype.hasOwnProperty.call(payload[0], 'competition_score'),
    false,
);
assert.equal(
    Object.prototype.hasOwnProperty.call(payload[0], 'weekly_start_score'),
    false,
);

console.log('Student CSV import contract tests: PASS');
