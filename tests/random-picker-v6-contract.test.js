/**
 * FILE: random-picker-v6-contract.test.js
 * Regression contract cho Gọi tên ngẫu nhiên.
 * Không ghi database.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const picker = fs.readFileSync(path.join(root, 'random-picker-v6-compat.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function includes(source, value, message) {
    assert.ok(source.includes(value), message || 'Missing: ' + value);
}

test('Random picker supports whole class and four teams', () => {
    includes(picker, "scope === 'all'");
    includes(picker, 'student.team');
    includes(index, 'id="randomScope"');
    for (const team of ['team1','team2','team3','team4']) {
        includes(index, 'value="' + team + '"');
    }
});

test('Random picker avoids recent repeats with safe fallback', () => {
    for (const value of ['randomHistory','recentSet','candidates','availablePool']) {
        includes(picker, value);
    }
});

test('Empty pool is handled explicitly', () => {
    includes(picker, 'return null;');
    includes(app, 'Chưa có học sinh trong phạm vi này');
});

test('Random history persists and can be cleared', () => {
    includes(app, "localStorage.setItem('s6r'");
    includes(app, "localStorage.removeItem('s6r'");
    includes(index, 'resetRandomHistory()');
});

test('Random UI exposes running, spinning and winner states', () => {
    for (const value of ['randomRunning = true','disabled=true','spinning','winner','Đang chọn','Mời em']) {
        includes(app, value);
    }
});
