#!/usr/bin/env node
/**
 * FILE: tests/competition/calculation-dynamic-v6.test.js
 *
 * Mục đích:
 * Contract test cho calculation engine V6 khi Week 1 không còn phụ thuộc
 * vào một ngày lịch cố định.
 *
 * Trách nhiệm:
 * - Kiểm tra first week được suy ra từ history.
 * - Kiểm tra rollover được truyền sang tuần kế tiếp.
 * - Kiểm tra tuần rỗng giữ nguyên rollover.
 *
 * Test chỉ dùng fixture trong bộ nhớ và không truy cập Supabase.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'modules/competition/competition-calculation-v6.js'),
    'utf8',
);

const context = vm.createContext({
    console,
});

vm.runInContext(source, context, {
    filename: 'modules/competition/competition-calculation-v6.js',
});

const engine = context.CompetitionCalculationV6;

assert.ok(engine, 'Calculation engine V6 phải được expose.');

assert.equal(
    'OFFICIAL_FIRST_WEEK' in engine.CONFIG,
    false,
    'Calculation engine không được phụ thuộc vào ngày Week 1 cố định.',
);

assert.equal(
    engine.calculateWeekScore(
        [
            {
                student_id: 'A',
                week: '2030-01-14',
                score: 3,
            },
        ],
        'A',
        '2030-01-14',
    ),
    84,
    'Tuần đầu tiên trong history phải bắt đầu từ 81.',
);

assert.equal(
    engine.calculateWeekScore(
        [
            {
                student_id: 'A',
                week: '2030-01-14',
                score: 10,
            },
        ],
        'A',
        '2030-01-21',
    ),
    91,
    'Tuần sau phải nhận rollover 91 từ tuần trước.',
);

assert.equal(
    engine.calculateWeekScore(
        [
            {
                student_id: 'A',
                week: '2030-01-14',
                score: 10,
            },
        ],
        'A',
        '2030-01-28',
    ),
    91,
    'Tuần rỗng tiếp theo phải giữ nguyên rollover.',
);

const liveWeekRecords = [
    { student_id: 's1', week: '2026-08-31', week_start: '2026-08-31', score: 1 },
    { student_id: 's1', week: '2026-08-31', week_start: '2026-08-31', score: 1 },
    { student_id: 's1', week: '2026-08-31', week_start: '2026-08-31', score: 5 },
    { student_id: 's2', week: '2026-08-31', week_start: '2026-08-31', score: 1 },
    { student_id: 's2', week: '2026-08-31', week_start: '2026-08-31', score: 5 },
];

assert.equal(
    engine.calculateWeekScore(liveWeekRecords, 's1', '2026-08-31'),
    88,
    '5 live records: HS s1 phải từ 81 lên 88.',
);
assert.equal(
    engine.calculateWeekScore(liveWeekRecords, 's2', '2026-08-31'),
    87,
    '5 live records: HS s2 phải từ 81 lên 87.',
);


const mixedFieldRecords = [
    {
        student_id: 'mixed',
        week_start: '2026-08-31',
        week: 'not-a-date',
        date: '2026-09-02',
        score: 5,
    },
];

assert.equal(
    engine.calculateWeekScore(
        mixedFieldRecords,
        'mixed',
        '2026-08-31',
    ),
    86,
    'Một field tuần legacy không hợp lệ không được chặn fallback sang week_start hợp lệ.',
);

assert.equal(
    engine.getRecordWeek(mixedFieldRecords[0]),
    '2026-08-31',
    'Record phải được chuẩn hóa về cùng canonical week.',
);

console.log('PASS: dynamic weekly calculation contract');
