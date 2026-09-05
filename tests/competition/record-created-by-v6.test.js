#!/usr/bin/env node
/**
 * FILE: tests/competition/record-created-by-v6.test.js
 *
 * Regression test cho lỗi Ghi nhận thi đua V6:
 * - app.js giữ `currentUser` trong lexical state của Core.
 * - Boundary không được giả định `currentUser` nằm trên globalThis.
 * - Khi form đã điền đủ dữ liệu, boundary phải lấy đúng created_by để
 *   Record Service có thể INSERT competition_records.
 * - Ghi chú phải được truyền nguyên vẹn qua boundary.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-record-write-boundary-v6.js'),
    'utf8',
);

const serviceCalls = [];
const alerts = [];

const context = vm.createContext({
    console,
    window: {},
    alert: (message) => alerts.push(message),
    currentUser: {
        id: 'teacher-1',
    },
    SNCoreSupabase: {
        client: {
            from() {
                return {
                    select() {
                        return this;
                    },
                    eq() {
                        return this;
                    },
                    async single() {
                        return {
                            data: {
                                id: 'criteria-6-1',
                                name: 'Phát biểu xây dựng bài',
                                active: true,
                                category_id: 6,
                            },
                            error: null,
                        };
                    },
                };
            },
        },
    },
    CompetitionRecordServiceV6: {
        async saveCompetitionRecordV6(input) {
            serviceCalls.push(input);
            return {
                ok: true,
            };
        },
    },
});

vm.runInContext(source, context, {
    filename: 'modules/competition/competition-record-write-boundary-v6.js',
});

(async () => {
    const ok = await context.CompetitionRecordWriteBoundaryV6
        .addCompetitionThroughV6Boundary(
            'student-1',
            2,
            'Phát biểu xây dựng bài',
            'Tích cực phát biểu',
            6,
            '2030-01-07',
            '2030-01-09',
        );

    assert.equal(
        ok,
        true,
        'Boundary phải trả về thành công khi dữ liệu hợp lệ.',
    );
    assert.equal(
        serviceCalls.length,
        1,
        'Record Service phải được gọi đúng 1 lần.',
    );
    assert.equal(
        serviceCalls[0].createdBy,
        'teacher-1',
        'created_by phải lấy từ currentUser trong app state, không chỉ từ globalThis.',
    );
    assert.equal(
        serviceCalls[0].note,
        'Tích cực phát biểu',
        'Ghi chú phải được truyền nguyên vẹn tới Record Service.',
    );
    assert.deepEqual(alerts, [], 'Luồng hợp lệ không được báo lỗi.');

    console.log('PASS: competition record created_by and note regression');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
