/**
 * FILE: test-center-contract.test.js
 *
 * Regression contract cho Test Center và các module runner.
 * Không ghi database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'test-center-v6.html'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'modules/test-center/test-center-v6.js'), 'utf8');
const groups = fs.readFileSync(path.join(root, 'modules/test-center/test-center-groups-v6.js'), 'utf8');
const controls = fs.readFileSync(path.join(root, 'modules/test-center/test-center-controls-v6.js'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'modules/test-center/test-center-entry-v6.js'), 'utf8');

test('Test Center loads its runner and group modules', () => {
    assert.match(html, /test-center-v6\\.js/);
    assert.match(html, /test-center-groups-v6\\.js/);
    assert.match(html, /test-center-controls-v6\\.js/);
});

test('Test Center contains assertions and grouped execution', () => {
    for (const pattern of [
        /function addTest/,
        /expectEqual/,
        /expectTrue/,
        /runAll/,
        /Calculation/,
        /Rollover/,
        /Supabase read-only/,
    ]) assert.match(runner, pattern);
});

test('Test Center group runner exposes executable API', () => {
    assert.match(groups, /TestCenterGroupsV6\\s*=\\s*Object\\.freeze/);
    for (const name of ['execute', 'getResults']) {
        assert.match(groups, new RegExp(name));
    }
    assert.match(groups, /MutationObserver/);
});

test('Test Center controls provide running feedback', () => {
    assert.match(controls, /Chạy cụm này/);
    assert.match(controls, /Đang chạy/);
    assert.match(controls, /button\\.disabled\\s*=\\s*true/);
});

test('Settings entry opens Test Center', () => {
    assert.match(entry, /testCenterButtonV6/);
    assert.match(entry, /test-center-v6\\.html/);
    assert.match(entry, /window\\.open/);
});
