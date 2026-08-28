const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');

/**
 * Load student-actions.js with a minimal browser-like environment.
 *
 * No real Supabase request is made by these tests.
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
            path.join(projectRoot, 'modules/student-actions.js'),
            'utf8',
        ),
        context,
        {
            filename: path.join(
                projectRoot,
                'modules/student-actions.js',
            ),
        },
    );

    return context.StudentActionsV6;
}

test('dependency count queries all protected student child tables', async () => {
    const module = loadModule();
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

    const counts = await module.getStudentDependencyCounts(
        'test-student-id',
        client,
    );

    assert.deepEqual(
        Object.keys(counts).sort(),
        [
            'attendance',
            'competition_data_issues',
            'competition_records',
            'competition_weekly_snapshots',
            'discipline_records',
            'honors',
            'learning_records',
        ].sort(),
    );

    assert.deepEqual(
        queriedTables.sort(),
        Object.keys(counts).sort(),
    );

    assert.equal(
        Object.values(counts).every((count) => count === 0),
        true,
    );
});
