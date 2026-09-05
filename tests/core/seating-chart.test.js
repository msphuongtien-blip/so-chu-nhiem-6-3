/**
 * FILE: tests/core/seating-chart.test.js
 *
 * Mục đích:
 * Contract/regression test cho module Sơ đồ chỗ ngồi khi tích hợp vào V6.
 *
 * Kiểm tra:
 * - Entry point đăng ký module và navigation đúng vị trí.
 * - Module có 48 ghế, 4 tổ x 12.
 * - Module dùng Supabase client chung và đúng các bảng dữ liệu.
 * - CSS được tách khỏi logic JavaScript.
 * - Không đưa Timi Clock hoặc code seating vào app.js.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const moduleSource = fs.readFileSync(
    'modules/seating-chart.js',
    'utf8',
);
const css = fs.readFileSync(
    'modules/seating-chart.css',
    'utf8',
);

assert.match(index, /modules\/seating-chart\.js/);
assert.match(index, /id="seatingChartNav"/);
assert.match(index, /seatingChartOpen\(\)/);

assert.match(moduleSource, /SEAT_COUNT = 48/);
assert.match(moduleSource, /TEAM_COUNT = 4/);
assert.match(moduleSource, /SEATS_PER_TEAM = 12/);
assert.match(moduleSource, /seating_positions/);
assert.match(moduleSource, /random_pick_history/);
assert.match(moduleSource, /typeof sb !== 'undefined'/);
assert.doesNotMatch(moduleSource, /app\.sb/);

assert.match(css, /\.sc-shell/);
assert.match(css, /\.sc-seat/);
assert.match(css, /\.sc-winner/);

assert.doesNotMatch(app, /function seatingChartOpen/);
assert.doesNotMatch(app, /seating_positions/);

console.log('Seating chart contract test passed.');
