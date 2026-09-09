/**
 * FILE: shared-services-contract.test.js
 *
 * Contract tests cho các entry point dùng chung của Core.
 * Không đọc/ghi database.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

test('Shared notification service exposes toast and loading entry points', () => {
    const source = read('core/notification.js');

    assert.match(source, /function showNotification/);
    assert.match(source, /function showLoading/);
    assert.match(source, /globalThis\.SNNotification/);
    assert.match(source, /success:/);
    assert.match(source, /error:/);
});

test('Shared data access owns students and competition record reads', () => {
    const source = read('core/data-access-v6.js');

    assert.match(source, /async function fetchStudentsV6/);
    assert.match(source, /async function fetchCompetitionRecordsV6/);
    assert.match(source, /globalThis\.SNCoreData/);
    assert.match(source, /from\('students'\)/);
    assert.match(source, /from\('competition_records'\)/);
});

test('Shared refresh workflow is the single core refresh entry point', () => {
    const source = read('core/refresh-workflow-v6.js');

    assert.match(source, /async function refreshCoreDataV6/);
    assert.match(source, /SNCoreData\.students\(\)/);
    assert.match(source, /SNCoreData\.competitionRecords\(\)/);
    assert.match(source, /globalThis\.SNCoreRefresh/);
});
