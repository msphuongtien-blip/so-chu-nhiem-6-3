#!/usr/bin/env node
/**
 * FILE: tests/competition/calculation-runtime-v6.test.js
 *
 * Mục đích:
 * Regression test cho lớp runtime nối calculation engine với renderer.
 *
 * Bug đã phát hiện:
 * - Runtime đọc CONFIG.OFFICIAL_FIRST_WEEK.
 * - Calculation engine V6 hiện không khai báo field này.
 * - Khi field là undefined, filter `week >= undefined` loại toàn bộ history.
 * - Kết quả: hồ sơ học sinh vẫn có điểm do database trigger, nhưng bảng
 *   xếp hạng và lịch sử Thi đua không thấy record mới.
 *
 * Contract:
 * - Nếu official first week chưa được cấu hình, runtime phải giữ nguyên
 *   toàn bộ records để renderer có thể đọc lịch sử thật.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-calculation-v6.js'),
    'utf8',
);

const record = {
    student_id: 'student-1',
    week: '2026-08-31',
    date: '2026-09-01',
    score: 2,
};

const context = vm.createContext({
    console,
    supabaseCache: {
        competitionRecords: [record],
    },
    window: {
        setInterval() {
            return 1;
        },
        clearInterval() {},
    },
});

vm.runInContext(source, context, {
    filename: 'competition-calculation-v6.js',
});

assert.equal(
    typeof context.getCalculationRecordsForWeekV6,
    'function',
    'Runtime phải expose helper lọc records để regression test được.',
);

context.CompetitionCalculationV6 = {
    getMonday(value) {
        return value;
    },
    isOfficialWeek() {
        return true;
    },
    CONFIG: {},
};

const records = context.getCalculationRecordsForWeekV6('2026-08-31');

assert.deepEqual(
    JSON.parse(JSON.stringify(records)),
    [record],
    'Không được loại toàn bộ history khi OFFICIAL_FIRST_WEEK chưa tồn tại.',
);

console.log('PASS: calculation runtime preserves records without official first week');
