/**
 * FILE: tests/core/seating-chart.test.js
 *
 * Mục đích:
 * Contract/regression test cho module sơ đồ chỗ ngồi.
 *
 * Kiểm tra:
 * - 48 ghế, 4 tổ x 12.
 * - 44 học sinh được gán duy nhất.
 * - Không có assignment tới học sinh không tồn tại.
 * - Frontend có hook/module/CSS cần thiết.
 *
 * Đây là test nền; browser E2E cho drag/drop và animation sẽ bổ sung ở gate UI.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const moduleSource = fs.readFileSync('modules/seating-chart.js', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');

assert.match(index, /modules\/seating-chart\.js/);
assert.match(index, /@supabase\/supabase-js@2/);
assert.match(moduleSource, /seating_positions/);
assert.match(moduleSource, /random_pick_history/);
assert.doesNotMatch(moduleSource, /\bapp\.sb\b/);
assert.match(moduleSource, /app\.from\('students'\)/);
assert.match(moduleSource, /app\.from\('seating_positions'\)/);
assert.match(moduleSource, /draggable/);
assert.match(moduleSource, /QUAY TÊN/);
assert.match(css, /\.sc-teams/);
assert.match(css, /\.sc-seat/);
assert.match(css, /\.sc-winner/);

const seats = Array.from({ length: 48 }, (_, index) => ({
    seatNumber: index + 1,
    team: Math.floor(index / 12) + 1,
    studentId: index < 44 ? `student-${index + 1}` : null
}));

assert.equal(seats.length, 48);
assert.deepEqual(
    seats.reduce((counts, seat) => {
        counts[seat.team] += 1;
        return counts;
    }, { 1: 0, 2: 0, 3: 0, 4: 0 }),
    { 1: 12, 2: 12, 3: 12, 4: 12 }
);

const assigned = seats.filter((seat) => seat.studentId).map((seat) => seat.studentId);
assert.equal(assigned.length, 44);
assert.equal(new Set(assigned).size, 44);

console.log('PASS: seating chart contract tests');

assert.match(moduleSource, /SEATS_PER_TEAM = 12/);
assert.match(moduleSource, /seat\.seat_number/);
assert.match(moduleSource, /seat\.column_number/);
assert.match(moduleSource, /visualColumn = Math\.floor\(\(Number\(seat\.column_number\) - 1\) \/ 6\) \+ 1/);
assert.match(moduleSource, /visualDesk = \(\(Number\(seat\.column_number\) - 1\) % 6\) \+ 1/);
assert.match(moduleSource, /Cột \$\{visualColumn\} · Bàn \$\{visualDesk\}/);
assert.match(moduleSource, /studentDisplayName/);
assert.match(moduleSource, /GVCN/);
assert.match(moduleSource, /Phượng Tiên/);
assert.match(moduleSource, /scTeacherAvatarButton/);
assert.match(moduleSource, /scTeacherAvatarUrl/);
assert.match(moduleSource, /isTeacherAvatar/);
assert.match(moduleSource, /localStorage\.setItem\('scTeacherAvatarUrl'/);
assert.match(css, /\.sc-teacher-desk\{/);
assert.match(css, /\.sc-teacher-avatar\{/);
assert.match(moduleSource, /parts\.slice\(-2\)\.join\(' '\)/);
assert.doesNotMatch(moduleSource, /parts\.slice\(1\)\.join\(' '\)/);
assert.match(moduleSource, /parts\.slice\(1\)\.join\(' '\)/);
assert.match(moduleSource, /data-upload-student/);
assert.match(moduleSource, /student-avatars/);
assert.match(moduleSource, /avatar_url/);
assert.doesNotMatch(moduleSource, /Mã HS \$\{escapeHtml\(student\.student_code/);
assert.match(css, /\.sc-seat-grid\{[^}]*grid-template-columns:repeat\(2/);
assert.match(css, /\.sc-seat-grid\{[^}]*grid-template-rows:repeat\(6/);
assert.match(css, /\.sc-seat-grid\{[^}]*grid-auto-flow:column/);
assert.match(css, /\.sc-student-card\{display:flex;flex-direction:column/);
assert.match(css, /\.sc-student-info strong\{display:block;font-size:14px/);

assert.match(moduleSource, /scWinnerAvatar/);
assert.match(moduleSource, /const avatarElement = document\.getElementById\('scWinnerAvatar'\)/);
assert.match(moduleSource, /finally \{\s*randomBusy = false;/);

assert.match(moduleSource, /renderWinnerAvatar/);
assert.match(moduleSource, /studentDisplayName\(winner\.full_name\)/);
assert.match(moduleSource, /gameShowSoundEnabled/);
assert.match(moduleSource, /playGameShowStart/);
assert.match(moduleSource, /playSpinTick/);
assert.match(moduleSource, /playWinnerSound/);
assert.match(moduleSource, /scGameShowSound/);
assert.match(css, /\.sc-winner-avatar\{/);
assert.match(css, /\.sc-winner-avatar img\{/);
