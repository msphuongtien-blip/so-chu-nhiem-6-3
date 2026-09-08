/**
 * FILE: student-auth-actions-contract.test.js
 * Regression contract cho tài khoản học sinh và xóa học sinh.
 * Không gọi Edge Function và không DELETE dữ liệu thật.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const auth = fs.readFileSync(path.join(root, 'modules/students/student-auth-v6.js'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'modules/students/student-actions-v6.js'), 'utf8');
const finalActions = fs.readFileSync(path.join(root, 'modules/students/student-actions-v6-final.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function includes(source, value, message) {
    assert.ok(source.includes(value), message || 'Missing: ' + value);
}

test('Student auth exposes provision/open/reset API', () => {
    for (const value of ['provisionStudentAccounts','openStudentAccountProvisioning','resetStudentAccount']) {
        includes(auth, value);
    }
    includes(auth, 'StudentAuthV6 = Object.freeze');
    for (const value of ['provision:','openProvisioning:','reset:']) includes(auth, value);
});

test('Provisioning requires session token and uses Edge Function POST', () => {
    for (const value of ['provision-student-accounts','sb.auth.getSession()','session?.access_token','Authorization:','method:']) {
        includes(auth, value);
    }
    includes(auth, "'POST'");
});

test('Account provisioning is teacher-only', () => {
    includes(auth, "role !== 'teacher'");
    includes(index, 'StudentAuthV6.openProvisioning()');
});

test('Student deletion checks every protected dependency before DELETE', () => {
    for (const table of ['attendance','competition_records','competition_data_issues','competition_weekly_snapshots','honors']) {
        includes(finalActions, "'" + table + "'");
    }
    for (const value of ['getStudentDependencyCounts','dependencies.length',"from('students')",'.delete()']) {
        includes(finalActions, value);
    }
});

test('Student action failures provide explicit feedback', () => {
    includes(finalActions, 'alert(');
    includes(finalActions, 'Không thể xóa học sinh');
    includes(finalActions, 'console.error');
});

test('Student actions expose stable public API', () => {
    includes(actions, 'window.deleteStudentV6 =');
    includes(actions, 'deleteStudent');
});
