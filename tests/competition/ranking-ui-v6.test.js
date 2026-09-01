#!/usr/bin/env node
/**
 * FILE: tests/competition/ranking-ui-v6.test.js
 *
 * Mục đích:
 * Contract test cho bảng xếp hạng Thi đua V6.
 *
 * Contract:
 * - Không hiển thị Điểm tháng.
 * - Không hiển thị Nhóm điểm cũ.
 * - Giữ Hạng, Học sinh, Điểm tuần và Xu hướng.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-ranking-columns-v6.js'),
    'utf8',
);

const document = {
    getElementById() {
        return null;
    },
};

const context = vm.createContext({
    console,
    document,
    window: {
        setInterval,
        clearInterval,
    },
    globalThis: null,
});

context.globalThis = context;

vm.runInContext(source, context, {
    filename: 'competition-ranking-columns-v6.js',
});

const api = context.CompetitionRankingColumnsV6;

assert.ok(api, 'CompetitionRankingColumnsV6 phải được expose.');
assert.deepEqual(
    Array.from(api.hiddenHeaders),
    ['Điểm tháng', 'Nhóm'],
);

const headers = [
    '<th>Hạng</th>',
    '<th>Học sinh</th>',
    '<th>Điểm tuần</th>',
    '<th>Điểm tháng</th>',
    '<th>Nhóm</th>',
    '<th>Xu hướng</th>',
];

assert.deepEqual(
    headers.filter((header) => {
        const text = header.replace(/<[^>]+>/g, '').trim();
        return !api.hiddenHeaders.includes(text);
    }),
    [
        '<th>Hạng</th>',
        '<th>Học sinh</th>',
        '<th>Điểm tuần</th>',
        '<th>Xu hướng</th>',
    ],
);

console.log('PASS: monthly/group-free ranking contract');
