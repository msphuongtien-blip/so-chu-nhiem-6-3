/**
 * FILE: test-center-contract.test.js
 * Regression contract cho Test Center.
 * Không ghi database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'test-center-v6.html'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'modules/test-center/test-center-v6.js'), 'utf8');
const groups = fs.readFileSync(path.join(root, 'modules/test-center/test-center-groups-v6.js'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'modules/test-center/test-center-controls-v6.js'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'modules/test-center/test-center-entry-v6.js'), 'utf8');

function includes(source, value, message) {
    assert.ok(source.includes(value), message || 'Missing: ' + value);
}

test('Test Center loads runner and groups', () => {
    includes(html, 'test-center-v6.js');
    includes(html, 'test-center-groups-v6.js');
    includes(html, 'test-center-groups-shell-v6.js');
    includes(html, 'test-center-competition-live-v6.js');
});

test('Test Center runner has grouped assertions and run-all action', () => {
    for (const value of ['function addTest','expectEqual','expectTrue','runAll','Calculation','Rollover','Supabase read-only']) {
        includes(runner, value);
    }
});

test('Test Center group runner exposes executable API', () => {
    includes(groups, 'TestCenterGroupsV6 = Object.freeze');
    includes(groups, 'execute');
    includes(groups, 'getResults');
    includes(groups, 'MutationObserver');
});

test('Test Center group shell provides the running controls contract', () => {
    includes(controls, 'Chạy cụm này');
    includes(controls, 'Đang chạy');
    includes(controls, 'button.disabled = true');
});

test('Settings entry opens Test Center', () => {
    includes(entry, 'testCenterButtonV6');
    includes(entry, 'test-center-v6.html');
    includes(entry, 'window.open');
});
