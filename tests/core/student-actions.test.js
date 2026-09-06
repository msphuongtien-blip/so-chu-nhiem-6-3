const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');

/**
 * FILE: tests/core/student-actions.test.js
 *
 * Mục đích:
 * Kiểm tra hợp đồng dữ liệu của module Xóa học sinh.
 *
 * Test không gọi Supabase thật và không thay đổi database.
 */
function loadModule() {
    const context = {
        console,
        alert: () => {},
        window: {
            confirm: () => true,
        },
        document: {
            readyState: 'loading',
            addEventListener: () => {},
            getElementById: () => null,
        },
        MutationObserver: class {
            observe() {}
        },
    };

    context.globalThis = context;

    vm.runInNewContext(
        fs.readFileSync(
            path.join(projectRoot, 'modules/students/student-actions-v6-final.js'),
            'utf8',
        ),
        context,
        {
            filename: path.join(
                projectRoot,
                'student-actions-v6-final.js',
            ),
        },
    );

    return context.StudentActionsV6;
}

test('dependency check covers all protected student child tables', async () => {
    const studentActions = loadModule();
    const queriedTables = [];

    const client = {
        from(tableName) {
            queriedTables.push(tableName);

            return {
                select() {
                    return {
                        eq: async () => ({
                            count: 0,
                            error: null,
                        }),
                    };
                },
            };
        },
    };

    const counts = await studentActions.getStudentDependencyCounts(
        'test-student-id',
        client,
    );

    const expectedTables = [
        'attendance',
        'competition_data_issues',
        'competition_records',
        'competition_weekly_snapshots',
        'honors',
    ];

    assert.deepEqual(
        Object.keys(counts).sort(),
        expectedTables.sort(),
    );

    assert.deepEqual(
        queriedTables.sort(),
        expectedTables.sort(),
    );
});
