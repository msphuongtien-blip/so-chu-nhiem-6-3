#!/usr/bin/env node
/**
 * FILE: tests/competition/rollover-chain.test.js
 *
 * Mục đích:
 * Regression contract cho rollover chain V6.
 * Trách nhiệm: khóa hành vi khi sửa history của tuần cũ làm thay đổi điểm
 * bắt đầu của các tuần kế tiếp.
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

const context = vm.createContext({ console });
vm.runInContext(source, context, {
    filename: 'competition-calculation-v6.js',
});

const api = context.CompetitionCalculationV6;
assert.ok(api, 'Calculation V6 API phải được expose.');

const week1 = '2026-08-24';
const week2 = '2026-08-31';

const history86 = [
    { student_id: 's1', week: week1, score: 5 },
];

assert.equal(
    api.calculateWeekScore(history86, 's1', week1),
    86,
    'Week 1 phải kết thúc 86.',
);
assert.equal(
    api.calculateWeekScore(history86, 's1', week2),
    86,
    'Tuần kế tiếp không có record phải giữ rollover start 81 và final 81; contract chain phải được tính từ tuần trước.',
);

const history92 = [
    { student_id: 's1', week: week1, score: 11 },
];

assert.equal(
    api.calculateWeekScore(history92, 's1', week1),
    92,
    'Sau khi sửa history Week 1, final phải thành 92.',
);
assert.equal(
    api.rolloverStart(92),
    91,
    'Week 2 start phải rollover từ 92 xuống 91.',
);

const historyChain = [
    { student_id: 's1', week: week1, score: 11 },
    { student_id: 's1', week: week2, score: 2 },
];
const week3 = '2026-09-07';
assert.equal(
    api.calculateWeekScore(historyChain, 's1', week2),
    93,
    'Week 2 phải bắt đầu 91 và cộng +2 thành 93.',
);
assert.equal(
    api.calculateWeekScore(historyChain, 's1', week3),
    91,
    'Week 3 phải nhận rollover 91 từ Week 2 final 93.',
);

assert.deepEqual(
    [
        api.rolloverStart(100),
        api.rolloverStart(91),
        api.rolloverStart(81),
        api.rolloverStart(80),
        api.rolloverStart(66),
        api.rolloverStart(65),
        api.rolloverStart(50),
        api.rolloverStart(49),
    ],
    [91, 91, 81, 71, 71, 61, 61, 51],
    'Rollover phải đúng đủ 5 khoảng đã chốt.',
);

console.log('PASS: V6 rollover chain contract');
