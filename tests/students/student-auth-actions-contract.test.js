const { test } = require('node:test');
/**
 * FILE: student-auth-actions-contract.test.js
 *
 * Regression contract cho cấp/reset tài khoản và xóa học sinh.
 * Không gọi Edge Function và không DELETE dữ liệu thật.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const auth = fs.readFileSync(path.join(root, 'modules/students/student-auth-v6.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'modules/students/student-actions-v6.js'), 'utf8');
const finalActions = fs.readFileSync(path.join(root, 'modules/students/student-actions-v6-final.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Student auth exposes provision/open/reset API', () => {
    for (const name of [
        'provisionStudentAccounts',
        'openStudentAccountProvisioning',
        'resetStudentAccount',
    ]) assert.match(auth, new RegExp(name));
    assert.match(auth, /StudentAuthV6\\s*=\\s*Object\\.freeze/);
    for (const name of ['provision', 'openProvisioning', 'reset']) {
        assert.match(auth, new RegExp(name + '\\s*:'));
    }
});

test('Provisioning is authenticated and server-side', () => {
    assert.match(auth, /provision-student-accounts/);
    assert.match(auth, /sb\\.auth\\.getSession\\(\\)/);
    assert.match(auth, /session\\?\\.access_token/);
    assert.match(auth, /Authorization:/);
    assert.match(auth, /method:\\s*['"]POST['"]/);
});

test('Provisioning and reset are teacher-only', () => {
    assert.match(auth, /role !== ['"]teacher['"]/);
    assert.match(index, /StudentAuthV6\\.openProvisioning\\(\\)/);
});

test('Student deletion guards every protected dependency', () => {
    for (const table of [
        'attendance',
        'competition_records',
        'competition_data_issues',
        'competition_weekly_snapshots',
        'honors',
    ]) assert.ok(
        finalActions.includes("'" + table + "'") || finalActions.includes('"' + table + '"'),
        'Thiếu dependency ' + table + '.',
    );
    assert.match(finalActions, /getStudentDependencyCounts/);
    assert.match(finalActions, /dependencies\\.length/);
    assert.match(finalActions, /from\\(["']students["']\\)/);
    assert.match(finalActions, /\\.delete\\(\\)/);
});

test('Student action failures are surfaced to the user', () => {
    assert.match(finalActions, /alert\\(/);
    assert.match(finalActions, /Không thể xóa học sinh/);
    assert.match(finalActions, /console\\.error/);
});

test('Student actions expose a stable public API', () => {
    assert.match(actions, /StudentActionsV6\\s*=\\s*Object\\.freeze/);
    assert.match(actions, /deleteStudent/);
});
