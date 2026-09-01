#!/usr/bin/env node
/**
 * FILE: tests/students-import-contract.test.js
 *
 * Mục đích:
 * Kiểm tra contract chính thức của CSV Import HS.
 *
 * Import chỉ nhận:
 * - Họ tên (bắt buộc)
 * - Giới tính (tùy chọn)
 * - Ghi chú (tùy chọn)
 *
 * STT, Mã HS, Tổ, Thi đua và Mức hỗ trợ không thuộc file import.
 * Mã HS được sinh bởi hệ thống; Mức hỗ trợ dùng default "Không" của database.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'students-import-v6.js');
const indexPath = path.join(root, 'index.html');
const source = fs.readFileSync(modulePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');

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

const expectedHeaders = [
    'Họ tên',
    'Giới tính',
    'Ghi chú',
];

assert.deepEqual(
    Array.from(api.CSV_HEADERS),
    expectedHeaders,
    'CSV Import phải chỉ có 3 cột hồ sơ thiết yếu.',
);

const template = api.createTemplateCsv();
const templateHeader = template
    .replace(/^\uFEFF/, '')
    .split('\n')[0];

assert.equal(
    templateHeader,
    expectedHeaders.join(','),
    'Template Import phải dùng đúng 3 cột chính thức.',
);

const forbiddenHeaders = [
    'STT',
    'Mã HS',
    'Tổ',
    'Thi đua',
    'Mức hỗ trợ',
];

for (const header of forbiddenHeaders) {
    assert.equal(
        templateHeader.includes(header),
        false,
        `Template Import không được yêu cầu nhập: ${header}`,
    );
}

const matrix = api.parseCsv(
    '\uFEFFHọ tên,Giới tính,Ghi chú\r\n' +
    'Nguyễn Văn A,Nam,"Ghi chú, có dấu phẩy"\r\n' +
    'Trần Thị B,Nữ,\r\n',
);

assert.equal(matrix.length, 3);
assert.equal(matrix[1][2], 'Ghi chú, có dấu phẩy');

const mapped = api.mapCsvRows(matrix);
assert.equal(mapped.rows.length, 2);

const valid = api.validateImportRows(mapped.rows);
assert.equal(valid.errors.length, 0);
assert.equal(valid.validRows.length, 2);

const invalidName = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'Họ tên,Giới tính,Ghi chú\n' +
            ',Nam,Test\n',
        ),
    ).rows,
);

assert.equal(invalidName.errors.length, 1);
assert.match(
    invalidName.errors[0].reasons.join(' '),
    /họ tên/i,
);

const invalidGender = api.validateImportRows(
    api.mapCsvRows(
        api.parseCsv(
            'Họ tên,Giới tính,Ghi chú\n' +
            'Test,T,\n',
        ),
    ).rows,
);

assert.equal(invalidGender.errors.length, 1);
assert.match(
    invalidGender.errors[0].reasons.join(' '),
    /Giới tính/i,
);

const generatedCodes = api.generateStudentCodes(
    2,
    [
        { student_code: '6343' },
        { student_code: '6344' },
    ],
    '6/3',
);

assert.deepEqual(
    Array.from(generatedCodes),
    ['6345', '6346'],
    'Mã HS phải được sinh theo đúng rule của form thêm 1 HS.',
);

const payload = api.buildInsertPayload(
    [
        {
            full_name: 'Nguyễn Văn Test',
        },
        {
            full_name: 'Trần Thị Test',
            gender: 'Nữ',
            special_note: 'Theo dõi',
        },
    ],
    ['6345', '6346'],
);

assert.deepEqual(
    JSON.parse(JSON.stringify(payload[0])),
    {
        full_name: 'Nguyễn Văn Test',
        student_code: '6345',
    },
    'Field trống phải được loại khỏi payload.',
);

assert.deepEqual(
    JSON.parse(JSON.stringify(payload[1])),
    {
        full_name: 'Trần Thị Test',
        student_code: '6346',
        gender: 'Nữ',
        special_note: 'Theo dõi',
    },
);

for (const forbiddenField of [
    'team',
    'competition_score',
    'weekly_start_score',
    'support_level',
]) {
    assert.equal(
        Object.prototype.hasOwnProperty.call(payload[0], forbiddenField),
        false,
        `Payload Import không được chứa field: ${forbiddenField}`,
    );
}

/**
 * Regression guard cho integration point:
 * index.html phải load đúng module Import 3 cột.
 */
assert.match(
    indexSource,
    /students-import-v6\.js/,
    'index.html phải nạp module students-import-v6.js',
);

assert.doesNotMatch(
    indexSource,
    /students-import-v6-8col\.js/,
    'index.html không được nạp lại module CSV 8 cột legacy',
);

console.log('PASS: students CSV import contract');
