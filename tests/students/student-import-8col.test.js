#!/usr/bin/env node
/**
 * FILE: tests/students/student-import-8col.test.js
 *
 * Mục đích:
 * Kiểm tra contract của CSV 8 cột legacy đang dùng trong website.
 *
 * Đây là regression guard cho module cũ; không mở rộng thêm field mới.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'students-import-v6-8col.js'),
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
    filename: 'students-import-v6-8col.js',
});

const api = context.window.StudentsImportV6;

assert.ok(api, 'StudentsImportV6 phải được export.');
assert.deepEqual(
    Array.from(api.CSV_HEADERS),
    [
        'STT',
        'Họ tên',
        'Mã HS',
        'Giới tính',
        'Tổ',
        'Thi đua',
        'Mức hỗ trợ',
        'Ghi chú',
    ],
);

const csv = [
    'STT,Họ tên,Mã HS,Giới tính,Tổ,Thi đua,Mức hỗ trợ,Ghi chú',
    '1,Nguyễn Văn A,6301,Nam,1,81,Không,"Ghi chú, test"',
    '2,Trần Thị B,6302,Nữ,Tổ 2,81,Cần hỗ trợ,""',
].join('\r\n');

const mapped = api.mapCsvRows(api.parseCsv(csv));
assert.equal(mapped.rows.length, 2);
assert.equal(mapped.rows[0]['Họ tên'], 'Nguyễn Văn A');
assert.equal(mapped.rows[0]['Thi đua'], '81');
assert.equal(mapped.rows[0]['Ghi chú'], 'Ghi chú, test');

const validation = api.validateImportRows(mapped.rows, []);
assert.equal(validation.errors.length, 0);
assert.equal(validation.validRows.length, 2);

const payload = api.buildInsertPayload(validation.validRows);
assert.equal(payload.length, 2);
assert.equal(payload[0].full_name, 'Nguyễn Văn A');
assert.equal(payload[0].student_code, '6301');
assert.equal(payload[0].special_note, 'Ghi chú, test');
assert.equal(Object.prototype.hasOwnProperty.call(payload[0], 'id'), false);
assert.equal(
    Object.prototype.hasOwnProperty.call(payload[0], 'competition_score'),
    false,
);

const duplicate = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'STT,Họ tên,Mã HS,Giới tính,Tổ,Thi đua,Mức hỗ trợ,Ghi chú\n' +
            '1,A,6303,Nam,1,81,Không,\n' +
            '2,B,6303,Nữ,2,81,Không,',
        ),
    ).rows,
    [],
);
assert.equal(duplicate.errors.length, 1);

const existing = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'STT,Họ tên,Mã HS,Giới tính,Tổ,Thi đua,Mức hỗ trợ,Ghi chú\n' +
            '1,C,6304,Nam,1,81,Không,',
        ),
    ).rows,
    [{ student_code: '6304' }],
);
assert.equal(existing.errors.length, 1);
assert.match(
    existing.errors[0].reasons.join(' '),
    /đã tồn tại/i,
);

assert.equal(
    api.createTemplateCsv()
        .replace(/^\uFEFF/, '')
        .trim(),
    Array.from(api.CSV_HEADERS).join(','),
);

console.log('Student CSV 8-column contract tests: PASS');
