const { test } = require('node:test');
/**
 * FILE: application-feature-contract.test.js
 *
 * Regression contract cho các module ứng dụng chưa có test riêng.
 * Chỉ đọc source, không mutation database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function fn(name) {
    assert.match(
        app,
        new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('),
        'Thiếu function ' + name + '().',
    );
}

function page(id) {
    assert.ok(
        index.includes('id="' + id + '"') || index.includes("id='" + id + "'"),
        'Thiếu page #' + id + '.',
    );
}

test('Teacher application pages exist', () => {
    for (const id of [
        'dashboard', 'students', 'random', 'attendance', 'competition',
        'honors', 'teams', 'reports', 'alerts', 'settings',
    ]) page(id);
});

test('Student application pages exist', () => {
    for (const id of ['sHome', 'sProfile', 'sProgress', 'sHonors', 'sGoals']) page(id);
});

test('Authentication/session lifecycle is present', () => {
    for (const name of ['setRole', 'login', 'logout', 'startSession']) fn(name);
    assert.match(app, /profiles/);
    assert.match(app, /sb\\.auth\\.signOut\\(\\)/);
});

test('Attendance covers all supported states and persists with upsert', () => {
    fn('renderAttendance');
    fn('saveAttendance');
    for (const status of ['present', 'excused', 'absent', 'late', 'early_leave']) {
        assert.ok(
            app.includes('value="' + status + '"') || app.includes("value='" + status + "'"),
            'Thiếu status ' + status + '.',
        );
    }
    assert.match(app, /from\\(["']attendance["']\\)/);
    assert.match(app, /upsert\\(/);
});

test('Honors supports week/month and save flow', () => {
    for (const name of ['renderHonors', 'openHonorForm', 'submitHonor']) fn(name);
    assert.match(index, /id=["']honorPeriod["']/);
    assert.match(app, /value=["']week["']/);
    assert.match(app, /value=["']month["']/);
    assert.match(app, /from\\(["']honors["']\\)/);
});

test('Team tracking ranks four teams by average score', () => {
    fn('renderTeams');
    assert.match(app, /Number\\(s\\.team\\)===t/);
    assert.match(app, /b\\.avg-a\\.avg/);
    page('teams');
});

test('Alerts and reports have dedicated renderers and data sources', () => {
    fn('renderAlerts');
    fn('renderReports');
    fn('printReport');
    for (const table of ['attendance', 'competition_records', 'honors']) {
        assert.match(app, new RegExp('from\\(["\\']' + table + '["\\']\\)'));
    }
    page('alerts');
    page('reports');
});

test('Class settings has load/edit/save flow', () => {
    for (const name of ['loadSettings', 'openClassSettings', 'saveClassSettings']) fn(name);
    for (const id of ['classNameInput', 'schoolYearInput', 'teacherNameInput']) page(id);
    assert.match(app, /class_settings/);
});

test('Student-side progress, honors and goals flows exist', () => {
    for (const name of ['renderStudentAll', 'renderStudentHonors', 'renderGoals', 'saveGoal']) fn(name);
    for (const table of ['student_goals', 'honors']) {
        assert.match(app, new RegExp('from\\(["\\']' + table + '["\\']\\)'));
    }
});
