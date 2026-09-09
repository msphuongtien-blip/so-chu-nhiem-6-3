/**
 * FILE: application-feature-contract.test.js
 * Regression contract cho các chức năng ứng dụng chưa có test riêng.
 * Chỉ đọc source, không mutation database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function includes(source, value, message) {
    assert.ok(source.includes(value), message || 'Missing: ' + value);
}

test('Teacher pages exist', () => {
    for (const id of ['dashboard','students','random','competition','honors','teams','reports','alerts','settings']) {
        includes(index, 'id="' + id + '"');
    }
});

test('Student pages exist', () => {
    for (const id of ['sHome','sProfile','sProgress','sHonors','sGoals']) {
        includes(index, 'id="' + id + '"');
    }
});

test('Authentication lifecycle exists', () => {
    for (const name of ['setRole','login','logout','startSession']) {
        includes(app, 'function ' + name + '(');
    }
    includes(app, 'profiles');
    includes(app, 'sb.auth.signOut()');
});

test('Honors supports period selection and save flow', () => {
    for (const name of ['renderHonors','openHonorForm','editHonor','submitHonor','submitHonorEdit','deleteHonor']) {
        includes(app, 'function ' + name + '(');
    }
    includes(index, 'id="honorPeriod"');
    includes(index, 'value="week"');
    includes(index, 'value="month"');
    includes(app, "from('honors')");
    includes(index, 'id="honorList"');
    includes(index, 'Thêm thành tích');
    includes(app, 'onclick="editHonor(');
    includes(app, 'onclick="deleteHonor(');
});

test('Team tracking ranks by average score', () => {
    includes(app, 'function renderTeams(');
    includes(app, 'Number(s.team)===t');
    includes(app, 'b.avg-a.avg');
    includes(index, 'id="teamsBody"');
});

test('Alerts and reports have renderers and data sources', () => {
    includes(app, 'function renderAlerts(');
    includes(app, 'function renderReports(');
    for (const table of ['competition_records','honors']) {
        includes(app, "from('" + table + "')");
    }
    assert.doesNotMatch(app, /from\(['"]attendance['"]\)/);
    assert.doesNotMatch(index, /id="attendance"/);
    includes(index, 'id="reportsBody"');
    includes(index, 'id="alertsBody"');
});

test('Class settings has load, edit and save flow', () => {
    for (const name of ['loadSettings','openClassSettings','saveClassSettings']) {
        includes(app, 'function ' + name + '(');
    }
    for (const id of ['classNameInput','schoolYearInput','teacherNameInput']) {
        includes(index, 'id="' + id + '"');
    }
    includes(app, 'class_settings');
});

test('Student progress, honors and goals flows exist', () => {
    for (const name of ['renderStudentAll','renderStudentHonors','renderGoals','saveGoal']) {
        includes(app, 'function ' + name + '(');
    }
    includes(app, "from('student_goals')");
});
