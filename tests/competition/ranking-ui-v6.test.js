#!/usr/bin/env node
/**
 * FILE: tests/competition/ranking-ui-v6.test.js
 *
 * Mục đích:
 * Contract test cho bảng xếp hạng Thi đua V6.
 *
 * Contract:
 * - Không hiển thị cột Điểm tháng.
 * - Không để lại cell monthly trong từng row.
 * - Giữ nguyên Điểm tuần, Nhóm và Xu hướng.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(
    path.join(root, 'competition-ranking-ui-v6.js'),
    'utf8',
);

const rows = [
    '<tr><th>Hạng</th><th>Học sinh</th><th>Điểm tuần</th><th>Điểm tháng</th><th>Nhóm</th><th>Xu hướng</th></tr>',
    '<tr><td>1</td><td>A</td><td>91</td><td>91</td><td>Vàng</td><td>↗ Tăng</td></tr>',
];

const document = {
    querySelectorAll(selector) {
        if (selector === '#rankBody tr') {
            return rows.slice(1).map((html) => ({
                cells: html.match(/<td>/g) || [],
                innerHTML: html,
            }));
        }

        if (selector === '#rankBody') {
            return [{
                innerHTML: rows[1],
            }];
        }

        return [];
    },
    getElementById() {
        return null;
    },
};

const context = vm.createContext({
    console,
    document,
    window: {},
    setTimeout,
});

vm.runInContext(source, context, {
    filename: 'competition-ranking-ui-v6.js',
});

const api = context.window.CompetitionRankingUIV6;

assert.ok(api, 'CompetitionRankingUIV6 phải được expose.');
assert.equal(
    api.MONTHLY_SCORE_LABEL,
    'Điểm tháng',
);

const cleanedHeader = api.removeMonthlyScoreColumn(rows[0]);
const cleanedRow = api.removeMonthlyScoreColumn(rows[1]);

assert.doesNotMatch(
    cleanedHeader,
    /Điểm tháng/,
    'Header ranking không được hiển thị Điểm tháng.',
);

assert.doesNotMatch(
    cleanedRow,
    />91<\/td><td>Vàng/,
    'Row ranking không được giữ monthly score cell.',
);

assert.match(cleanedRow, /<td>Vàng<\/td>/);
assert.match(cleanedRow, /<td>↗ Tăng<\/td>/);

console.log('PASS: monthly-score-free ranking contract');
