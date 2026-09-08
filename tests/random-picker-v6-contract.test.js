const { test } = require('node:test');
/**
 * FILE: random-picker-v6-contract.test.js
 *
 * Regression contract cho Gọi tên ngẫu nhiên.
 * Không ghi database.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const picker = fs.readFileSync(path.join(root, 'random-picker-v6-compat.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Random picker supports whole class and all four teams', () => {
    assert.match(picker, /scope === ['"]all['"]/);
    assert.match(picker, /student\\.team/);
    assert.match(index, /id=["']randomScope["']/);
    for (const team of ['team1', 'team2', 'team3', 'team4']) {
        assert.ok(
            index.includes('value="' + team + '"') || index.includes("value='" + team + "'"),
            'Thiếu scope ' + team + '.',
        );
    }
});

test('Random picker avoids recent repeats and safely falls back', () => {
    assert.match(picker, /randomHistory/);
    assert.match(picker, /recentSet/);
    assert.match(picker, /candidates/);
    assert.match(picker, /availablePool/);
});

test('Empty random pool is handled explicitly', () => {
    assert.match(picker, /return null/);
    assert.match(app, /Chưa có học sinh trong phạm vi này/);
});

test('Random history persists and can be cleared', () => {
    assert.match(app, /localStorage\\.setItem\\(['"]s6r['"]/);
    assert.match(app, /localStorage\\.removeItem\\(['"]s6r['"]/);
    assert.match(index, /resetRandomHistory\\(\\)/);
});

test('Random UI exposes running, spinning and winner states', () => {
    for (const pattern of [
        /randomRunning\\s*=\\s*true/,
        /randomButton['"]\\)\\.disabled\\s*=\\s*true/,
        /spinning/,
        /winner/,
        /Đang chọn/,
        /Mời em/,
    ]) assert.match(app, pattern);
});
