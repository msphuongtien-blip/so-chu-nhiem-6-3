/**
 * TEST: students-import-contract.test.js
 *
 * Mục đích:
 * Kiểm tra contract của template CSV trước khi triển khai parser/import.
 *
 * Các field hệ thống như `id`, `competition_score` và timestamp không được
 * yêu cầu giáo viên nhập thủ công.
 */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const modulePath = require('path').join(
    __dirname,
    '../../students-import-v6.js',
);

const context = {
    window: {},
    document: {
        readyState: 'loading',
        addEventListener() {},
        createElement: () => ({
            click() {},
        }),
        body: {
            appendChild() {},
        },
    },
    Blob,
    URL: {
        createObjectURL: () => 'blob:url',
        revokeObjectURL() {},
    },
};

context.globalThis = context;
context.window = context;

const code = fs.readFileSync(modulePath, 'utf8');
vm.runInNewContext(code, context);

assert.ok(
    context.StudentsImportV6,
    'StudentsImportV6 module must be available',
);

const expectedHeaders = [
    'full_name',
    'student_code',
    'gender',
    'team',
    'support_level',
    'progress_note',
    'special_note',
];

assert.deepStrictEqual(
    Array.from(context.StudentsImportV6.CSV_HEADERS),
    expectedHeaders,
    'CSV template must expose only importable student profile fields',
);

const template = context.StudentsImportV6.createTemplateCsv();

assert.ok(
    template.startsWith(expectedHeaders.join(',')),
    'template must start with the exact CSV header order',
);

const forbiddenHeaders = [
    'id',
    'user_id',
    'competition_score',
    'attendance_percent',
    'weekly_start_score',
    'competition_week_start',
    'created_at',
    'updated_at',
];

for (const header of forbiddenHeaders) {
    assert.ok(
        !template.split('\n')[0].split(',').includes(header),
        `template must not ask teacher to enter system field: ${header}`,
    );
}

console.log('PASS: students import contract');
